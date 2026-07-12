/**
 * Client-side mirror of worker wire protocol.
 * Keep in sync with worker/types.ts, worker/maskedView.ts, docs/phase1-multiplayer.md
 */

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

export interface WireCard {
  id: string
  kind: 'number' | 'double' | 'max_to_zero' | 'redraw' | 'zero_mix'
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
  handHidden: boolean
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
  turnsUntilSelf: number
  legalMoves: unknown[]
  isGameOver: boolean
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
      maxToZeroApplied: boolean
      rawNumberSum: number
    }
    bidderWins: boolean
    loserRole: 'bidder' | 'challenger'
    loserId: string
    bidderId: string
    challengerId: string
  }
  hands: Record<string, WireCard>
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
