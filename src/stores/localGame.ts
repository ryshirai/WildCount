import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  applyAction,
  getLegalMoves,
  seedRandom,
  startGame,
  type Card,
  type GameState,
  type PlayerId,
  type RandomSource,
} from '@/domain/game'
import { chooseBotAction } from '@/localGame/bot'
import {
  DEFAULT_PROFILES,
  getProfile,
  SELF_ID,
  type PlayerProfile,
} from '@/localGame/profiles'
import {
  toGameView,
  type BidHistoryEntry,
  type GameViewModel,
} from '@/mappers/toGameView'
import { toResultView, type ResultViewModel } from '@/mappers/toResultView'
import type { EventLogItem } from '@/types/game'

export interface StartLocalGameOptions {
  /** Player profiles in seat order. First entry should be self for default lineup. */
  profiles?: readonly PlayerProfile[]
  selfId?: PlayerId
  initialLives?: number
  deck?: string
  /** Fixed seed for reproducible deals (default 42). */
  seed?: number
  roomCode?: string
  /**
   * Fixed bot think time (ms). When set (including 0 for tests), overrides the
   * default random 3–5s range.
   */
  botDelayMs?: number
  /** Inclusive lower bound for random bot think (default 3000). Ignored if botDelayMs set. */
  botDelayMinMs?: number
  /** Inclusive upper bound for random bot think (default 5000). Ignored if botDelayMs set. */
  botDelayMaxMs?: number
}

/**
 * Pending challenge result kept after the engine auto-advances to the next round.
 * Policy: snapshot hands + round before CHALLENGE; map outcome after applyAction.
 * UI stays on the game screen until the player taps “結果を見る”.
 */
export type PendingResult = ResultViewModel

const DEFAULT_ROOM = 'LOCAL'
const MAX_BOT_STEPS = 64
const MAX_LOG = 40
const DEFAULT_BOT_DELAY_MIN_MS = 3000
const DEFAULT_BOT_DELAY_MAX_MS = 5000
/** Short beat after a bot bid so the new number is readable */
const POST_BID_BEAT_MS = 400

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export const useLocalGameStore = defineStore('localGame', () => {
  const state = ref<GameState | null>(null)
  const selfId = ref<PlayerId>(SELF_ID)
  const profiles = ref<PlayerProfile[]>([...DEFAULT_PROFILES])
  const roomCode = ref(DEFAULT_ROOM)
  const bidHistory = ref<BidHistoryEntry[]>([])
  const eventLog = ref<EventLogItem[]>([])
  const pendingResult = ref<PendingResult | null>(null)
  /** True while bot turns are playing out */
  const botsRunning = ref(false)
  /** Short human-readable line: "🦉 フクロウ の手番…" */
  const statusMessage = ref<string | null>(null)

  let botDelayMinMs = DEFAULT_BOT_DELAY_MIN_MS
  let botDelayMaxMs = DEFAULT_BOT_DELAY_MAX_MS
  /** Monotonic id for event log entries */
  let logSeq = 0
  let rng: RandomSource = seedRandom(42)
  /** Generation token to ignore stale async bot loops after reset/restart */
  let runGeneration = 0

  const hasSession = computed(() => state.value != null)

  const gameView = computed<GameViewModel | null>(() => {
    if (!state.value) return null
    return toGameView({
      state: state.value,
      selfId: selfId.value,
      profiles: profiles.value,
      bidHistory: bidHistory.value,
      eventLog: eventLog.value,
      roomCode: roomCode.value,
    })
  })

  const resultView = computed(() => pendingResult.value)

  const isGameOver = computed(() => state.value?.phase === 'game_over')

  /** Challenge resolved; waiting for player to open the result screen */
  const awaitingResultView = computed(() => pendingResult.value != null)

  /** Human may act only when session is bidding, self turn, not mid-bot, no pending reveal */
  const canHumanAct = computed(() => {
    if (!state.value || botsRunning.value || pendingResult.value) return false
    if (state.value.phase !== 'bidding') return false
    return state.value.currentTurnPlayerId === selfId.value
  })

  function resolveBotDelayMs(): number {
    if (botDelayMaxMs <= botDelayMinMs) return Math.max(0, botDelayMinMs)
    const span = botDelayMaxMs - botDelayMinMs
    return botDelayMinMs + Math.floor(rng.next() * (span + 1))
  }

  function pushLog(playerId: PlayerId, message: string) {
    const profile = getProfile(playerId, profiles.value)
    logSeq += 1
    const item: EventLogItem = {
      id: `e${logSeq}`,
      avatar: profile.avatar,
      avatarSrc: profile.avatarSrc,
      name: profile.name,
      message,
      timeLabel: 'たった今',
    }
    eventLog.value = [item, ...eventLog.value].slice(0, MAX_LOG)
  }

  async function startLocalGame(options: StartLocalGameOptions = {}) {
    runGeneration += 1
    const gen = runGeneration

    const lineup = options.profiles
      ? [...options.profiles]
      : [...DEFAULT_PROFILES]
    profiles.value = lineup
    selfId.value = options.selfId ?? SELF_ID
    roomCode.value = options.roomCode ?? DEFAULT_ROOM

    if (options.botDelayMs != null) {
      botDelayMinMs = options.botDelayMs
      botDelayMaxMs = options.botDelayMs
    } else {
      botDelayMinMs = options.botDelayMinMs ?? DEFAULT_BOT_DELAY_MIN_MS
      botDelayMaxMs = options.botDelayMaxMs ?? DEFAULT_BOT_DELAY_MAX_MS
    }

    bidHistory.value = []
    eventLog.value = []
    pendingResult.value = null
    statusMessage.value = null
    botsRunning.value = false
    logSeq = 0
    rng = seedRandom(options.seed ?? 42)

    const playerIds = lineup.map((p) => p.id)
    state.value = startGame(
      {
        playerIds,
        config: {
          initialLives: options.initialLives ?? 3,
          deck: options.deck ?? 'standard',
        },
      },
      rng,
    )

    pushLog(selfId.value, 'ローカル対戦を開始しました')
    return runBots(gen)
  }

  function applyCurrentAction(action: {
    type: 'PLACE_BID'
    value: number
  } | { type: 'CHALLENGE' }): { hasResult: boolean } {
    if (!state.value) {
      throw new Error('No local game session')
    }
    if (state.value.phase === 'game_over') {
      return { hasResult: false }
    }

    const actorId = state.value.currentTurnPlayerId
    if (!actorId) {
      throw new Error('No current turn player')
    }

    if (action.type === 'PLACE_BID') {
      const round = state.value.round
      state.value = applyAction(state.value, action, rng)
      bidHistory.value = [
        ...bidHistory.value,
        { playerId: actorId, value: action.value, round },
      ]
      pushLog(actorId, `${action.value}を宣言しました`)
      return { hasResult: false }
    }

    const handsSnapshot: Record<PlayerId, Card> = { ...state.value.hands }
    const challengedRound = state.value.round
    const bidderId = state.value.currentBidderId
    const bid = state.value.currentBid

    state.value = applyAction(state.value, { type: 'CHALLENGE' }, rng)

    const outcome = state.value.lastOutcome
    if (!outcome) {
      throw new Error('Challenge resolved without lastOutcome')
    }

    pushLog(actorId, 'コヨーテ！（チャレンジ）')
    if (bidderId != null && bid != null) {
      const loserName = getProfile(outcome.loserId, profiles.value).name
      const bidderName = getProfile(bidderId, profiles.value).name
      pushLog(
        outcome.loserId,
        outcome.bidderWins
          ? `合計 ${outcome.actualTotal} ≥ ${bid} → ${loserName} がライフを失った`
          : `合計 ${outcome.actualTotal} < ${bid} → ${loserName} がライフを失った（宣言: ${bidderName}）`,
      )
    }

    bidHistory.value = bidHistory.value.filter((b) => b.round === state.value!.round)

    pendingResult.value = toResultView({
      outcome,
      hands: handsSnapshot,
      players: state.value.players,
      round: challengedRound,
      roomCode: roomCode.value,
      selfId: selfId.value,
      profiles: profiles.value,
      winnerId: state.value.winnerId,
    })

    const challenger = getProfile(actorId, profiles.value)
    statusMessage.value = `${challenger.avatar} ${challenger.name} がコヨーテ！`
    return { hasResult: true }
  }

  /**
   * Run bot turns with paced delays until human turn, game over, or challenge result.
   * Does not auto-navigate — caller stays on game when hasResult and shows a button.
   */
  async function runBots(gen: number = runGeneration): Promise<{ hasResult: boolean }> {
    if (!state.value) return { hasResult: false }
    if (pendingResult.value) return { hasResult: true }

    botsRunning.value = true
    try {
      for (let i = 0; i < MAX_BOT_STEPS; i++) {
        if (gen !== runGeneration) return { hasResult: false }

        const s = state.value
        if (!s || s.phase !== 'bidding') break
        if (s.currentTurnPlayerId === selfId.value) break
        if (s.currentTurnPlayerId == null) break

        const moves = getLegalMoves(s)
        if (moves.length === 0) break

        const actor = getProfile(s.currentTurnPlayerId, profiles.value)
        const thinkMs = resolveBotDelayMs()
        statusMessage.value =
          thinkMs > 0
            ? `${actor.avatar} ${actor.name} が考えています…`
            : `${actor.avatar} ${actor.name} の手番…`

        await sleep(thinkMs)
        if (gen !== runGeneration) return { hasResult: false }

        const action = chooseBotAction(s, rng)
        const result = applyCurrentAction(action)

        if (result.hasResult) {
          // Leave status as coyote message; UI shows “結果を見る”
          return { hasResult: true }
        }

        if (thinkMs > 0) {
          statusMessage.value = null
          await sleep(POST_BID_BEAT_MS)
        }
      }

      statusMessage.value = null
      return { hasResult: false }
    } finally {
      if (gen === runGeneration) {
        botsRunning.value = false
      }
    }
  }

  async function placeBid(value: number): Promise<{ hasResult: boolean }> {
    if (!state.value) throw new Error('No local game session')
    if (pendingResult.value) throw new Error('先に結果を確認してください')
    if (botsRunning.value) throw new Error('ボットの手番です')
    if (state.value.currentTurnPlayerId !== selfId.value) {
      throw new Error('Not your turn')
    }
    applyCurrentAction({ type: 'PLACE_BID', value })
    return runBots()
  }

  async function challenge(): Promise<{ hasResult: boolean }> {
    if (!state.value) throw new Error('No local game session')
    if (pendingResult.value) throw new Error('先に結果を確認してください')
    if (botsRunning.value) throw new Error('ボットの手番です')
    if (state.value.currentTurnPlayerId !== selfId.value) {
      throw new Error('Not your turn')
    }
    return applyCurrentAction({ type: 'CHALLENGE' })
  }

  /** Call when leaving the result screen for the next round (engine already advanced). */
  function clearPendingResult() {
    pendingResult.value = null
    statusMessage.value = null
  }

  /**
   * After returning from result, bots may need to act first in the new round.
   * Safe to call even if it is already self's turn.
   */
  async function resumeAfterResult(): Promise<{ hasResult: boolean }> {
    if (pendingResult.value) return { hasResult: true }
    if (!state.value || state.value.phase === 'game_over') {
      return { hasResult: false }
    }
    return runBots()
  }

  function resetSession() {
    runGeneration += 1
    state.value = null
    bidHistory.value = []
    eventLog.value = []
    pendingResult.value = null
    botsRunning.value = false
    statusMessage.value = null
    logSeq = 0
  }

  return {
    // state
    state,
    selfId,
    profiles,
    roomCode,
    bidHistory,
    eventLog,
    pendingResult,
    botsRunning,
    statusMessage,
    // computed
    hasSession,
    gameView,
    resultView,
    isGameOver,
    canHumanAct,
    awaitingResultView,
    // actions
    startLocalGame,
    placeBid,
    challenge,
    clearPendingResult,
    resumeAfterResult,
    resetSession,
    runBots,
  }
})
