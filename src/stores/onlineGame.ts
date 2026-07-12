import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  onlineToGameView,
} from '@/mappers/onlineToGameView'
import { onlineToResultView } from '@/mappers/onlineToResultView'
import type { ResultViewModel } from '@/mappers/toResultView'
import type { GameViewModel } from '@/mappers/toGameView'
import type {
  ChatMessage,
  ClientBidExtra,
  ClientGameAction,
  ClientMessage,
  PendingResultSnapshot,
  PlayerView,
  ServerMessage,
  StampId,
  WireDeckComposition,
  WireExtraRules,
} from '@/online/protocol'
import {
  formatHttpErrorBody,
  formatServerError,
  isKnownErrorCode,
  isSoftActionError,
} from '@/online/errorMessages'
import {
  clearResumeToken,
  loadLastRoomCode,
  loadResumeToken,
  loadSavedDisplayName,
  saveDisplayName,
  saveResumeToken,
} from '@/online/resumeStorage'
import { isDevBuild } from '@/config/runtime'
import { roomWebSocketUrl, roomsCreateUrl } from '@/online/workerUrl'
import type { EventLogItem } from '@/types/game'

/** Server close codes from teardownRoom (host end / idle purge). */
const WS_CLOSE_ROOM_PURGED = 4001
const WS_CLOSE_HOST_ENDED = 4002

/** Short-lived floating chat / stamp on screen (not persisted). */
export interface FloatingReaction {
  key: string
  /** 'stamp' = large emoji; 'text' = chat bubble */
  kind: 'stamp' | 'text'
  /** Stamp emoji, or chat body text */
  body: string
  displayName: string
  /** Horizontal position 0–100 (%) */
  x: number
}

export type OnlineConnection =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error'

const MAX_RECONNECT_ATTEMPTS = 8

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
  /** User-facing Japanese message */
  const lastError = ref<string | null>(null)
  /** Wire / client error code (e.g. REVISION_MISMATCH). Null for local-only msgs. */
  const lastErrorCode = ref<string | null>(null)
  const lastEvent = ref<string | null>(null)
  /** Impact FX payload from server events (特殊能力 / セイム / チェンジ) */
  const lastActionFx = ref<{
    key: string
    kind: 'reverse' | 'shot' | 'draw1' | 'life_double' | 'same' | 'change'
    actorName?: string
    targetName?: string
    bidValue?: number
  } | null>(null)
  const displayName = ref(loadSavedDisplayName())
  const eventLog = ref<EventLogItem[]>([])
  /** Room chat lines (newest last). Filled by chat_history + chat. */
  const chatMessages = ref<ChatMessage[]>([])
  /** Ephemeral floating stamps (live chat only; not re-shown from history). */
  const floatingReactions = ref<FloatingReaction[]>([])
  /**
   * Client-side dismiss of result cut-in / ResultView.
   * Frozen local hold so other players' dismiss / disconnect / view
   * broadcasts do not rebuild the result UI mid-animation.
   */
  const resultDismissed = ref(false)
  const heldPendingResult = ref<PendingResultSnapshot | null>(null)
  /** Stable ResultViewModel for the current challenge (identity-stable). */
  const heldResultView = ref<ResultViewModel | null>(null)
  /**
   * Local player pressed「もう一度遊ぶ」and rematch was accepted.
   * Views watch this to navigate to lobby (only the requester).
   */
  const rematchNavigateToken = ref(0)
  /**
   * Peers: room returned to lobby after someone rematched.
   * Keep result / forfeit UI until they tap「ロビーへ」.
   */
  const pendingLobbyReturn = ref(false)
  /** True while an automatic or manual reconnect is in flight */
  const reconnecting = ref(false)
  const reconnectAttempt = ref(0)
  /** Local player has sent rematch and waits for status=open */
  let selfRequestedRematch = false

  let ws: WebSocket | null = null
  /** Bumped on each new socket so stale close handlers never reconnect. */
  let socketGen = 0
  let intentionalClose = false
  let logSeq = 0
  let helloWait: {
    resolve: () => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null
  /**
   * Reject the in-flight connectAndJoin promise when a newer connect / leave
   * supersedes it (socketGen alone would leave the old Promise hanging).
   */
  let activeConnectFail: ((err: Error) => void) | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** Clears ephemeral status-bar events (RESUME, BID, etc.) */
  let lastEventClearTimer: ReturnType<typeof setTimeout> | null = null

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

  const isDisconnected = computed(
    () =>
      connection.value === 'closed' ||
      connection.value === 'error' ||
      (connection.value === 'connecting' && reconnecting.value),
  )

  /** Room was dissolved / purged — do not offer reconnect. */
  const isRoomClosed = computed(() => lastErrorCode.value === 'ROOM_CLOSED')

  /** True when a resume token still exists for the current (or last) room. */
  const canAttemptResume = computed(() => {
    if (isRoomClosed.value) return false
    const code = roomCode.value ?? loadLastRoomCode()
    return code != null && loadResumeToken(code) != null
  })

  const gameView = computed<GameViewModel | null>(() => {
    if (!view.value?.game) return null
    return onlineToGameView(view.value, eventLog.value)
  })

  const pendingResult = computed<ResultViewModel | null>(() => {
    if (resultDismissed.value || !heldResultView.value) return null
    return heldResultView.value
  })

  function clearResultHold(): void {
    heldPendingResult.value = null
    heldResultView.value = null
  }

  /** Same challenge snapshot (round + bid + challenger) — ignore roster churn. */
  function isSameChallenge(
    a: PendingResultSnapshot,
    b: PendingResultSnapshot,
  ): boolean {
    return (
      a.round === b.round &&
      a.outcome.challengerId === b.outcome.challengerId &&
      a.outcome.bid === b.outcome.bid
    )
  }

  function captureResultHold(
    playerView: PlayerView,
    snap: PendingResultSnapshot,
  ): void {
    const prev = heldPendingResult.value
    const isNew = !prev || !isSameChallenge(prev, snap)
    heldPendingResult.value = snap
    if (isNew || !heldResultView.value) {
      resultDismissed.value = false
      heldResultView.value = onlineToResultView(playerView, snap)
    }
  }

  const awaitingResultView = computed(() => pendingResult.value != null)

  const isGameOver = computed(
    () => view.value?.game?.isGameOver === true,
  )

  const canHumanAct = computed(() => {
    if (!view.value?.game || pendingResult.value) return false
    if (connection.value !== 'open') return false
    return view.value.game.isMyTurn && view.value.game.phase === 'bidding'
  })

  function setError(code: string | null, message?: string | null): void {
    lastErrorCode.value = code
    if (code && isKnownErrorCode(code)) {
      lastError.value = formatServerError(code, message)
    } else if (message?.trim()) {
      lastError.value = message.trim()
    } else if (code) {
      lastError.value = formatServerError(code, message)
    } else {
      lastError.value = 'エラーが発生しました'
    }
  }

  function clearError(): void {
    lastError.value = null
    lastErrorCode.value = null
  }

  async function createRoom(name?: string): Promise<string> {
    if (name != null) {
      displayName.value = name
      saveDisplayName(name)
    }
    clearError()
    clearReconnectTimer()
    reconnectAttempt.value = 0
    let res: Response
    try {
      res = await fetch(roomsCreateUrl(), {
        method: 'POST',
        // Worker 未起動 / ハング時に UI が永遠に「接続中」にならないようにする
        signal: AbortSignal.timeout(8_000),
      })
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'TimeoutError'
          ? 'ルーム作成がタイムアウトしました。別ターミナルで npm run worker:dev を起動（または再起動）してください'
          : e instanceof TypeError
            ? 'Worker に接続できません。npm run worker:dev を確認してください'
            : e instanceof Error
              ? e.message
              : 'ルーム作成に失敗しました'
      setError(null, msg)
      throw new Error(msg)
    }
    let data: { roomCode?: string; message?: string; error?: string }
    try {
      data = (await res.json()) as {
        roomCode?: string
        message?: string
        error?: string
      }
    } catch {
      const msg = `ルーム作成に失敗しました (HTTP ${res.status})`
      setError(null, msg)
      throw new Error(msg)
    }
    if (!res.ok || !data.roomCode) {
      const msg = formatHttpErrorBody(data, res.status)
      lastErrorCode.value = data.error ?? null
      lastError.value = msg
      throw new Error(msg)
    }
    await connectAndJoin(data.roomCode, displayName.value, { clearView: true })
    return data.roomCode
  }

  async function joinRoom(code: string, name?: string): Promise<void> {
    if (name != null) {
      displayName.value = name
      saveDisplayName(name)
    }
    clearError()
    clearReconnectTimer()
    reconnectAttempt.value = 0
    const normalized = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (normalized.length < 4) {
      const msg = 'ルームコードを入力してください'
      setError('BAD_REQUEST', msg)
      throw new Error(msg)
    }
    await connectAndJoin(normalized, displayName.value, { clearView: true })
  }

  /**
   * Reload / deep-link entry: reconnect with saved resumeToken if any.
   * Returns true if a session is open (or already was).
   */
  async function ensureSession(opts?: {
    code?: string | null
    name?: string
  }): Promise<boolean> {
    if (connection.value === 'open' && view.value) return true

    const code =
      (opts?.code && opts.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()) ||
      roomCode.value ||
      loadLastRoomCode()
    if (!code) return false

    const token = loadResumeToken(code)
    if (!token) return false

    if (opts?.name != null && opts.name.trim()) {
      displayName.value = opts.name
      saveDisplayName(opts.name)
    }

    clearError()
    reconnecting.value = true
    try {
      await connectAndJoin(code, displayName.value || 'プレイヤー', {
        clearView: view.value == null,
        preserveOnFail: true,
        resumeAttempt: true,
      })
      reconnectAttempt.value = 0
      return connection.value === 'open'
    } catch {
      // Room gone / token dead — drop home “前回のルーム” banner
      if (
        lastErrorCode.value === 'ROOM_CLOSED' ||
        lastErrorCode.value === 'ROOM_NOT_FOUND' ||
        lastErrorCode.value === 'INVALID_TOKEN'
      ) {
        clearResumeToken(code)
      }
      return false
    } finally {
      reconnecting.value = false
    }
  }

  /** Manual reconnect (disconnect banner). Keeps last view when possible. */
  async function reconnect(): Promise<void> {
    if (lastErrorCode.value === 'ROOM_CLOSED') {
      setError('ROOM_CLOSED', lastError.value ?? 'ルームが閉じられました')
      throw new Error(lastError.value!)
    }
    const code = roomCode.value ?? loadLastRoomCode()
    if (!code || !loadResumeToken(code)) {
      setError(
        'ROOM_CLOSED',
        '復帰できるルームがありません。解散されたか、セッションが終了しています',
      )
      throw new Error(lastError.value!)
    }
    clearReconnectTimer()
    clearError()
    reconnecting.value = true
    try {
      await connectAndJoin(code, displayName.value || 'プレイヤー', {
        clearView: false,
        preserveOnFail: true,
        resumeAttempt: true,
      })
      reconnectAttempt.value = 0
    } catch (e) {
      if (
        lastErrorCode.value === 'ROOM_CLOSED' ||
        lastErrorCode.value === 'ROOM_NOT_FOUND' ||
        lastErrorCode.value === 'INVALID_TOKEN' ||
        connection.value === 'error'
      ) {
        // Stale resume after dissolve: stop offering reconnect
        clearResumeToken(code)
        if (lastErrorCode.value !== 'ROOM_CLOSED') {
          setError(
            'ROOM_CLOSED',
            'ルームに接続できませんでした。解散されたか、すでに終了している可能性があります',
          )
        }
        roomCode.value = null
        resumeToken.value = null
      }
      throw e
    } finally {
      reconnecting.value = false
    }
  }

  /**
   * Room gone (host dissolve / idle purge). No reconnect; drop resume token.
   */
  function applyRoomClosed(_reason: string | null | undefined): void {
    if (lastErrorCode.value === 'ROOM_CLOSED' && intentionalClose) {
      // Idempotent (room_closed message + close code 4001/4002)
      clearReconnectTimer()
      closeSocketOnly()
      return
    }
    intentionalClose = true
    clearReconnectTimer()
    reconnecting.value = false
    reconnectAttempt.value = 0
    const code = roomCode.value
    if (code) clearResumeToken(code)
    // Keep ROOM_CLOSED for isRoomClosed / no-reconnect; no sticky UI copy
    // (clients auto-navigate home — "ホストが解散…" は冗長)
    lastErrorCode.value = 'ROOM_CLOSED'
    lastError.value = null
    roomCode.value = null
    playerId.value = null
    resumeToken.value = null
    isHost.value = false
    revision.value = 0
    view.value = null
    clearResultHold()
    resultDismissed.value = false
    eventLog.value = []
    chatMessages.value = []
    floatingReactions.value = []
    setLastEvent(null)
    connection.value = 'closed'
    closeSocketOnly()
  }

  function wsOpenFailMessage(isResumeAttempt: boolean): string {
    if (isResumeAttempt) {
      return 'ルームに接続できませんでした。解散されたか、すでに終了している可能性があります'
    }
    if (isDevBuild) {
      return 'WebSocket エラー（npm run worker:dev を確認してください）'
    }
    return 'サーバーに接続できませんでした。通信環境を確認してください'
  }

  function wsTimeoutMessage(isResumeAttempt: boolean): string {
    if (isResumeAttempt) {
      return 'ルームへの再接続がタイムアウトしました。解散された可能性があります'
    }
    if (isDevBuild) {
      return '接続がタイムアウトしました（Worker は起動していますか？）'
    }
    return '接続がタイムアウトしました。しばらくしてから再試行してください'
  }

  async function connectAndJoin(
    code: string,
    name: string,
    opts?: {
      clearView?: boolean
      preserveOnFail?: boolean
      /** Resume / auto-reconnect — avoid dev-only worker hints on failure */
      resumeAttempt?: boolean
    },
  ): Promise<void> {
    const clearView = opts?.clearView !== false
    const preserveOnFail = opts?.preserveOnFail === true
    const resumeAttempt =
      opts?.resumeAttempt === true || loadResumeToken(code) != null

    // Drop prior socket first (bumps socketGen so its handlers no-op), then
    // reject any in-flight join Promise so callers do not hang forever.
    closeSocketOnly()
    if (activeConnectFail) {
      activeConnectFail(new Error('接続が切り替わりました'))
      activeConnectFail = null
    }
    if (helloWait) {
      clearHelloWait(new Error('接続が切り替わりました'))
    }
    intentionalClose = false
    const myGen = ++socketGen
    connection.value = 'connecting'
    roomCode.value = code
    if (clearView) {
      view.value = null
      playerId.value = null
      eventLog.value = []
      resultDismissed.value = false
      clearResultHold()
      logSeq = 0
    }

    const token = loadResumeToken(code)
    const url = roomWebSocketUrl(code)

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const fail = (err: Error) => {
        // Do not gate on socketGen: supersede path must be able to reject.
        if (settled) return
        settled = true
        if (activeConnectFail === fail) activeConnectFail = null
        if (myGen === socketGen) {
          connection.value = preserveOnFail && view.value ? 'closed' : 'error'
          // Prefer server-formatted message already on lastError (join errors)
          if (!lastError.value) {
            setError(null, err.message)
          }
        }
        clearHelloWait(err)
        reject(err)
      }
      const ok = () => {
        if (settled) return
        settled = true
        if (activeConnectFail === fail) activeConnectFail = null
        resolve()
      }
      activeConnectFail = fail

      try {
        ws = new WebSocket(url)
      } catch (e) {
        fail(e instanceof Error ? e : new Error('WebSocket open failed'))
        return
      }

      const openTimer = setTimeout(() => {
        if (myGen !== socketGen) return
        fail(new Error(wsTimeoutMessage(resumeAttempt)))
        try {
          if (myGen === socketGen) ws?.close()
        } catch {
          // ignore
        }
      }, 12_000)

      ws.addEventListener('open', () => {
        if (myGen !== socketGen) return
        connection.value = 'open'
        clearTimeout(openTimer)
        const joinMsg: ClientMessage = {
          type: 'join',
          displayName: name.trim() || 'プレイヤー',
          resumeToken: token ?? undefined,
        }

        helloWait = {
          resolve: ok,
          reject: (e) => fail(e),
          timer: setTimeout(() => {
            fail(new Error('参加応答がタイムアウトしました'))
          }, 10_000),
        }

        // send() 失敗時は hello 待ちのまま固まらないよう明示的に fail
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          fail(new Error('WebSocket がオープン状態ではありません'))
          return
        }
        try {
          ws.send(JSON.stringify(joinMsg))
        } catch (e) {
          fail(e instanceof Error ? e : new Error('join の送信に失敗しました'))
        }
      })

      ws.addEventListener('message', (ev) => {
        if (myGen !== socketGen) return
        onMessage(String(ev.data))
      })

      ws.addEventListener('close', (ev) => {
        if (myGen !== socketGen) return
        clearTimeout(openTimer)
        ws = null
        const closeCode = typeof ev?.code === 'number' ? ev.code : 0
        const closeReason =
          typeof ev?.reason === 'string' ? ev.reason : ''

        // Teardown may close sockets even if room_closed message was lost
        if (
          closeCode === WS_CLOSE_ROOM_PURGED ||
          closeCode === WS_CLOSE_HOST_ENDED ||
          /host ended|room purged|room closed/i.test(closeReason)
        ) {
          applyRoomClosed(
            closeCode === WS_CLOSE_HOST_ENDED ||
              /host ended/i.test(closeReason)
              ? 'Host ended the room'
              : closeReason || 'Room closed due to inactivity',
          )
          const closedErr = new Error(
            lastError.value ?? 'ルームが閉じられました',
          )
          // Unblock in-flight connectAndJoin without double-settling
          if (helloWait || !settled) {
            fail(closedErr)
          }
          return
        }

        if (helloWait) {
          clearHelloWait(new Error('接続が切断されました'))
        } else if (!settled) {
          fail(new Error('接続が切断されました'))
        }
        if (intentionalClose) {
          connection.value = 'idle'
          return
        }
        if (lastErrorCode.value === 'ROOM_CLOSED') return
        connection.value = 'closed'
        if (!lastError.value) {
          setError('CONNECTION', '接続が切断されました')
        }
        scheduleReconnect()
      })

      ws.addEventListener('error', () => {
        if (myGen !== socketGen) return
        clearTimeout(openTimer)
        if (connection.value === 'connecting') {
          fail(new Error(wsOpenFailMessage(resumeAttempt)))
        }
      })
    })
  }

  function scheduleReconnect(): void {
    if (intentionalClose || lastErrorCode.value === 'ROOM_CLOSED') return
    const code = roomCode.value
    if (!code || !loadResumeToken(code)) return
    if (reconnectTimer) return
    if (reconnectAttempt.value >= MAX_RECONNECT_ATTEMPTS) {
      // Likely dissolved while we were offline — drop stale resume affordance
      clearResumeToken(code)
      setError(
        'ROOM_CLOSED',
        'ルームに再接続できませんでした。解散されたか、すでに終了している可能性があります',
      )
      reconnecting.value = false
      roomCode.value = null
      resumeToken.value = null
      return
    }

    const attempt = reconnectAttempt.value
    const delay = Math.min(1000 * 2 ** attempt, 15_000)
    reconnectAttempt.value = attempt + 1
    reconnecting.value = true
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void (async () => {
        if (
          intentionalClose ||
          !roomCode.value ||
          lastErrorCode.value === 'ROOM_CLOSED'
        ) {
          reconnecting.value = false
          return
        }
        try {
          await connectAndJoin(
            roomCode.value,
            displayName.value || 'プレイヤー',
            {
              clearView: false,
              preserveOnFail: true,
              resumeAttempt: true,
            },
          )
          reconnectAttempt.value = 0
          reconnecting.value = false
          clearError()
          pushLog('再接続しました', 'RESUME')
        } catch {
          if (lastErrorCode.value === 'ROOM_CLOSED') {
            reconnecting.value = false
            return
          }
          scheduleReconnect()
        }
      })()
    }, delay)
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
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
        const prevStatus = view.value?.status
        revision.value = msg.revision
        view.value = msg.view
        if (msg.view.selfPlayerId) {
          playerId.value = msg.view.selfPlayerId
        }
        isHost.value = msg.view.hostId === playerId.value
        // Freeze challenge UI so peer dismiss / disconnect does not rebuild
        // ResultView or cut-in. Rematch: only the requester drops hold + navigates;
        // peers keep hold and see pendingLobbyReturn until they choose.
        if (msg.view.pendingResult) {
          captureResultHold(msg.view, msg.view.pendingResult)
          pendingLobbyReturn.value = false
        } else if (
          msg.view.status === 'open' ||
          msg.view.phase === 'lobby'
        ) {
          const fromPlaying = prevStatus === 'playing'
          if (selfRequestedRematch) {
            selfRequestedRematch = false
            pendingLobbyReturn.value = false
            resultDismissed.value = false
            clearResultHold()
            rematchNavigateToken.value += 1
          } else if (
            fromPlaying ||
            heldResultView.value != null ||
            heldPendingResult.value != null
          ) {
            // Peer rematch (or mid-result room reset): keep local result UI
            pendingLobbyReturn.value = true
          } else {
            resultDismissed.value = false
            clearResultHold()
            pendingLobbyReturn.value = false
          }
        } else if (
          heldResultView.value &&
          msg.view.phase !== 'result'
        ) {
          // e.g. resume after disconnect while peers already advanced mid-round
          // (not rematch — next bidding). Drop hold only if not showing rematch prompt.
          if (!pendingLobbyReturn.value) {
            resultDismissed.value = false
            clearResultHold()
          }
        }
        break
      }
      case 'event': {
        // Wire/diagnostic noise (legacy CONNECTED welcome, etc.) — never surface in UI
        if (msg.code === 'CONNECTED' || !msg.message?.trim()) break
        setLastEvent(msg.message)
        pushLog(msg.message, msg.code)
        if (msg.fx?.kind) {
          lastActionFx.value = {
            key: `${Date.now()}-${msg.fx.kind}-${Math.random().toString(36).slice(2, 7)}`,
            kind: msg.fx.kind,
            actorName: msg.fx.actorName,
            targetName: msg.fx.targetName,
            bidValue: msg.fx.bidValue,
          }
        }
        break
      }
      case 'error': {
        // Dissolved room: DO storage gone → join/upgrade paths surface ROOM_NOT_FOUND
        if (msg.code === 'ROOM_NOT_FOUND' && (helloWait || reconnecting.value)) {
          applyRoomClosed(msg.message || 'Room not found')
          if (helloWait) {
            clearHelloWait(
              new Error(lastError.value ?? 'ルームが見つかりません'),
            )
          }
          break
        }
        const friendly = formatServerError(msg.code, msg.message)
        setError(msg.code, msg.message)
        // Soft action errors (revision / illegal): keep session open; toast only
        if (helloWait) {
          clearHelloWait(new Error(friendly))
        } else if (isSoftActionError(msg.code)) {
          pushLog(friendly, msg.code)
        }
        break
      }
      case 'room_closed': {
        applyRoomClosed(msg.reason)
        break
      }
      case 'pong':
        break
      case 'chat_history':
        // History only — do not re-float past stamps
        chatMessages.value = Array.isArray(msg.messages) ? [...msg.messages] : []
        break
      case 'chat': {
        const m = msg.message
        if (!m?.id) break
        // Dedup if history and live race
        if (chatMessages.value.some((x) => x.id === m.id)) break
        chatMessages.value = [...chatMessages.value, m].slice(-50)
        // Live only: float stamp + text like reactions (history does not re-float)
        enqueueFloatingChat(m)
        break
      }
      default:
        break
    }
  }

  function enqueueFloatingChat(m: ChatMessage): void {
    const key = m.id
    const isStamp = m.kind === 'stamp'
    const body = (m.text || '').trim()
    if (!body) return
    const item: FloatingReaction = {
      key,
      kind: isStamp ? 'stamp' : 'text',
      body: isStamp ? body : body.slice(0, 80),
      displayName: m.displayName || '?',
      x: 12 + Math.random() * 76,
    }
    floatingReactions.value = [...floatingReactions.value, item].slice(-12)
    const ttl = isStamp ? 3000 : 3600
    window.setTimeout(() => {
      floatingReactions.value = floatingReactions.value.filter((r) => r.key !== key)
    }, ttl)
  }

  /**
   * Ephemeral banner text under the game header.
   * Must auto-clear — otherwise RESUME / BID stick forever in statusMessage.
   */
  function setLastEvent(message: string | null, ttlMs = 3200): void {
    if (lastEventClearTimer) {
      clearTimeout(lastEventClearTimer)
      lastEventClearTimer = null
    }
    lastEvent.value = message
    if (!message) return
    lastEventClearTimer = setTimeout(() => {
      lastEventClearTimer = null
      if (lastEvent.value === message) lastEvent.value = null
    }, ttlMs)
  }

  function pushLog(message: string, code?: string) {
    logSeq += 1
    // Round / phase dividers (server code ROUND_START / GAME_ENDED)
    if (code === 'ROUND_START' || code === 'GAME_ENDED') {
      const item: EventLogItem = {
        id: `oe${logSeq}`,
        avatar: '·',
        name: '',
        message,
        timeLabel: '',
        kind: 'separator',
      }
      eventLog.value = [item, ...eventLog.value].slice(0, 40)
      return
    }
    // Server events are often full sentences ("太郎 が再接続しました").
    // EventLog renders `{name}が{message}` — split so we don't get "ルームが太郎 が…".
    let name = 'ルーム'
    let body = message
    const m = message.match(/^(.+?)\s+が\s*(.+)$/u)
    if (m) {
      name = m[1].trim()
      body = m[2].trim()
    } else if (code === 'CHALLENGE') {
      name = 'コヨーテ'
    }
    const item: EventLogItem = {
      id: `oe${logSeq}`,
      avatar: '📡',
      name,
      message: body,
      timeLabel: 'たった今',
      kind: 'entry',
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
      setError('CONNECTION', '未接続です')
      return
    }
    ws.send(JSON.stringify(msg))
  }

  function setReady(ready: boolean): void {
    send({ type: 'ready', ready })
  }

  function startGame(): void {
    clearError()
    send({ type: 'start' })
  }

  /** Host only, lobby: apply mountain deck composition for next game. */
  function setDeck(deck: WireDeckComposition): void {
    clearError()
    send({ type: 'set_deck', deck })
  }

  /** Host only, lobby: apply extra rules toggles for next game. */
  function setExtraRules(extraRules: WireExtraRules): void {
    clearError()
    send({ type: 'set_extra_rules', extraRules })
  }

  function sendAction(action: ClientGameAction): void {
    clearError()
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

  function placeBid(value: number, extra?: ClientBidExtra): void {
    sendAction({ type: 'PLACE_BID', value, extra })
  }

  function playSame(): void {
    sendAction({ type: 'SAME' })
  }

  function playChange(): void {
    sendAction({ type: 'CHANGE' })
  }

  function challenge(): void {
    sendAction({ type: 'CHALLENGE' })
  }

  /**
   * Dismiss challenge result UI. Notifies server (HOLD-2) so slow clients keep
   * pendingResult until they also dismiss; local hold is cleared immediately.
   */
  function clearPendingResult(): void {
    resultDismissed.value = true
    clearResultHold()
    if (ws && ws.readyState === WebSocket.OPEN) {
      send({ type: 'dismiss_result' })
    }
  }

  /** After game_over: ask server to reset room to lobby (same seats). */
  function requestRematch(): void {
    clearError()
    selfRequestedRematch = true
    pendingLobbyReturn.value = false
    // Do not clear result hold until server confirms (status → open)
    send({ type: 'rematch' })
  }

  /**
   * Peer: leave result/forfeit UI after someone rematched; caller navigates to lobby.
   */
  function acceptLobbyReturn(): void {
    pendingLobbyReturn.value = false
    resultDismissed.value = false
    clearResultHold()
  }

  /** Room chat (online only). Empty / overlong text is ignored client-side. */
  function sendChat(text: string): void {
    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (!trimmed) return
    clearError()
    send({ type: 'chat', text: trimmed.slice(0, 120) })
  }

  /** Fixed stamp reaction (online only). Server allowlists stampId. */
  function sendReaction(stampId: StampId): void {
    clearError()
    send({ type: 'reaction', stampId })
  }

  /**
   * Update display name in lobby (re-sends join; server renames existing seat).
   * No-op when not connected.
   */
  function updateDisplayName(name: string): void {
    const sanitized = name.trim().replace(/\s+/g, ' ').slice(0, 12)
    displayName.value = sanitized
    if (sanitized) saveDisplayName(sanitized)
    if (ws && ws.readyState === WebSocket.OPEN && playerId.value) {
      send({
        type: 'join',
        displayName: sanitized || 'プレイヤー',
      })
    }
  }

  function leave(): void {
    const code = roomCode.value
    intentionalClose = true
    clearReconnectTimer()
    reconnecting.value = false
    reconnectAttempt.value = 0
    if (activeConnectFail) {
      activeConnectFail(new Error('退出したため接続を中断しました'))
      activeConnectFail = null
    }
    if (helloWait) {
      clearHelloWait(new Error('退出したため接続を中断しました'))
    }
    // Ask server to drop the lobby seat before closing the socket
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'leave' } satisfies ClientMessage))
      } catch {
        // ignore
      }
    }
    closeSocketOnly()
    if (code) clearResumeToken(code)
    roomCode.value = null
    playerId.value = null
    resumeToken.value = null
    isHost.value = false
    revision.value = 0
    view.value = null
    connection.value = 'idle'
    clearError()
    setLastEvent(null)
    eventLog.value = []
    chatMessages.value = []
    floatingReactions.value = []
    resultDismissed.value = false
    clearResultHold()
  }

  /**
   * Host only: dissolve the entire room for everyone.
   * Server broadcasts room_closed and purges storage; local cleanup follows that message.
   * Falls back to a local reset if the socket is already down.
   */
  function endRoom(): void {
    if (!isHost.value) {
      setError('UNAUTHORIZED', 'Only the host can end the room')
      return
    }
    // Prevent reconnect race if the socket drops before room_closed arrives
    intentionalClose = true
    clearReconnectTimer()
    reconnecting.value = false
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'end_room' } satisfies ClientMessage))
        return
      } catch {
        // fall through to local teardown
      }
    }
    // Offline / send failed: local cleanup only
    leave()
    lastErrorCode.value = 'ROOM_CLOSED'
    lastError.value = null
  }

  /** Close current WS and invalidate its handlers (no reconnect). */
  function closeSocketOnly(): void {
    socketGen += 1
    const old = ws
    ws = null
    if (old) {
      try {
        old.close(1000, 'client leave')
      } catch {
        // ignore
      }
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
    lastErrorCode,
    lastEvent,
    lastActionFx,
    clearError,
    displayName,
    eventLog,
    chatMessages,
    floatingReactions,
    reconnecting,
    reconnectAttempt,
    isOnlineSession,
    isDisconnected,
    isRoomClosed,
    canAttemptResume,
    phase,
    players,
    canStart,
    inLobby,
    isPlaying,
    gameView,
    pendingResult,
    awaitingResultView,
    isGameOver,
    rematchNavigateToken,
    pendingLobbyReturn,
    canHumanAct,
    createRoom,
    joinRoom,
    ensureSession,
    reconnect,
    setReady,
    startGame,
    setDeck,
    setExtraRules,
    placeBid,
    playSame,
    playChange,
    challenge,
    clearPendingResult,
    requestRematch,
    acceptLobbyReturn,
    sendChat,
    sendReaction,
    updateDisplayName,
    leave,
    endRoom,
    send,
  }
})
