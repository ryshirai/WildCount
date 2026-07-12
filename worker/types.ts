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

/** Idle TTL when nobody is connected (ms). */
export const IDLE_TTL_OPEN_MS = 10 * 60 * 1000
export const IDLE_TTL_PLAYING_MS = 30 * 60 * 1000

/** Room chat (UX-6): max body length, ring buffer, per-player cooldown. */
export const MAX_CHAT_TEXT_LENGTH = 120
export const MAX_CHAT_HISTORY = 50
export const CHAT_COOLDOWN_MS = 800

// ---------------------------------------------------------------------------
// Wire protocol (subset used from P1-1; full set in phase1-multiplayer.md)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  playerId: string
  displayName: string
  text: string
  /** epoch ms */
  ts: number
}

export type ClientMessage =
  | { type: 'join'; displayName: string; resumeToken?: string }
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
  /** Intentional leave (lobby: seat removed; playing: disconnect only) */
  | { type: 'leave' }

export type ClientGameAction =
  | { type: 'PLACE_BID'; value: number }
  | { type: 'CHALLENGE' }

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
