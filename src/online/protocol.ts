/**
 * Client-side mirror of worker wire protocol.
 * Keep in sync with worker/types.ts, worker/maskedView.ts, docs/phase1-multiplayer.md
 */

import type { StampId } from './stamps'

export type { StampId } from './stamps'

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
  | { type: 'dismiss_result' }
  | { type: 'rematch' }
  | { type: 'chat'; text: string }
  | { type: 'reaction'; stampId: StampId }
  | { type: 'leave' }
  /** Host only: dissolve room for everyone */
  | { type: 'end_room' }
  /** Host only, lobby: set mountain deck composition */
  | { type: 'set_deck'; deck: WireDeckComposition }
  /** Host only, lobby: set extra rules toggles */
  | { type: 'set_extra_rules'; extraRules: WireExtraRules }
  /** Host only, lobby: set turn time control (`null` = unlimited) */
  | { type: 'set_time_control'; timeControl: WireTimeControl | null }

/** Mirror of worker / domain ExtraRulesConfig (turn actions only; 1/2 is deck). */
export interface WireExtraRules {
  same: boolean
  change: boolean
  reverse: boolean
  shot: boolean
  draw1: boolean
  lifeDouble: boolean
}

/**
 * Room time control: main bank + per-turn temporary time.
 * Bank decreases first, then the temporary budget.
 */
export interface WireTimeControl {
  mainSeconds: number
  turnSeconds: number
}

/** Live clock snapshot from the server (absolute times for client animation). */
export interface WireClockSnapshot {
  bankMsByPlayer: Record<string, number>
  currentTurnPlayerId: string | null
  turnStartedAt: number | null
  bankAtTurnStartMs: number
  turnBonusMs: number
  deadlineAt: number | null
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

/** Mirror of worker WireDeckComposition / domain DeckComposition. */
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
      /** Optional impact FX for 特殊能力 / セイム / チェンジ */
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
  | { type: 'chat'; message: ChatMessage }
  | { type: 'chat_history'; messages: ChatMessage[] }

export interface WireCard {
  id: string
  kind: 'number' | 'double' | 'half' | 'max_to_zero' | 'redraw' | 'zero_mix'
  value?: number
  label: string
}

export interface MaskedSeat {
  id: string
  seatIndex: number
  displayName: string
  avatarIndex: number
  lives: number
  alive: boolean
  bid: number | null
  hasDeclared: boolean
  isSelf: boolean
  isCurrentTurn: boolean
  hand: WireCard | null
  hands?: WireCard[]
  handHidden: boolean
  handCount?: number
  connected: boolean
  isHost: boolean
}

export interface MaskedGamePayload {
  phase: string
  round: number
  currentBid: number | null
  currentBidderId: string | null
  currentTurnPlayerId: string | null
  winnerId: string | null
  seats: MaskedSeat[]
  minBid: number
  isMyTurn: boolean
  canDeclare: boolean
  canChallenge: boolean
  canSame?: boolean
  canChange?: boolean
  turnsUntilSelf: number
  legalMoves: unknown[]
  isGameOver: boolean
  pendingChangeRebid?: {
    playerId: string
    forbiddenValue: number
    minExclusive: number | null
    resumeNextPlayerId: string
  } | null
  turnDirection?: 1 | -1
  pendingLifeDouble?: boolean
  draw1UsedThisRound?: boolean
  extraActionUsedThisRound?: readonly string[]
}

export interface PendingResultSnapshot {
  round: number
  outcome: {
    bid: number
    actualTotal: number
    calculation: {
      steps: Array<{
        id: string
        title: string
        detail: string
        totalAfter?: number
      }>
      finalTotal: number
      adjustedCards: unknown[]
      doubleCount: number
      halfCount?: number
      maxToZeroApplied: boolean
      rawNumberSum: number
    }
    bidderWins: boolean
    loserRole: 'bidder' | 'challenger'
    loserId: string
    bidderId: string
    challengerId: string
    lifeLoss?: number
  }
  /** Per player: one or more revealed cards */
  hands: Record<string, WireCard | WireCard[]>
  winnerId: string | null
  bidderId: string
  challengerId: string
  loserId: string
}

export interface PlayerView {
  phase: 'lobby' | 'playing' | 'result' | 'closed'
  roomCode: string
  hostId: string | null
  players: PlayerViewMember[]
  selfPlayerId: string | null
  status: 'open' | 'playing' | 'closed'
  canStart: boolean
  playerCount: number
  maxPlayers: number
  /** Mountain deck for next game (host can edit in lobby) */
  deck: WireDeckComposition
  /** Extra rules toggles for next game (host can edit in lobby) */
  extraRules: WireExtraRules
  /** Turn time control (`null` = unlimited) */
  timeControl: WireTimeControl | null
  /** Live clock while playing with timeControl set */
  clock?: WireClockSnapshot
  game?: MaskedGamePayload
  pendingResult?: PendingResultSnapshot
}

export interface PlayerViewMember {
  id: string
  displayName: string
  ready: boolean
  connected: boolean
  isHost: boolean
  seatIndex?: number
  avatarIndex?: number
}
