/**
 * Worker / GameRoom shared types (Phase 1).
 * Protocol details: docs/phase1-multiplayer.md
 */

/** Env bindings from wrangler.jsonc */
export interface Env {
  GAME_ROOM: DurableObjectNamespace
}

/** Alphabet for room codes (no 0/O/1/I/l). Length fixed at 6. */
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const ROOM_CODE_LENGTH = 6

export const MAX_PLAYERS = 10
export const MIN_PLAYERS_TO_START = 2

/** Host disconnect grace before transfer (ms). */
export const HOST_DISCONNECT_GRACE_MS = 60_000

/**
 * Playing disconnect grace before auto-forfeit (ms).
 * Same length as host transfer so one deadline covers both for the host seat.
 */
export const DISCONNECT_FORFEIT_MS = 60_000

/** Idle TTL when nobody is connected (ms). */
export const IDLE_TTL_OPEN_MS = 10 * 60 * 1000
export const IDLE_TTL_PLAYING_MS = 30 * 60 * 1000

/** Room chat (UX-6): max body length, ring buffer, per-player cooldown. */
export const MAX_CHAT_TEXT_LENGTH = 120
export const MAX_CHAT_HISTORY = 50
export const CHAT_COOLDOWN_MS = 800

/**
 * Fixed stamp palette (UX-7). Client and server share the same allowlist.
 * `text` on stamp chat lines is the emoji for simple display / old clients.
 */
export const STAMP_CATALOG = [
  { id: 'thumbs', emoji: '👍', label: 'いいね' },
  { id: 'laugh', emoji: '😂', label: '笑う' },
  { id: 'fire', emoji: '🔥', label: '燃える' },
  { id: 'shock', emoji: '😱', label: 'びっくり' },
  { id: 'clap', emoji: '👏', label: '拍手' },
  { id: 'cry', emoji: '😢', label: '悲しい' },
  { id: 'think', emoji: '🤔', label: '考える' },
  { id: 'party', emoji: '🎉', label: 'やった' },
  { id: 'skull', emoji: '💀', label: '詰んだ' },
  { id: 'coyote', emoji: '🐺', label: 'コヨーテ' },
] as const

export type StampId = (typeof STAMP_CATALOG)[number]['id']

export const STAMP_IDS: readonly StampId[] = STAMP_CATALOG.map((s) => s.id)

export function isStampId(id: unknown): id is StampId {
  return typeof id === 'string' && (STAMP_IDS as readonly string[]).includes(id)
}

export function stampEmoji(id: StampId): string {
  const found = STAMP_CATALOG.find((s) => s.id === id)
  return found?.emoji ?? '❓'
}

// ---------------------------------------------------------------------------
// Wire protocol (subset used from P1-1; full set in phase1-multiplayer.md)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  playerId: string
  displayName: string
  /** Body text, or the stamp emoji when kind === 'stamp' */
  text: string
  /** epoch ms */
  ts: number
  /** Default / omit = normal text. Stamp lines also set stampId. */
  kind?: 'text' | 'stamp'
  /** Allowlisted stamp id when kind === 'stamp' */
  stampId?: StampId
}

export type ClientMessage =
  | {
      type: 'join'
      displayName: string
      resumeToken?: string
      /** Optional catalog index 0..AVATAR_COUNT-1; omitted → server assigns */
      avatarIndex?: number
    }
  | { type: 'ready'; ready: boolean }
  | { type: 'start' }
  | {
      type: 'action'
      actionId: string
      expectedRevision: number
      action: ClientGameAction
    }
  | { type: 'resume'; resumeToken: string }
  | { type: 'ping' }
  /** Client finished viewing challenge result UI */
  | { type: 'dismiss_result' }
  /** After game_over: reset room to lobby (same seats) */
  | { type: 'rematch' }
  /** Room chat (lobby + in-game) */
  | { type: 'chat'; text: string }
  /** Fixed stamp reaction (UX-7; stored in chat log + float on clients) */
  | { type: 'reaction'; stampId: StampId }
  /** Intentional leave (lobby: seat removed; playing: disconnect only) */
  | { type: 'leave' }
  /** Host only: dissolve room for everyone (lobby or in-game) */
  | { type: 'end_room' }
  /**
   * Host only, lobby only: set mountain deck composition for the next game.
   * Payload is a full DeckComposition (numbers + specials counts).
   */
  | { type: 'set_deck'; deck: WireDeckComposition }
  /**
   * Host only, lobby only: set extra rules toggles for the next game.
   */
  | { type: 'set_extra_rules'; extraRules: WireExtraRules }
  /**
   * Host only, lobby only: set turn time control for the next game.
   * `null` = unlimited (no clock).
   */
  | { type: 'set_time_control'; timeControl: WireTimeControl | null }

/** Wire shape of domain ExtraRulesConfig (turn actions only; 1/2 is deck). */
export interface WireExtraRules {
  same: boolean
  change: boolean
  reverse: boolean
  shot: boolean
  draw1: boolean
  lifeDouble: boolean
}

/**
 * Room time control (持ち時間 + 毎ターン一時時間).
 * Bank decreases first, then the per-turn temporary budget.
 * Example: mainSeconds=300, turnSeconds=20 → "5分 + 20秒".
 */
export interface WireTimeControl {
  /** Main bank in seconds (0 = no bank, only turn time). */
  mainSeconds: number
  /** Temporary seconds granted at the start of each turn. */
  turnSeconds: number
}

export type ClientBidExtra =
  | { type: 'reverse' }
  | { type: 'shot'; targetId: string }
  | { type: 'draw1'; targetId: string }
  | { type: 'life_double' }

export type ClientGameAction =
  | { type: 'PLACE_BID'; value: number; extra?: ClientBidExtra }
  | { type: 'SAME' }
  | { type: 'CHANGE' }
  | { type: 'CHALLENGE' }

/** Wire shape of domain DeckComposition (JSON-safe plain data). */
export interface WireDeckComposition {
  id?: string
  label?: string
  numbers: Array<{ value: number; count: number }>
  specials: {
    double: number
    half: number
    max_to_zero: number
    redraw: number
    zero_mix: number
  }
}

export type ServerMessage =
  | {
      type: 'hello'
      playerId: string
      resumeToken: string
      roomCode: string
      isHost: boolean
    }
  | {
      type: 'view'
      revision: number
      view: PlayerView
    }
  | {
      type: 'event'
      level?: 'info' | 'warn'
      message: string
      code?: string
      /** Optional impact FX for extra actions / same / change */
      fx?: {
        kind:
          | 'reverse'
          | 'shot'
          | 'draw1'
          | 'life_double'
          | 'same'
          | 'change'
        actorName?: string
        targetName?: string
        bidValue?: number
      }
    }
  | {
      type: 'error'
      code: string
      message: string
      actionId?: string
    }
  | { type: 'room_closed'; reason: string }
  | { type: 'pong' }
  /** Single new chat line (broadcast; does not bump revision) */
  | { type: 'chat'; message: ChatMessage }
  /** Recent history after join / resume */
  | { type: 'chat_history'; messages: ChatMessage[] }

/**
 * Masked per-player snapshot.
 * Hands (full Card) arrive only in P1-3 game payload rules — never own Card in play.
 */
export interface PlayerView {
  phase: 'lobby' | 'playing' | 'result' | 'closed'
  roomCode: string
  hostId: string | null
  players: PlayerViewMember[]
  selfPlayerId: string | null
  status: 'open' | 'playing' | 'closed'
  /** Host-only convenience: enough players and still in lobby */
  canStart: boolean
  playerCount: number
  maxPlayers: number
  /** Mountain deck recipe for the next / current game (lobby-configurable). */
  deck: WireDeckComposition
  /** Extra rules toggles for the next / current game (lobby-configurable). */
  extraRules: WireExtraRules
  /**
   * Turn time control for the next / current game (lobby-configurable).
   * `null` = unlimited.
   */
  timeControl: WireTimeControl | null
  /**
   * Live clock while playing with timeControl set.
   * Clients interpolate remaining from turnStartedAt + bank/temp.
   */
  clock?: import('./turnClock').WireClockSnapshot
  /** Masked game payload (own Card never included during play). */
  game?: import('./maskedView').MaskedGamePayload
  /** Challenge reveal — includes all hands (self OK). */
  pendingResult?: import('./maskedView').PendingResultSnapshot
}

export interface PlayerViewMember {
  id: string
  displayName: string
  ready: boolean
  connected: boolean
  isHost: boolean
  seatIndex?: number
  /** Client maps to avatar catalog */
  avatarIndex?: number
}

export type ErrorCode =
  | 'UNKNOWN_TYPE'
  | 'UNAUTHORIZED'
  | 'ROOM_FULL'
  | 'ROOM_NOT_FOUND'
  | 'GAME_ALREADY_STARTED'
  | 'NOT_ENOUGH_PLAYERS'
  | 'PLAYERS_NOT_READY'
  | 'REVISION_MISMATCH'
  | 'ILLEGAL_ACTION'
  | 'INVALID_TOKEN'
  | 'BAD_REQUEST'
  | 'NOT_IMPLEMENTED'
  | 'RATE_LIMITED'
  | 'CHAT_REJECTED'
