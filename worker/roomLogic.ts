/**
 * Pure room helpers (testable without Durable Object runtime).
 */

import {
  cloneDeckComposition,
  DEFAULT_EXTRA_RULES,
  DEFAULT_WIN_CONDITION,
  forceEliminatePlayer,
  GameError,
  STANDARD_DECK,
  validateRoomDeckComposition,
  type DeckComposition,
  type ExtraRulesConfig,
  type GameState,
  type WinCondition,
} from '../src/domain/game'
import {
  createInitialClock,
  DEFAULT_TIME_CONTROL,
  isTimeControlEnabled,
  MAX_MAIN_SECONDS,
  MAX_TURN_SECONDS,
  MIN_MAIN_SECONDS,
  MIN_TURN_SECONDS,
  resetMainBanks,
  settleTurn,
  startTurn,
  toWireClock,
  turnDeadlineAt,
  type RoomClock,
  type WireTimeControl,
} from './turnClock'
import {
  AVATAR_COUNT,
  isValidAvatarIndex,
  sanitizeAvatarIndex,
} from '../src/localGame/avatarCatalog'
import {
  buildMaskedGame,
  viewPhase,
  type BidHistoryEntry,
  type PendingResultSnapshot,
} from './maskedView'
import {
  CHAT_COOLDOWN_MS,
  DISCONNECT_FORFEIT_MS,
  HOST_DISCONNECT_GRACE_MS,
  IDLE_TTL_OPEN_MS,
  IDLE_TTL_PLAYING_MS,
  MAX_CHAT_HISTORY,
  MAX_CHAT_TEXT_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  isStampId,
  stampEmoji,
  type ChatMessage,
  type ClientGameAction,
  type ClientMessage,
  type PlayerView,
  type PlayerViewMember,
  type StampId,
  type WireDeckComposition,
  type WireExtraRules,
  type WireWinCondition,
} from './types'

// Re-export clock types for GameRoom consumers
export type { RoomClock, WireTimeControl } from './turnClock'
export {
  isTimeControlEnabled,
  isTurnTimedOut,
  remainingForPlayer,
  turnDeadlineAt,
  toWireClock,
} from './turnClock'

export type RoomStatus = 'open' | 'playing' | 'closed'

export interface RoomPlayer {
  id: string
  displayName: string
  joinedAt: number
  ready: boolean
  connected: boolean
  resumeToken: string
  /** 0-based index into avatar catalog (client maps to assets). */
  avatarIndex: number
}

export interface RoomState {
  roomCode: string
  createdAt: number
  lastActivityAt: number
  hostId: string | null
  revision: number
  players: RoomPlayer[]
  /** resumeToken → playerId */
  resumeTokens: Record<string, string>
  /** playerId → epoch ms when host-transfer (or other) deadline fires */
  disconnectDeadlines: Record<string, number>
  status: RoomStatus
  /** domain GameState after start; null in lobby */
  game: GameState | null
  pendingResult: PendingResultSnapshot | null
  /**
   * playerId → true when they dismissed the current pendingResult.
   * Cleared when a new challenge snapshot is set or result is fully cleared.
   */
  resultAcks: Record<string, boolean>
  bidHistory: BidHistoryEntry[]
  /** actionId → room revision when applied (idempotency) */
  appliedActions: Record<string, number>
  /** Room chat ring buffer (newest last). Not part of game revision. */
  chatLog: ChatMessage[]
  /** playerId → last successful chat epoch ms (rate limit) */
  chatLastAt: Record<string, number>
  /**
   * Mountain deck composition for the next startGame.
   * Host edits via set_deck in lobby. Rematch keeps this value.
   */
  deck: DeckComposition
  /**
   * Extra rules toggles for the next startGame.
   * Host edits via set_extra_rules in lobby. Rematch keeps this value.
   */
  extraRules: ExtraRulesConfig
  /**
   * Turn time control for the next startGame.
   * Host edits via set_time_control in lobby. `null` = unlimited.
   * Rematch keeps this value. Live state is `clock`.
   */
  timeControl: WireTimeControl | null
  /**
   * Match end condition for the next startGame.
   * Host edits via set_win_condition in lobby. Rematch keeps this value.
   */
  winCondition: WinCondition
  /**
   * Live bank + turn timer while status === 'playing' and timeControl is set.
   * Cleared in lobby / rematch.
   */
  clock: RoomClock | null
}

export interface WsAttachment {
  playerId?: string
}

export function createEmptyRoom(roomCode: string, now = Date.now()): RoomState {
  return {
    roomCode,
    createdAt: now,
    lastActivityAt: now,
    hostId: null,
    revision: 0,
    players: [],
    resumeTokens: {},
    disconnectDeadlines: {},
    status: 'open',
    game: null,
    pendingResult: null,
    resultAcks: {},
    bidHistory: [],
    appliedActions: {},
    chatLog: [],
    chatLastAt: {},
    deck: cloneDeckComposition(STANDARD_DECK),
    extraRules: { ...DEFAULT_EXTRA_RULES },
    timeControl: DEFAULT_TIME_CONTROL,
    winCondition: DEFAULT_WIN_CONDITION,
    clock: null,
  }
}

/** All seated players must be ready (including host). */
export function allPlayersReady(room: RoomState): boolean {
  if (room.players.length < MIN_PLAYERS_TO_START) return false
  return room.players.every((p) => p.ready)
}

/** Host can start: lobby, ≥2 players, everyone ready. */
export function canHostStart(room: RoomState, selfPlayerId: string | null): boolean {
  return (
    room.status === 'open' &&
    selfPlayerId != null &&
    selfPlayerId === room.hostId &&
    allPlayersReady(room)
  )
}

export function hasResultAck(room: RoomState, playerId: string | null): boolean {
  if (!playerId) return false
  return room.resultAcks?.[playerId] === true
}

/**
 * True when every currently connected player has dismissed the result.
 * Disconnected seats do not block clearing.
 */
export function allConnectedHaveResultAck(room: RoomState): boolean {
  const connected = room.players.filter((p) => p.connected)
  if (connected.length === 0) return true
  return connected.every((p) => room.resultAcks?.[p.id] === true)
}

/**
 * Record a result dismiss. Returns whether room.pendingResult was cleared.
 * No-op if there is no pending result (already cleared).
 */
export function applyResultDismiss(
  room: RoomState,
  playerId: string,
): { changed: boolean; cleared: boolean } {
  ensureLifecycleFields(room)
  if (!room.pendingResult) {
    return { changed: false, cleared: false }
  }
  if (room.resultAcks[playerId]) {
    return { changed: false, cleared: false }
  }
  room.resultAcks[playerId] = true
  if (allConnectedHaveResultAck(room)) {
    room.pendingResult = null
    room.resultAcks = {}
    return { changed: true, cleared: true }
  }
  return { changed: true, cleared: false }
}

/**
 * Reset playing room to lobby for rematch. Keeps players / host / tokens.
 * Caller bumps revision / lastActivityAt / save.
 */
export function resetRoomForRematch(room: RoomState): void {
  room.status = 'open'
  room.game = null
  room.pendingResult = null
  room.resultAcks = {}
  room.bidHistory = []
  room.appliedActions = {}
  room.clock = null
  for (const p of room.players) {
    p.ready = false
  }
}

export function sanitizeDisplayName(raw: unknown): string {
  if (typeof raw !== 'string') return 'プレイヤー'
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 12)
  return trimmed.length > 0 ? trimmed : 'プレイヤー'
}

/**
 * Optional wire avatar index.
 * - Missing / null / undefined → undefined (caller assigns default)
 * - Valid integer in range → that index
 * - Invalid (float, string junk, out of range, wrong type) → undefined
 *   so clients cannot force a bad catalog slot
 */
export function parseOptionalAvatarIndex(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined
  if (isValidAvatarIndex(raw)) return raw
  // Numeric string only when exact integer in range (no silent clamp of 99 → last)
  if (typeof raw === 'string' && /^\d{1,2}$/.test(raw.trim())) {
    const n = Number(raw.trim())
    if (isValidAvatarIndex(n)) return n
  }
  return undefined
}

export { AVATAR_COUNT, isValidAvatarIndex, sanitizeAvatarIndex }

/**
 * Normalize chat body: strip control chars, collapse whitespace, cap length.
 * Returns null when empty after sanitize.
 */
export function sanitizeChatText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw
    // eslint-disable-next-line no-control-regex -- intentional strip of C0/C1 controls
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHAT_TEXT_LENGTH)
  return cleaned.length > 0 ? cleaned : null
}

export type AppendChatResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; code: 'CHAT_REJECTED' | 'RATE_LIMITED'; message: string }

function checkChatCooldown(
  room: RoomState,
  playerId: string,
  now: number,
): AppendChatResult | null {
  if (!room.chatLastAt) room.chatLastAt = {}
  const last = room.chatLastAt[playerId]
  if (typeof last === 'number' && now - last < CHAT_COOLDOWN_MS) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      message: 'Chat rate limited',
    }
  }
  return null
}

/**
 * Append a chat line to the room ring buffer (mutates room).
 * Does not bump room.revision.
 */
export function appendChatMessage(
  room: RoomState,
  player: RoomPlayer,
  rawText: unknown,
  now = Date.now(),
  id: string = crypto.randomUUID(),
): AppendChatResult {
  const text = sanitizeChatText(rawText)
  if (!text) {
    return { ok: false, code: 'CHAT_REJECTED', message: 'Empty chat message' }
  }
  if (!room.chatLog) room.chatLog = []
  const limited = checkChatCooldown(room, player.id, now)
  if (limited) return limited
  const message: ChatMessage = {
    id,
    playerId: player.id,
    displayName: player.displayName,
    text,
    ts: now,
    kind: 'text',
  }
  room.chatLog = [...room.chatLog, message].slice(-MAX_CHAT_HISTORY)
  room.chatLastAt[player.id] = now
  room.lastActivityAt = now
  return { ok: true, message }
}

/**
 * Append a fixed stamp reaction as a chat line (mutates room).
 * Shares rate limit with normal chat. Does not bump revision.
 */
export function appendStampReaction(
  room: RoomState,
  player: RoomPlayer,
  stampIdRaw: unknown,
  now = Date.now(),
  id: string = crypto.randomUUID(),
): AppendChatResult {
  if (!isStampId(stampIdRaw)) {
    return { ok: false, code: 'CHAT_REJECTED', message: 'Unknown stamp' }
  }
  const stampId: StampId = stampIdRaw
  if (!room.chatLog) room.chatLog = []
  const limited = checkChatCooldown(room, player.id, now)
  if (limited) return limited
  const message: ChatMessage = {
    id,
    playerId: player.id,
    displayName: player.displayName,
    text: stampEmoji(stampId),
    ts: now,
    kind: 'stamp',
    stampId,
  }
  room.chatLog = [...room.chatLog, message].slice(-MAX_CHAT_HISTORY)
  room.chatLastAt[player.id] = now
  room.lastActivityAt = now
  return { ok: true, message }
}

export function parseClientMessage(raw: unknown): ClientMessage | { error: string } {
  if (!raw || typeof raw !== 'object' || !('type' in raw)) {
    return { error: 'Message must be an object with type' }
  }
  const msg = raw as Record<string, unknown>
  const type = msg.type

  switch (type) {
    case 'ping':
      return { type: 'ping' }
    case 'join': {
      const displayName = sanitizeDisplayName(msg.displayName)
      const resumeToken =
        typeof msg.resumeToken === 'string' && msg.resumeToken.length > 0
          ? msg.resumeToken
          : undefined
      const avatarIndex = parseOptionalAvatarIndex(msg.avatarIndex)
      return {
        type: 'join',
        displayName,
        resumeToken,
        ...(avatarIndex !== undefined ? { avatarIndex } : {}),
      }
    }
    case 'ready': {
      if (typeof msg.ready !== 'boolean') {
        return { error: 'ready must be boolean' }
      }
      return { type: 'ready', ready: msg.ready }
    }
    case 'start':
      return { type: 'start' }
    case 'dismiss_result':
      return { type: 'dismiss_result' }
    case 'rematch':
      return { type: 'rematch' }
    case 'chat': {
      if (typeof msg.text !== 'string') {
        return { error: 'chat requires text string' }
      }
      // Keep raw text for server-side sanitize + length errors in handler
      return { type: 'chat', text: msg.text }
    }
    case 'reaction': {
      if (!isStampId(msg.stampId)) {
        return { error: 'reaction requires valid stampId' }
      }
      return { type: 'reaction', stampId: msg.stampId }
    }
    case 'leave':
      return { type: 'leave' }
    case 'end_room':
      return { type: 'end_room' }
    case 'set_deck': {
      const parsed = parseWireDeck(msg.deck)
      if ('error' in parsed) {
        return { error: parsed.error }
      }
      return { type: 'set_deck', deck: parsed.deck }
    }
    case 'set_extra_rules': {
      const parsed = parseWireExtraRules(msg.extraRules)
      if ('error' in parsed) {
        return { error: parsed.error }
      }
      return { type: 'set_extra_rules', extraRules: parsed.extraRules }
    }
    case 'set_time_control': {
      const parsed = parseWireTimeControl(msg.timeControl)
      if ('error' in parsed) {
        return { error: parsed.error }
      }
      return { type: 'set_time_control', timeControl: parsed.timeControl }
    }
    case 'set_win_condition': {
      const parsed = parseWireWinCondition(msg.winCondition)
      if ('error' in parsed) {
        return { error: parsed.error }
      }
      return { type: 'set_win_condition', winCondition: parsed.winCondition }
    }
    case 'resume': {
      if (typeof msg.resumeToken !== 'string' || !msg.resumeToken) {
        return { error: 'resumeToken required' }
      }
      return { type: 'resume', resumeToken: msg.resumeToken }
    }
    case 'action': {
      if (typeof msg.actionId !== 'string' || typeof msg.expectedRevision !== 'number') {
        return { error: 'action requires actionId and expectedRevision' }
      }
      const action = msg.action
      if (!action || typeof action !== 'object' || !('type' in action)) {
        return { error: 'action.action required' }
      }
      const a = action as {
        type: string
        value?: number
        extra?: {
          type: string
          targetId?: string
        }
      }
      if (a.type === 'PLACE_BID' && typeof a.value === 'number' && Number.isFinite(a.value)) {
        const bidAction: ClientGameAction = { type: 'PLACE_BID', value: a.value }
        if (a.extra && typeof a.extra === 'object' && typeof a.extra.type === 'string') {
          const ex = a.extra
          if (ex.type === 'reverse') {
            bidAction.extra = { type: 'reverse' }
          } else if (ex.type === 'life_double') {
            bidAction.extra = { type: 'life_double' }
          } else if (
            (ex.type === 'shot' || ex.type === 'draw1') &&
            typeof ex.targetId === 'string' &&
            ex.targetId.length > 0
          ) {
            bidAction.extra = { type: ex.type, targetId: ex.targetId }
          } else {
            return { error: 'Invalid bid extra' }
          }
        }
        return {
          type: 'action',
          actionId: msg.actionId,
          expectedRevision: msg.expectedRevision,
          action: bidAction,
        }
      }
      if (a.type === 'SAME') {
        return {
          type: 'action',
          actionId: msg.actionId,
          expectedRevision: msg.expectedRevision,
          action: { type: 'SAME' },
        }
      }
      if (a.type === 'CHANGE') {
        return {
          type: 'action',
          actionId: msg.actionId,
          expectedRevision: msg.expectedRevision,
          action: { type: 'CHANGE' },
        }
      }
      if (a.type === 'CHALLENGE') {
        return {
          type: 'action',
          actionId: msg.actionId,
          expectedRevision: msg.expectedRevision,
          action: { type: 'CHALLENGE' },
        }
      }
      return { error: 'Invalid action payload' }
    }
    default:
      return { error: `Unknown message type: ${String(type)}` }
  }
}

export function buildPlayerView(
  room: RoomState,
  selfPlayerId: string | null,
): PlayerView {
  // Migrate older DO snapshots missing new fields
  const bidHistory = room.bidHistory ?? []
  const roomPending = room.pendingResult ?? null
  // Per-player: hide result after this client dismissed (server still holds for others)
  const showPending =
    roomPending != null && !hasResultAck(room, selfPlayerId)
  const pendingResult = showPending ? roomPending : null

  const players: PlayerViewMember[] = room.players.map((p, i) => ({
    id: p.id,
    displayName: p.displayName,
    ready: p.ready,
    connected: p.connected,
    isHost: p.id === room.hostId,
    seatIndex: i,
    avatarIndex: p.avatarIndex,
  }))

  const phase = viewPhase(room.status, pendingResult, room.game)

  const deck = room.deck ?? cloneDeckComposition(STANDARD_DECK)
  const extraRules = room.extraRules ?? { ...DEFAULT_EXTRA_RULES }
  const timeControl = room.timeControl ?? null
  const winCondition = room.winCondition ?? DEFAULT_WIN_CONDITION
  const clock =
    room.clock && isTimeControlEnabled(timeControl)
      ? toWireClock(room.clock)
      : undefined

  return {
    phase,
    roomCode: room.roomCode,
    hostId: room.hostId,
    players,
    selfPlayerId,
    status: room.status,
    canStart: canHostStart(room, selfPlayerId),
    playerCount: room.players.length,
    maxPlayers: MAX_PLAYERS,
    deck: toWireDeck(deck),
    extraRules: toWireExtraRules(extraRules),
    timeControl,
    winCondition: toWireWinCondition(winCondition),
    clock,
    game: room.game
      ? buildMaskedGame(
          room.game,
          selfPlayerId,
          room.players,
          bidHistory,
          room.hostId,
        )
      : undefined,
    pendingResult: pendingResult ?? undefined,
  }
}

/** Domain / room deck → wire payload (plain JSON). */
export function toWireDeck(deck: DeckComposition): WireDeckComposition {
  const s = deck.specials
  return {
    id: deck.id,
    label: deck.label,
    numbers: deck.numbers.map((n) => ({ value: n.value, count: n.count })),
    specials: {
      double: s.double,
      half: s.half ?? 0,
      max_to_zero: s.max_to_zero,
      redraw: s.redraw,
      zero_mix: s.zero_mix,
    },
  }
}

export function toWireExtraRules(rules: ExtraRulesConfig): WireExtraRules {
  return {
    same: !!rules.same,
    change: !!rules.change,
    reverse: !!rules.reverse,
    shot: !!rules.shot,
    draw1: !!rules.draw1,
    lifeDouble: !!rules.lifeDouble,
  }
}

export function parseWireExtraRules(
  raw: unknown,
): { extraRules: WireExtraRules } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'エクストラルールの設定を読み取れませんでした' }
  }
  const r = raw as Record<string, unknown>
  const keys = [
    'same',
    'change',
    'reverse',
    'shot',
    'draw1',
    'lifeDouble',
  ] as const
  const out: WireExtraRules = { ...DEFAULT_EXTRA_RULES }
  for (const k of keys) {
    if (r[k] === undefined) continue
    if (typeof r[k] !== 'boolean') {
      return { error: `エクストラルール「${k}」は ON/OFF で指定してください` }
    }
    out[k] = r[k] as boolean
  }
  // Ignore legacy halfCard key if clients still send it
  return { extraRules: out }
}

export function applySetExtraRules(
  room: RoomState,
  extraRules: WireExtraRules,
): void {
  room.extraRules = { ...extraRules }
}

export function toWireWinCondition(
  condition: WinCondition,
): WireWinCondition {
  return condition === 'last_standing' ? 'last_standing' : 'first_elimination'
}

export function parseWireWinCondition(
  raw: unknown,
): { winCondition: WireWinCondition } | { error: string } {
  if (raw === 'first_elimination' || raw === 'last_standing') {
    return { winCondition: raw }
  }
  return {
    error:
      '勝利条件は「一人脱落で終了」または「勝ち残り」を選んでください',
  }
}

export function applySetWinCondition(
  room: RoomState,
  winCondition: WireWinCondition,
): void {
  room.winCondition =
    winCondition === 'last_standing' ? 'last_standing' : 'first_elimination'
}

/**
 * Parse lobby time-control payload.
 * `null` disables the clock. Otherwise mainSeconds + turnSeconds (turn > 0).
 */
export function parseWireTimeControl(
  raw: unknown,
): { timeControl: WireTimeControl | null } | { error: string } {
  if (raw === null || raw === undefined) {
    return { timeControl: null }
  }
  if (typeof raw !== 'object') {
    return { error: '制限時間の設定を読み取れませんでした' }
  }
  const r = raw as Record<string, unknown>
  const main = r.mainSeconds
  const turn = r.turnSeconds
  if (typeof main !== 'number' || !Number.isFinite(main) || !Number.isInteger(main)) {
    return { error: '持ち時間は整数の秒で指定してください' }
  }
  if (typeof turn !== 'number' || !Number.isFinite(turn) || !Number.isInteger(turn)) {
    return { error: 'ターン時間は整数の秒で指定してください' }
  }
  if (main < MIN_MAIN_SECONDS || main > MAX_MAIN_SECONDS) {
    return {
      error: `持ち時間は ${MIN_MAIN_SECONDS}〜${MAX_MAIN_SECONDS} 秒の範囲で指定してください`,
    }
  }
  if (turn < MIN_TURN_SECONDS || turn > MAX_TURN_SECONDS) {
    return {
      error: `ターン時間は ${MIN_TURN_SECONDS}〜${MAX_TURN_SECONDS} 秒の範囲で指定してください`,
    }
  }
  return { timeControl: { mainSeconds: main, turnSeconds: turn } }
}

export function applySetTimeControl(
  room: RoomState,
  timeControl: WireTimeControl | null,
): void {
  room.timeControl = timeControl
}

/**
 * Initialize live clock when a timed game starts.
 */
export function initClockForGame(room: RoomState, now = Date.now()): void {
  ensureLifecycleFields(room)
  if (!isTimeControlEnabled(room.timeControl) || !room.game) {
    room.clock = null
    return
  }
  const ids = room.game.players.map((p) => p.id)
  room.clock = createInitialClock(
    ids,
    room.timeControl,
    room.game.currentTurnPlayerId,
    now,
    room.game.round,
  )
}

/**
 * After any game mutation: pause clock on result / end, or start the new turn.
 * Main banks reset when `game.round` advances (new round).
 * Safe no-op when time control is off.
 */
export function syncClockAfterGameChange(
  room: RoomState,
  now = Date.now(),
): void {
  ensureLifecycleFields(room)
  if (!isTimeControlEnabled(room.timeControl) || !room.game) {
    room.clock = null
    return
  }

  if (!room.clock) {
    initClockForGame(room, now)
    return
  }

  const game = room.game
  const ids = game.players.map((p) => p.id)

  // Stamp missing forRound (older DO storage) without resetting mid-round.
  if (room.clock.forRound === undefined) {
    room.clock = { ...room.clock, forRound: game.round }
  } else if (room.clock.forRound !== game.round) {
    // New round: full main bank for every seated player
    room.clock = resetMainBanks(
      room.clock,
      room.timeControl.mainSeconds,
      ids,
      game.round,
      now,
    )
  }

  const paused =
    room.pendingResult != null ||
    game.phase === 'round_end' ||
    game.phase === 'game_over' ||
    game.phase === 'lobby'

  if (paused || !game.currentTurnPlayerId) {
    if (room.clock.turnStartedAt != null) {
      room.clock = settleTurn(room.clock, now)
    } else {
      room.clock = {
        ...room.clock,
        turnPlayerId: null,
        turnStartedAt: null,
        bankAtTurnStartMs: 0,
        turnBonusMs: 0,
      }
    }
    return
  }

  const turnId = game.currentTurnPlayerId
  // Already counting this player — leave running (e.g. spurious sync)
  if (
    room.clock.turnPlayerId === turnId &&
    room.clock.turnStartedAt != null
  ) {
    return
  }

  room.clock = startTurn(
    room.clock,
    turnId,
    room.timeControl.turnSeconds,
    now,
  )
}

/**
 * Parse and validate a client set_deck payload.
 * Returns a plain DeckComposition safe to store on RoomState.
 */
export function parseWireDeck(
  raw: unknown,
): { deck: WireDeckComposition } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: '山札の内容を読み取れませんでした' }
  }
  const d = raw as Record<string, unknown>
  if (!Array.isArray(d.numbers)) {
    return { error: '数字カードの設定が正しくありません' }
  }
  if (!d.specials || typeof d.specials !== 'object') {
    return { error: '特殊カードの設定が正しくありません' }
  }
  const specialsRaw = d.specials as Record<string, unknown>
  const specials = {
    double: specialsRaw.double,
    half: specialsRaw.half ?? 0,
    max_to_zero: specialsRaw.max_to_zero,
    redraw: specialsRaw.redraw,
    zero_mix: specialsRaw.zero_mix,
  }
  for (const [k, v] of Object.entries(specials)) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 50) {
      return { error: `特殊カード「${k}」の枚数は 0〜50 の整数にしてください` }
    }
  }

  const numbers: Array<{ value: number; count: number }> = []
  if (d.numbers.length > 40) {
    return { error: '数字カードの種類が多すぎます' }
  }
  for (const entry of d.numbers) {
    if (!entry || typeof entry !== 'object') {
      return { error: '数字カードの設定が正しくありません' }
    }
    const e = entry as Record<string, unknown>
    if (
      typeof e.value !== 'number' ||
      !Number.isInteger(e.value) ||
      e.value < -100 ||
      e.value > 100
    ) {
      return { error: 'カードの数字は -100〜100 の整数にしてください' }
    }
    if (
      typeof e.count !== 'number' ||
      !Number.isInteger(e.count) ||
      e.count < 0 ||
      e.count > 50
    ) {
      return { error: 'カードの枚数は 0〜50 の整数にしてください' }
    }
    if (e.count === 0) continue
    numbers.push({ value: e.value, count: e.count })
  }

  const id =
    typeof d.id === 'string' ? d.id.trim().slice(0, 32) || undefined : undefined
  const label =
    typeof d.label === 'string'
      ? d.label.trim().slice(0, 40) || undefined
      : undefined

  const composition: DeckComposition = {
    id,
    label,
    numbers,
    specials: {
      double: specials.double as number,
      half: specials.half as number,
      max_to_zero: specials.max_to_zero as number,
      redraw: specials.redraw as number,
      zero_mix: specials.zero_mix as number,
    },
  }

  try {
    validateRoomDeckComposition(composition)
  } catch (err) {
    if (err instanceof GameError) {
      // Map engine English messages to short Japanese for UI
      const m = err.message
      if (m.includes('at least')) {
        return { error: '山札は10枚以上にしてください' }
      }
      if (m.includes('at most')) {
        return { error: '山札は120枚以下にしてください' }
      }
      if (m.includes('at least 1')) {
        return { error: '山札に1枚以上入れてください' }
      }
      return { error: '山札の内容をもう一度確認してください' }
    }
    return { error: '山札の内容をもう一度確認してください' }
  }

  return {
    deck: toWireDeck(composition),
  }
}

/**
 * Apply host deck change in lobby. Mutates room.deck.
 * Caller bumps revision / lastActivity / save / broadcast.
 */
export function applySetDeck(
  room: RoomState,
  deck: WireDeckComposition,
): void {
  ensureLifecycleFields(room)
  room.deck = {
    id: deck.id,
    label: deck.label,
    numbers: deck.numbers.map((n) => ({ value: n.value, count: n.count })),
    specials: { ...deck.specials },
  }
}

export function findPlayerByToken(
  room: RoomState,
  token: string,
): RoomPlayer | undefined {
  const id = room.resumeTokens[token]
  if (!id) return undefined
  return room.players.find((p) => p.id === id)
}

/** Round-robin fallback when client does not pick an avatar. */
export function nextAvatarIndex(room: RoomState): number {
  return room.players.length % AVATAR_COUNT
}

/** Cap appliedActions map size. */
export function rememberAction(
  applied: Record<string, number>,
  actionId: string,
  revision: number,
): Record<string, number> {
  const next = { ...applied, [actionId]: revision }
  const keys = Object.keys(next)
  if (keys.length <= 64) return next
  const trimmed = keys.slice(-48)
  const out: Record<string, number> = {}
  for (const k of trimmed) out[k] = next[k]!
  return out
}

// ---------------------------------------------------------------------------
// Lifecycle: host transfer + idle purge (phase1 §7.5–7.6)
// ---------------------------------------------------------------------------

export function ensureLifecycleFields(room: RoomState): void {
  if (!room.disconnectDeadlines) room.disconnectDeadlines = {}
  if (!room.bidHistory) room.bidHistory = []
  if (!room.appliedActions) room.appliedActions = {}
  if (room.pendingResult === undefined) room.pendingResult = null
  if (!room.resultAcks) room.resultAcks = {}
  if (!room.chatLog) room.chatLog = []
  if (!room.chatLastAt) room.chatLastAt = {}
  if (!room.deck) room.deck = cloneDeckComposition(STANDARD_DECK)
  if (!room.extraRules) room.extraRules = { ...DEFAULT_EXTRA_RULES }
  if (room.timeControl === undefined) room.timeControl = DEFAULT_TIME_CONTROL
  if (room.winCondition === undefined) {
    room.winCondition = DEFAULT_WIN_CONDITION
  }
  if (room.clock === undefined) room.clock = null
}

export function connectedPlayerCount(room: RoomState): number {
  return room.players.filter((p) => p.connected).length
}

/** Clear a player's disconnect deadline (e.g. on resume). */
export function clearDisconnectDeadline(room: RoomState, playerId: string): void {
  ensureLifecycleFields(room)
  delete room.disconnectDeadlines[playerId]
}

/**
 * Mark player disconnected and start grace timers.
 * - playing: forfeit after DISCONNECT_FORFEIT_MS (also covers host transfer)
 * - lobby / other: host-only transfer grace
 * Caller bumps revision / lastActivityAt / save / alarm.
 */
export function markPlayerDisconnected(
  room: RoomState,
  playerId: string,
  now = Date.now(),
): void {
  ensureLifecycleFields(room)
  const player = room.players.find((p) => p.id === playerId)
  if (player) player.connected = false

  if (room.status === 'playing' && room.game) {
    room.disconnectDeadlines[playerId] = now + DISCONNECT_FORFEIT_MS
  } else if (room.hostId === playerId) {
    room.disconnectDeadlines[playerId] = now + HOST_DISCONNECT_GRACE_MS
  }
}

export interface DisconnectPolicyResult {
  changed: boolean
  /** Player ids force-eliminated this tick */
  forfeitedIds: string[]
  previousHostId: string | null
  newHostId: string | null
  hostTransferred: boolean
}

/**
 * Apply expired disconnect deadlines: host transfer + in-game forfeit.
 * Idempotent for reconnected seats (deadline cleared without effect).
 */
export function applyDueDisconnectPolicies(
  room: RoomState,
  now = Date.now(),
): DisconnectPolicyResult {
  ensureLifecycleFields(room)
  const result: DisconnectPolicyResult = {
    changed: false,
    forfeitedIds: [],
    previousHostId: room.hostId,
    newHostId: room.hostId,
    hostTransferred: false,
  }

  const due = Object.entries(room.disconnectDeadlines)
    .filter(([, t]) => typeof t === 'number' && now >= t)
    .map(([id]) => id)

  if (due.length === 0) {
    return result
  }

  for (const playerId of due) {
    delete room.disconnectDeadlines[playerId]
    const player = room.players.find((p) => p.id === playerId)
    if (player?.connected) {
      // Reconnected before processing
      result.changed = true
      continue
    }

    // Host transfer if this seat was host
    if (room.hostId === playerId) {
      const next = pickNextHost(room)
      if (next && next.id !== playerId) {
        room.hostId = next.id
        result.hostTransferred = true
        result.newHostId = next.id
        result.changed = true
      } else if (!next) {
        room.hostId = null
        result.hostTransferred = true
        result.newHostId = null
        result.changed = true
      }
    }

    // In-game forfeit (auto-eliminate)
    if (room.status === 'playing' && room.game) {
      const gp = room.game.players.find((p) => p.id === playerId)
      if (gp?.alive) {
        room.game = forceEliminatePlayer(room.game, playerId)
        result.forfeitedIds.push(playerId)
        result.changed = true
        // Room status stays playing; UI uses game.phase game_over
      }
    }
  }

  if (result.changed) {
    room.revision += 1
  }
  return result
}

export interface RemovePlayerResult {
  removed: boolean
  /** Previous host left and hostId was reassigned (or cleared). */
  hostChanged: boolean
  previousHostId: string | null
  newHostId: string | null
}

/**
 * Fully remove a seat (lobby intentional leave).
 * Clears resume token, deadlines, chat rate state, result ACK.
 * If they were host, reassigns immediately to oldest remaining connected player.
 */
export function removePlayerFromRoom(
  room: RoomState,
  playerId: string,
): RemovePlayerResult {
  ensureLifecycleFields(room)
  const idx = room.players.findIndex((p) => p.id === playerId)
  if (idx < 0) {
    return {
      removed: false,
      hostChanged: false,
      previousHostId: room.hostId,
      newHostId: room.hostId,
    }
  }

  const previousHostId = room.hostId
  room.players.splice(idx, 1)

  for (const [token, id] of Object.entries(room.resumeTokens)) {
    if (id === playerId) delete room.resumeTokens[token]
  }
  delete room.disconnectDeadlines[playerId]
  delete room.chatLastAt[playerId]
  delete room.resultAcks[playerId]

  let hostChanged = false
  let newHostId = room.hostId
  if (previousHostId === playerId) {
    const next = pickNextHost(room)
    room.hostId = next?.id ?? null
    newHostId = room.hostId
    hostChanged = true
  }

  return { removed: true, hostChanged, previousHostId, newHostId }
}

/** Oldest connected participant by joinedAt (then id). */
export function pickNextHost(room: RoomState): RoomPlayer | null {
  const candidates = room.players
    .filter((p) => p.connected)
    .slice()
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
  return candidates[0] ?? null
}

export interface HostTransferResult {
  /** True when hostId or deadlines changed in a way that needs broadcast/save. */
  changed: boolean
  previousHostId: string | null
  newHostId: string | null
  /** Host grace expired but no connected successor. */
  emptied: boolean
}

/**
 * If host disconnect grace has elapsed and host is still offline,
 * transfer to oldest connected player, or clear host when empty.
 * @deprecated Prefer applyDueDisconnectPolicies (covers host + forfeit).
 */
export function applyDueHostTransfer(
  room: RoomState,
  now = Date.now(),
): HostTransferResult {
  const r = applyDueDisconnectPolicies(room, now)
  return {
    changed: r.changed,
    previousHostId: r.previousHostId,
    newHostId: r.newHostId,
    emptied: r.hostTransferred && r.newHostId == null && connectedPlayerCount(room) === 0,
  }
}

/** Idle TTL for status when connection count is 0. closed → purge immediately. */
export function idleTtlMs(status: RoomStatus): number {
  if (status === 'closed') return 0
  if (status === 'playing') return IDLE_TTL_PLAYING_MS
  return IDLE_TTL_OPEN_MS
}

/**
 * True when room storage should be deleted (0 connections past idle TTL, or closed).
 */
export function shouldPurgeRoom(
  room: RoomState,
  now = Date.now(),
): boolean {
  if (room.status === 'closed') return true
  if (connectedPlayerCount(room) > 0) return false
  return now - room.lastActivityAt >= idleTtlMs(room.status)
}

/**
 * Next DO alarm time, or null if none needed.
 * Considers host-transfer deadlines, turn clock deadline, and idle purge when empty.
 */
export function nextAlarmAt(room: RoomState, now = Date.now()): number | null {
  ensureLifecycleFields(room)
  const candidates: number[] = []

  for (const t of Object.values(room.disconnectDeadlines)) {
    if (typeof t === 'number' && Number.isFinite(t)) candidates.push(t)
  }

  if (
    room.status === 'playing' &&
    room.clock &&
    isTimeControlEnabled(room.timeControl)
  ) {
    const deadline = turnDeadlineAt(room.clock)
    if (deadline != null) candidates.push(deadline)
  }

  if (connectedPlayerCount(room) === 0) {
    if (room.status === 'closed') {
      candidates.push(now)
    } else {
      candidates.push(room.lastActivityAt + idleTtlMs(room.status))
    }
  }

  if (candidates.length === 0) return null
  return Math.min(...candidates)
}
