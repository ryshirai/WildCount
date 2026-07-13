import {
  cardLabel,
  getLegalMoves,
  minBidValue,
  type GameState,
  type PlayerId,
} from '@/domain/game'
import type { EventLogItem, GameRoomMock, PlayerSeat } from '@/types/game'
import { getProfile, type PlayerProfile, SELF_ID } from '@/localGame/profiles'

/** Session-side bid history for the current (or last) bidding round. */
export interface BidHistoryEntry {
  playerId: PlayerId
  value: number
  /** Domain round number when the bid was placed */
  round: number
}

export interface ToGameViewInput {
  state: GameState
  selfId?: PlayerId
  profiles?: readonly PlayerProfile[]
  bidHistory?: readonly BidHistoryEntry[]
  eventLog?: readonly EventLogItem[]
  roomCode?: string
}

export interface GameViewModel extends GameRoomMock {
  phase: GameState['phase']
  winnerId: PlayerId | null
  isSelfTurn: boolean
  minBid: number
  canDeclare: boolean
  canChallenge: boolean
  canSame: boolean
  canChange: boolean
  extrasAllowed: boolean
  forbiddenBidValue: number | null
  allowReverse: boolean
  allowShot: boolean
  allowDraw1: boolean
  allowLifeDouble: boolean
  isGameOver: boolean
}

/**
 * Map pure domain GameState + session extras → UI GameRoomMock (+ control flags).
 *
 * Card visibility (Indian poker / Coyote):
 * - Own hand is always hidden from the local player (`handHidden: true`)
 * - Other players' hands are face-up for the local player
 */
export function toGameView(input: ToGameViewInput): GameViewModel {
  const {
    state,
    selfId = SELF_ID,
    profiles,
    bidHistory = [],
    eventLog = [],
    roomCode = 'LOCAL',
  } = input

  const aliveOrdered = [...state.players]
    .filter((p) => p.alive)
    .sort((a, b) => a.seatIndex - b.seatIndex)

  const currentRoundBids = bidHistory.filter((b) => b.round === state.round)
  const bidByPlayer = new Map<PlayerId, number>()
  for (const b of currentRoundBids) {
    bidByPlayer.set(b.playerId, b.value)
  }
  // Always reflect the live current bidder even if history is thin
  if (state.currentBidderId != null && state.currentBid != null) {
    bidByPlayer.set(state.currentBidderId, state.currentBid)
  }

  const players: PlayerSeat[] = [...state.players]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((p) => {
      const profile = getProfile(p.id, profiles)
      const bid = bidByPlayer.get(p.id) ?? null
      const isSelf = p.id === selfId
      const hand = state.hands[p.id]
      const handLabels =
        p.alive && hand && hand.length > 0
          ? hand.map((c) => cardLabel(c))
          : []
      return {
        id: p.id,
        // UI mock used 1-based seat badges
        seatIndex: p.seatIndex + 1,
        name: profile.name,
        avatar: profile.avatar,
        avatarSrc: profile.avatarSrc,
        avatarId: profile.avatarId,
        bid: p.alive ? bid : null,
        hasDeclared: p.alive && bid != null,
        isSelf,
        isCurrentTurn: p.alive && state.currentTurnPlayerId === p.id,
        lives: p.lives,
        // Indian poker: self never sees own face; others are visible
        handLabels,
        handLabel: handLabels.length > 0 ? handLabels.join(' ') : null,
        handCount: handLabels.length,
        handHidden: isSelf,
      }
    })

  const turnsUntilSelf = computeTurnsUntilSelf(
    aliveOrdered.map((p) => p.id),
    state.currentTurnPlayerId,
    selfId,
  )

  const isSelfTurn =
    state.phase === 'bidding' && state.currentTurnPlayerId === selfId
  const legal = isSelfTurn ? getLegalMoves(state) : []
  const bidMove = legal.find((m) => m.type === 'PLACE_BID')
  const minBid =
    bidMove && bidMove.type === 'PLACE_BID'
      ? bidMove.minValue
      : minBidValue(state)
  const canDeclare = isSelfTurn && bidMove != null
  const canChallenge = isSelfTurn && legal.some((m) => m.type === 'CHALLENGE')
  const canSame = isSelfTurn && legal.some((m) => m.type === 'SAME')
  const canChange = isSelfTurn && legal.some((m) => m.type === 'CHANGE')
  const extrasAllowed =
    bidMove != null && bidMove.type === 'PLACE_BID' && bidMove.extrasAllowed
  const forbiddenBidValue =
    bidMove && bidMove.type === 'PLACE_BID'
      ? (bidMove.forbiddenValue ?? null)
      : null
  const er = state.config.extraRules

  return {
    roomCode,
    playerCount: state.players.length,
    round: state.round,
    currentBid: state.currentBid,
    turnsUntilSelf,
    players,
    eventLog: [...eventLog],
    draftBid: minBid,
    connectionStatus: 'good',
    phase: state.phase,
    winnerId: state.winnerId,
    isSelfTurn,
    minBid,
    canDeclare,
    canChallenge,
    canSame,
    canChange,
    extrasAllowed,
    forbiddenBidValue,
    allowReverse: er.reverse,
    allowShot: er.shot,
    allowDraw1: er.draw1,
    allowLifeDouble: er.lifeDouble,
    isGameOver: state.phase === 'game_over',
  }
}

/**
 * Seats from current turn to self (exclusive of current if self).
 * 0 when it is already self's turn or self is not in the alive ring.
 */
export function computeTurnsUntilSelf(
  aliveIdsInSeatOrder: readonly PlayerId[],
  currentTurnPlayerId: PlayerId | null,
  selfId: PlayerId,
): number {
  if (currentTurnPlayerId == null || aliveIdsInSeatOrder.length === 0) return 0
  if (currentTurnPlayerId === selfId) return 0

  const n = aliveIdsInSeatOrder.length
  const start = aliveIdsInSeatOrder.indexOf(currentTurnPlayerId)
  const selfIdx = aliveIdsInSeatOrder.indexOf(selfId)
  if (start < 0 || selfIdx < 0) return 0

  return (selfIdx - start + n) % n
}
