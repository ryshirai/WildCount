import type {
  BidExtraAction,
  ExtraRulesConfig,
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

export function hasUsedExtraAction(state: GameState, playerId: PlayerId): boolean {
  return state.extraActionUsedThisRound.includes(playerId)
}

function extras(state: GameState): ExtraRulesConfig {
  return state.config.extraRules
}

function isForcedRebid(state: GameState): boolean {
  return (
    state.pendingChangeRebid != null &&
    state.currentTurnPlayerId === state.pendingChangeRebid.playerId
  )
}

/** Min legal bid value for current turn (normal or forced rebid). */
export function minBidValue(state: GameState): number {
  const rebid = state.pendingChangeRebid
  if (rebid && state.currentTurnPlayerId === rebid.playerId) {
    if (rebid.minExclusive != null) {
      return rebid.minExclusive + 1
    }
    return state.config.minOpeningBid
  }
  if (state.currentBid == null) {
    return state.config.minOpeningBid
  }
  return state.currentBid + 1
}

export function canPlaceBid(state: GameState, value: number): boolean {
  if (state.phase !== 'bidding') return false
  if (state.currentTurnPlayerId == null) return false
  if (!Number.isInteger(value)) return false

  const rebid = state.pendingChangeRebid
  if (rebid && state.currentTurnPlayerId === rebid.playerId) {
    if (value === rebid.forbiddenValue) return false
    if (rebid.minExclusive != null) {
      return value > rebid.minExclusive
    }
    return value >= state.config.minOpeningBid
  }

  // Forced rebid is for another player — this player cannot bid
  if (rebid) return false

  if (state.currentBid == null) {
    return value >= state.config.minOpeningBid
  }
  return value > state.currentBid
}

export function canChallenge(state: GameState): boolean {
  if (state.phase !== 'bidding') return false
  if (state.currentBid == null || state.currentBidderId == null) return false
  if (state.currentTurnPlayerId == null) return false
  if (isForcedRebid(state)) return false
  return true
}

export function canSame(state: GameState): boolean {
  if (!extras(state).same) return false
  if (state.phase !== 'bidding') return false
  if (state.currentBid == null || state.currentBidderId == null) return false
  if (state.currentTurnPlayerId == null) return false
  if (isForcedRebid(state)) return false
  // Same is a special ability: 1 personal slot per round
  if (hasUsedExtraAction(state, state.currentTurnPlayerId)) return false
  // Consecutive same still forbidden (two different players)
  if (state.lastAction === 'same') return false
  return true
}

export function canChange(state: GameState): boolean {
  if (!extras(state).change) return false
  if (state.phase !== 'bidding') return false
  if (state.currentBid == null || state.currentBidderId == null) return false
  if (state.currentTurnPlayerId == null) return false
  if (isForcedRebid(state)) return false
  // Previous bidder must still be alive
  const bidder = getPlayer(state, state.currentBidderId)
  if (!bidder?.alive) return false
  if (hasUsedExtraAction(state, state.currentTurnPlayerId)) return false
  return true
}

/** Whether the current player may attach a bid extra of this kind. */
export function canAttachExtra(
  state: GameState,
  extra: BidExtraAction,
): boolean {
  if (state.phase !== 'bidding') return false
  if (state.currentTurnPlayerId == null) return false
  if (isForcedRebid(state)) return false
  if (hasUsedExtraAction(state, state.currentTurnPlayerId)) return false

  const er = extras(state)
  const actor = state.currentTurnPlayerId

  switch (extra.type) {
    case 'reverse':
      return er.reverse
    case 'life_double':
      return er.lifeDouble
    case 'shot': {
      if (!er.shot) return false
      if (extra.targetId === actor) return false
      const t = getPlayer(state, extra.targetId)
      return t != null && t.alive
    }
    case 'draw1': {
      if (!er.draw1) return false
      if (state.draw1UsedThisRound) return false
      if (extra.targetId === actor) return false
      const t = getPlayer(state, extra.targetId)
      return t != null && t.alive
    }
    default:
      return false
  }
}

/**
 * Legal moves for the current turn player.
 * MVP (all extras OFF): PLACE_BID and (if bid exists) CHALLENGE.
 */
export function getLegalMoves(state: GameState): LegalMove[] {
  if (state.phase !== 'bidding' || state.currentTurnPlayerId == null) {
    return []
  }

  const moves: LegalMove[] = []
  const rebid = state.pendingChangeRebid
  const forced =
    rebid != null && state.currentTurnPlayerId === rebid.playerId

  if (forced) {
    moves.push({
      type: 'PLACE_BID',
      minValue: minBidValue(state),
      forbiddenValue: rebid!.forbiddenValue,
      extrasAllowed: false,
    })
    return moves
  }

  // Normal turn
  const extrasAllowed =
    !hasUsedExtraAction(state, state.currentTurnPlayerId) &&
    (extras(state).reverse ||
      extras(state).shot ||
      extras(state).draw1 ||
      extras(state).lifeDouble)

  if (state.currentBid == null) {
    moves.push({
      type: 'PLACE_BID',
      minValue: state.config.minOpeningBid,
      extrasAllowed,
    })
  } else {
    moves.push({
      type: 'PLACE_BID',
      minValue: state.currentBid + 1,
      extrasAllowed,
    })
    moves.push({ type: 'CHALLENGE' })
    if (canSame(state)) moves.push({ type: 'SAME' })
    if (canChange(state)) moves.push({ type: 'CHANGE' })
  }

  return moves
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
    case 'PLACE_BID': {
      if (state.phase !== 'bidding') return 'Not in bidding phase'
      if (!canPlaceBid(state, action.value)) {
        const rebid = state.pendingChangeRebid
        if (rebid && state.currentTurnPlayerId === rebid.playerId) {
          if (action.value === rebid.forbiddenValue) {
            return `Cannot redeclare the same value ${rebid.forbiddenValue}`
          }
          if (rebid.minExclusive != null) {
            return `Rebid must be an integer > ${rebid.minExclusive} and ≠ ${rebid.forbiddenValue}`
          }
          return `Rebid must be an integer >= ${state.config.minOpeningBid} and ≠ ${rebid.forbiddenValue}`
        }
        if (state.currentBid == null) {
          return `Opening bid must be an integer >= ${state.config.minOpeningBid}`
        }
        return `Bid must be an integer > ${state.currentBid}`
      }
      if (action.extra) {
        if (!canAttachExtra(state, action.extra)) {
          return 'Cannot attach that extra action'
        }
      }
      return null
    }
    case 'SAME':
      if (!canSame(state)) {
        if (!extras(state).same) return 'Same rule is off'
        if (
          state.currentTurnPlayerId &&
          hasUsedExtraAction(state, state.currentTurnPlayerId)
        ) {
          return 'Personal action already used this round'
        }
        if (state.lastAction === 'same') return 'Cannot same twice in a row'
        if (state.currentBid == null) return 'No bid to same'
        return 'Cannot same now'
      }
      return null
    case 'CHANGE':
      if (!canChange(state)) {
        if (!extras(state).change) return 'Change rule is off'
        if (hasUsedExtraAction(state, state.currentTurnPlayerId ?? '')) {
          return 'Personal action already used this round'
        }
        if (state.currentBid == null) return 'No bid to change'
        return 'Cannot change now'
      }
      return null
    case 'CHALLENGE':
      if (!canChallenge(state)) {
        if (isForcedRebid(state)) return 'Must redeclare bid (change)'
        if (state.currentBid == null) return 'No bid to challenge'
        return 'Cannot challenge now'
      }
      return null
    default:
      return 'Unknown action'
  }
}
