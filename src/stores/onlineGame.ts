import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  onlineToGameView,
} from '@/mappers/onlineToGameView'
import { onlineToResultView } from '@/mappers/onlineToResultView'
import type { ResultViewModel } from '@/mappers/toResultView'
import type { GameViewModel } from '@/mappers/toGameView'
import type {
  ClientGameAction,
  ClientMessage,
  PlayerView,
  ServerMessage,
} from '@/online/protocol'
import {
  clearResumeToken,
  loadResumeToken,
  loadSavedDisplayName,
  saveDisplayName,
  saveResumeToken,
} from '@/online/resumeStorage'
import { roomWebSocketUrl, roomsCreateUrl } from '@/online/workerUrl'
import type { EventLogItem } from '@/types/game'

export type OnlineConnection =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error'

/**
 * Online multiplayer session (Worker / DO WebSocket).
 * Does not touch localGame / bots.
 */
export const useOnlineGameStore = defineStore('onlineGame', () => {
  const roomCode = ref<string | null>(null)
  const playerId = ref<string | null>(null)
  const resumeToken = ref<string | null>(null)
  const isHost = ref(false)
  const revision = ref(0)
  const view = ref<PlayerView | null>(null)
  const connection = ref<OnlineConnection>('idle')
  const lastError = ref<string | null>(null)
  const lastEvent = ref<string | null>(null)
  const displayName = ref(loadSavedDisplayName())
  const eventLog = ref<EventLogItem[]>([])
  /** Client-side dismiss of result cut-in flow without clearing server pending */
  const resultDismissed = ref(false)

  let ws: WebSocket | null = null
  let intentionalClose = false
  let logSeq = 0
  let helloWait: {
    resolve: () => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  const isOnlineSession = computed(
    () => roomCode.value != null && connection.value !== 'idle',
  )
  const phase = computed(() => view.value?.phase ?? null)
  const players = computed(() => view.value?.players ?? [])
  const canStart = computed(() => view.value?.canStart === true)
  const inLobby = computed(() => view.value?.phase === 'lobby')
  const isPlaying = computed(
    () =>
      view.value?.status === 'playing' ||
      view.value?.phase === 'playing' ||
      view.value?.phase === 'result',
  )

  const gameView = computed<GameViewModel | null>(() => {
    if (!view.value?.game) return null
    return onlineToGameView(view.value, eventLog.value)
  })

  const pendingResult = computed<ResultViewModel | null>(() => {
    if (!view.value?.pendingResult || resultDismissed.value) return null
    return onlineToResultView(view.value, view.value.pendingResult)
  })

  const awaitingResultView = computed(() => pendingResult.value != null)

  const isGameOver = computed(
    () => view.value?.game?.isGameOver === true,
  )

  const canHumanAct = computed(() => {
    if (!view.value?.game || pendingResult.value) return false
    return view.value.game.isMyTurn && view.value.game.phase === 'bidding'
  })

  async function createRoom(name?: string): Promise<string> {
    if (name != null) {
      displayName.value = name
      saveDisplayName(name)
    }
    lastError.value = null
    const res = await fetch(roomsCreateUrl(), { method: 'POST' })
    const data = (await res.json()) as { roomCode?: string; message?: string }
    if (!res.ok || !data.roomCode) {
      throw new Error(data.message ?? `ルーム作成に失敗しました (${res.status})`)
    }
    await connectAndJoin(data.roomCode, displayName.value)
    return data.roomCode
  }

  async function joinRoom(code: string, name?: string): Promise<void> {
    if (name != null) {
      displayName.value = name
      saveDisplayName(name)
    }
    lastError.value = null
    const normalized = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (normalized.length < 4) {
      throw new Error('ルームコードを入力してください')
    }
    await connectAndJoin(normalized, displayName.value)
  }

  async function connectAndJoin(code: string, name: string): Promise<void> {
    disconnectInternal()
    intentionalClose = false
    connection.value = 'connecting'
    roomCode.value = code
    view.value = null
    playerId.value = null
    eventLog.value = []
    resultDismissed.value = false
    logSeq = 0

    const token = loadResumeToken(code)
    const url = roomWebSocketUrl(code)

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const fail = (err: Error) => {
        if (settled) return
        settled = true
        connection.value = 'error'
        lastError.value = err.message
        clearHelloWait(err)
        reject(err)
      }
      const ok = () => {
        if (settled) return
        settled = true
        resolve()
      }

      try {
        ws = new WebSocket(url)
      } catch (e) {
        fail(e instanceof Error ? e : new Error('WebSocket open failed'))
        return
      }

      const openTimer = setTimeout(() => {
        fail(new Error('接続がタイムアウトしました（Worker は起動していますか？）'))
        try {
          ws?.close()
        } catch {
          // ignore
        }
      }, 12_000)

      ws.addEventListener('open', () => {
        connection.value = 'open'
        clearTimeout(openTimer)
        const joinMsg: ClientMessage = {
          type: 'join',
          displayName: name.trim() || 'プレイヤー',
          resumeToken: token ?? undefined,
        }
        send(joinMsg)

        helloWait = {
          resolve: ok,
          reject: (e) => fail(e),
          timer: setTimeout(() => {
            fail(new Error('参加応答がタイムアウトしました'))
          }, 10_000),
        }
      })

      ws.addEventListener('message', (ev) => {
        onMessage(String(ev.data))
      })

      ws.addEventListener('close', () => {
        clearTimeout(openTimer)
        if (!intentionalClose) {
          connection.value = 'closed'
          lastError.value = lastError.value ?? '接続が切断されました'
        } else {
          connection.value = 'idle'
        }
        ws = null
        if (helloWait) {
          clearHelloWait(new Error('接続が切断されました'))
        }
      })

      ws.addEventListener('error', () => {
        clearTimeout(openTimer)
        if (connection.value === 'connecting') {
          fail(
            new Error(
              'WebSocket エラー（npm run worker:dev を確認してください）',
            ),
          )
        }
      })
    })
  }

  function onMessage(raw: string): void {
    let msg: ServerMessage
    try {
      msg = JSON.parse(raw) as ServerMessage
    } catch {
      return
    }

    switch (msg.type) {
      case 'hello':
        playerId.value = msg.playerId
        resumeToken.value = msg.resumeToken
        isHost.value = msg.isHost
        roomCode.value = msg.roomCode
        saveResumeToken(msg.roomCode, msg.resumeToken)
        if (helloWait) {
          clearTimeout(helloWait.timer)
          const r = helloWait.resolve
          helloWait = null
          r()
        }
        break
      case 'view': {
        const prevPending = view.value?.pendingResult
        revision.value = msg.revision
        view.value = msg.view
        if (msg.view.selfPlayerId) {
          playerId.value = msg.view.selfPlayerId
        }
        isHost.value = msg.view.hostId === playerId.value
        // New challenge result arrives → show again
        if (msg.view.pendingResult && msg.view.pendingResult !== prevPending) {
          if (
            !prevPending ||
            prevPending.round !== msg.view.pendingResult.round ||
            prevPending.outcome.challengerId !==
              msg.view.pendingResult.outcome.challengerId
          ) {
            resultDismissed.value = false
          }
        }
        if (!msg.view.pendingResult) {
          resultDismissed.value = false
        }
        break
      }
      case 'event':
        lastEvent.value = msg.message
        pushLog(msg.message, msg.code)
        break
      case 'error':
        lastError.value = msg.message
        if (helloWait) {
          clearHelloWait(new Error(msg.message))
        }
        break
      case 'room_closed':
        lastError.value = msg.reason
        connection.value = 'closed'
        break
      case 'pong':
        break
      default:
        break
    }
  }

  function pushLog(message: string, code?: string) {
    logSeq += 1
    const item: EventLogItem = {
      id: `oe${logSeq}`,
      avatar: '📡',
      name: code === 'CHALLENGE' ? 'コヨーテ' : 'ルーム',
      message,
      timeLabel: 'たった今',
    }
    eventLog.value = [item, ...eventLog.value].slice(0, 40)
  }

  function clearHelloWait(err?: Error): void {
    if (!helloWait) return
    clearTimeout(helloWait.timer)
    const h = helloWait
    helloWait = null
    if (err) h.reject(err)
  }

  function send(msg: ClientMessage): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      lastError.value = '未接続です'
      return
    }
    ws.send(JSON.stringify(msg))
  }

  function setReady(ready: boolean): void {
    send({ type: 'ready', ready })
  }

  function startGame(): void {
    lastError.value = null
    send({ type: 'start' })
  }

  function sendAction(action: ClientGameAction): void {
    lastError.value = null
    const actionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `a-${Date.now()}-${Math.random().toString(36).slice(2)}`
    send({
      type: 'action',
      actionId,
      expectedRevision: revision.value,
      action,
    })
  }

  function placeBid(value: number): void {
    sendAction({ type: 'PLACE_BID', value })
  }

  function challenge(): void {
    sendAction({ type: 'CHALLENGE' })
  }

  /** Local dismiss so GameView can return to bidding UI for next round. */
  function clearPendingResult(): void {
    resultDismissed.value = true
  }

  function leave(): void {
    const code = roomCode.value
    intentionalClose = true
    disconnectInternal()
    if (code) clearResumeToken(code)
    roomCode.value = null
    playerId.value = null
    resumeToken.value = null
    isHost.value = false
    revision.value = 0
    view.value = null
    connection.value = 'idle'
    lastError.value = null
    eventLog.value = []
    resultDismissed.value = false
  }

  function disconnectInternal(): void {
    intentionalClose = true
    if (ws) {
      try {
        ws.close(1000, 'client leave')
      } catch {
        // ignore
      }
      ws = null
    }
  }

  return {
    roomCode,
    playerId,
    resumeToken,
    isHost,
    revision,
    view,
    connection,
    lastError,
    lastEvent,
    displayName,
    eventLog,
    isOnlineSession,
    phase,
    players,
    canStart,
    inLobby,
    isPlaying,
    gameView,
    pendingResult,
    awaitingResultView,
    isGameOver,
    canHumanAct,
    createRoom,
    joinRoom,
    setReady,
    startGame,
    placeBid,
    challenge,
    clearPendingResult,
    leave,
    send,
  }
})
