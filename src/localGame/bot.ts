import {
  getLegalMoves,
  type GameAction,
  type GameState,
  type RandomSource,
} from '@/domain/game'

/**
 * Simple bot policy for local demo:
 * - No bid yet → place min opening bid
 * - Bid exists → ~30% CHALLENGE, else RAISE in [min, min+3]
 */
export function chooseBotAction(state: GameState, rng: RandomSource): GameAction {
  const moves = getLegalMoves(state)
  const bidMove = moves.find((m) => m.type === 'PLACE_BID')
  const canChallenge = moves.some((m) => m.type === 'CHALLENGE')

  if (!bidMove || bidMove.type !== 'PLACE_BID') {
    throw new Error('Bot has no legal PLACE_BID (unexpected)')
  }

  if (!canChallenge) {
    return { type: 'PLACE_BID', value: bidMove.minValue }
  }

  if (rng.next() < 0.3) {
    return { type: 'CHALLENGE' }
  }

  const extra = Math.floor(rng.next() * 4) // 0..3
  return { type: 'PLACE_BID', value: bidMove.minValue + extra }
}
