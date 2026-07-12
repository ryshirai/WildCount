/**
 * Build per-player masked game payloads (no own Card during play).
 * Pure functions — unit-tested without DO runtime.
 */

import {
  cardLabel,
  getLegalMoves,
  type Card,
  type ChallengeOutcome,
  type GameState,
  type LegalMove,
  type PlayerId,
} from '../src/domain/game'
import type { RoomPlayer } from './roomLogic'
import type { PlayerView } from './types'

export interface BidHistoryEntry {
  playerId: string
  value: number
  round: number
}

/** Wire Card (never include for self during bidding). */
export interface WireCard {
  id: string
  kind: Card['kind']
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
  /** Present only for others (or self when revealAll). */
  hand: WireCard | null
  handHidden: boolean
  connected: boolean
  isHost: boolean
}

export interface MaskedGamePayload {
  phase: GameState['phase']
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
  legalMoves: LegalMove[]
  isGameOver: boolean
}

export interface PendingResultSnapshot {
  round: number
  outcome: ChallengeOutcome
  /** Full hands at challenge time — includes everyone's cards for result UI */
  hands: Record<string, WireCard>
  winnerId: string | null
  bidderId: string
  challengerId: string
  loserId: string
}

export function cardToWire(card: Card): WireCard {
  return {
    id: card.id,
    kind: card.kind,
    value: card.value,
    label: cardLabel(card),
  }
}

export function buildMaskedGame(
  game: GameState,
  selfPlayerId: string | null,
  roomPlayers: readonly RoomPlayer[],
  bidHistory: readonly BidHistoryEntry[],
  hostId: string | null,
): MaskedGamePayload {
  const profileById = new Map(roomPlayers.map((p) => [p.id, p]))

  const currentRoundBids = bidHistory.filter((b) => b.round === game.round)
  const bidByPlayer = new Map<string, number>()
  for (const b of currentRoundBids) {
    bidByPlayer.set(b.playerId, b.value)
  }
  if (game.currentBidderId != null && game.currentBid != null) {
    bidByPlayer.set(game.currentBidderId, game.currentBid)
  }

  const seats: MaskedSeat[] = [...game.players]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((p) => {
      const roomP = profileById.get(p.id)
      const isSelf = p.id === selfPlayerId
      const hand = game.hands[p.id]
      const bid = p.alive ? (bidByPlayer.get(p.id) ?? null) : null
      // Mask: never send own card face during play
      const showHand = p.alive && hand != null && !isSelf
      return {
        id: p.id,
        seatIndex: p.seatIndex,
        displayName: roomP?.displayName ?? p.id.slice(0, 8),
        avatarIndex: roomP?.avatarIndex ?? 0,
        lives: p.lives,
        alive: p.alive,
        bid,
        hasDeclared: p.alive && bid != null,
        isSelf,
        isCurrentTurn: p.alive && game.currentTurnPlayerId === p.id,
        hand: showHand ? cardToWire(hand) : null,
        handHidden: isSelf,
        connected: roomP?.connected ?? false,
        isHost: p.id === hostId,
      }
    })

  const aliveOrdered = [...game.players]
    .filter((p) => p.alive)
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((p) => p.id)

  const turnsUntilSelf = computeTurnsUntilSelf(
    aliveOrdered,
    game.currentTurnPlayerId,
    selfPlayerId,
  )

  const minBid =
    game.currentBid == null
      ? game.config.minOpeningBid
      : game.currentBid + 1

  const isMyTurn =
    selfPlayerId != null &&
    game.phase === 'bidding' &&
    game.currentTurnPlayerId === selfPlayerId

  const legalMoves =
    isMyTurn && selfPlayerId != null ? getLegalMoves(game) : []

  return {
    phase: game.phase,
    round: game.round,
    currentBid: game.currentBid,
    currentBidderId: game.currentBidderId,
    currentTurnPlayerId: game.currentTurnPlayerId,
    winnerId: game.winnerId,
    seats,
    minBid,
    isMyTurn,
    canDeclare: isMyTurn,
    canChallenge:
      isMyTurn && game.currentBid != null && game.currentBidderId != null,
    turnsUntilSelf,
    legalMoves,
    isGameOver: game.phase === 'game_over',
  }
}

export function buildPendingResultSnapshot(args: {
  outcome: ChallengeOutcome
  hands: Readonly<Record<PlayerId, Card>>
  round: number
  winnerId: string | null
}): PendingResultSnapshot {
  const hands: Record<string, WireCard> = {}
  for (const [id, card] of Object.entries(args.hands)) {
    hands[id] = cardToWire(card)
  }
  return {
    round: args.round,
    outcome: args.outcome,
    hands,
    winnerId: args.winnerId,
    bidderId: args.outcome.bidderId,
    challengerId: args.outcome.challengerId,
    loserId: args.outcome.loserId,
  }
}

/** Ensure serialized view JSON never embeds self card id during play. */
export function assertNoSelfHandLeak(
  gamePayload: MaskedGamePayload,
  selfPlayerId: string,
): void {
  const self = gamePayload.seats.find((s) => s.id === selfPlayerId)
  if (!self) return
  if (self.hand != null) {
    throw new Error('Self hand must not be present in masked game payload')
  }
}

export function computeTurnsUntilSelf(
  aliveIdsInSeatOrder: readonly string[],
  currentTurnPlayerId: string | null,
  selfId: string | null,
): number {
  if (
    currentTurnPlayerId == null ||
    selfId == null ||
    aliveIdsInSeatOrder.length === 0
  ) {
    return 0
  }
  if (currentTurnPlayerId === selfId) return 0
  const n = aliveIdsInSeatOrder.length
  const start = aliveIdsInSeatOrder.indexOf(currentTurnPlayerId)
  const selfIdx = aliveIdsInSeatOrder.indexOf(selfId)
  if (start < 0 || selfIdx < 0) return 0
  return (selfIdx - start + n) % n
}

export function viewPhase(
  roomStatus: 'open' | 'playing' | 'closed',
  pendingResult: unknown | null,
  game: GameState | null,
): PlayerView['phase'] {
  if (roomStatus === 'closed') return 'closed'
  if (roomStatus === 'open') return 'lobby'
  if (pendingResult != null) return 'result'
  if (game?.phase === 'game_over') return 'playing' // game_over still "playing" shell; flag on game
  return 'playing'
}
