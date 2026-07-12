import type {
  GameAction,
  GameState,
  LegalMove,
  Player,
  PlayerId,
} from './types'
import { alivePlayers } from './resolve'

export function getPlayer(state: GameState, id: PlayerId): Player | undefined {
  return state.players.find((p) => p.id === id)
}

export function isPlayersTurn(state: GameState, playerId: PlayerId): boolean {
  return state.currentTurnPlayerId === playerId
}

/**
 * Legal moves for the current turn player.
 * Phase 0 MVP: no pass — only PLACE_BID and (if a bid exists) CHALLENGE.
 */
export function getLegalMoves(state: GameState): LegalMove[] {
  if (state.phase !== 'bidding' || state.currentTurnPlayerId == null) {
    return []
  }

  const moves: LegalMove[] = []

  if (state.currentBid == null) {
    moves.push({ type: 'PLACE_BID', minValue: state.config.minOpeningBid })
  } else {
    moves.push({ type: 'PLACE_BID', minValue: state.currentBid + 1 })
    moves.push({ type: 'CHALLENGE' })
  }

  return moves
}

export function canPlaceBid(state: GameState, value: number): boolean {
  if (state.phase !== 'bidding') return false
  if (state.currentTurnPlayerId == null) return false
  if (state.currentBid == null) {
    return Number.isInteger(value) && value >= state.config.minOpeningBid
  }
  return Number.isInteger(value) && value > state.currentBid
}

export function canChallenge(state: GameState): boolean {
  return (
    state.phase === 'bidding' &&
    state.currentBid != null &&
    state.currentBidderId != null &&
    state.currentTurnPlayerId != null
  )
}

export function describeIllegal(
  state: GameState,
  action: GameAction,
): string | null {
  switch (action.type) {
    case 'START_GAME':
      return state.phase === 'lobby' ? null : 'Game already started'
    case 'START_ROUND':
      if (state.phase === 'game_over') return 'Game is over'
      if (state.phase !== 'lobby' && state.phase !== 'round_end') {
        return `Cannot start round in phase ${state.phase}`
      }
      if (alivePlayers(state.players).length < 2) {
        return 'Need at least 2 living players'
      }
      return null
    case 'PLACE_BID':
      if (state.phase !== 'bidding') return 'Not in bidding phase'
      if (!canPlaceBid(state, action.value)) {
        if (state.currentBid == null) {
          return `Opening bid must be an integer >= ${state.config.minOpeningBid}`
        }
        return `Bid must be an integer > ${state.currentBid}`
      }
      return null
    case 'CHALLENGE':
      if (!canChallenge(state)) {
        if (state.currentBid == null) return 'No bid to challenge'
        return 'Cannot challenge now'
      }
      return null
    default:
      return 'Unknown action'
  }
}
