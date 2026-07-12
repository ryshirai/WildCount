import { describe, expect, it } from 'vitest'
import {
  applyAction,
  getLegalMoves,
  seedRandom,
  startGame,
  type GameState,
  type RandomSource,
} from '../../../src/domain/game'
import { randomInt } from '../../../src/domain/game/random'

const GAME_COUNT = 10_000
const MAX_STEPS_PER_GAME = 5_000

/**
 * Random legal play: bid slightly above minimum or challenge with rising odds.
 * Caps bids so games terminate.
 */
function playRandomLegal(
  state: GameState,
  rng: RandomSource,
): GameState {
  if (state.phase === 'game_over') return state

  if (state.phase === 'round_end' || state.phase === 'lobby') {
    return applyAction(state, { type: 'START_ROUND' }, rng)
  }

  if (state.phase !== 'bidding') {
    throw new Error(`Unexpected phase: ${state.phase}`)
  }

  const moves = getLegalMoves(state)
  if (moves.length === 0) {
    throw new Error('No legal moves in bidding phase')
  }

  const challenge = moves.find((m) => m.type === 'CHALLENGE')
  const bidMove = moves.find((m) => m.type === 'PLACE_BID')

  // Higher bids → more likely to challenge (and always challenge above cap)
  const bid = state.currentBid
  const cap = 80
  if (challenge && bid != null && bid >= cap) {
    return applyAction(state, { type: 'CHALLENGE' }, rng)
  }

  if (challenge && bid != null) {
    // Probability scales with bid size
    const p = Math.min(0.85, 0.15 + bid / 100)
    if (rng.next() < p) {
      return applyAction(state, { type: 'CHALLENGE' }, rng)
    }
  }

  if (!bidMove || bidMove.type !== 'PLACE_BID') {
    return applyAction(state, { type: 'CHALLENGE' }, rng)
  }

  const minV = bidMove.minValue
  // Prefer small raises to keep totals plausible
  const raise = randomInt(rng, 0, 5)
  const value = minV + raise
  return applyAction(state, { type: 'PLACE_BID', value }, rng)
}

function runOneGame(seed: number, playerCount: number): GameState {
  const rng = seedRandom(seed)
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i}`)
  let state = startGame(
    { playerIds: ids, config: { initialLives: 3 } },
    rng,
  )

  for (let step = 0; step < MAX_STEPS_PER_GAME; step++) {
    if (state.phase === 'game_over') return state
    state = playRandomLegal(state, rng)
  }

  throw new Error(
    `Game seed=${seed} players=${playerCount} did not finish in ${MAX_STEPS_PER_GAME} steps`,
  )
}

describe('simulation', () => {
  it(
    `runs ${GAME_COUNT} seeded games without exceptions`,
    () => {
      let totalRounds = 0
      const winners = new Map<string, number>()

      for (let i = 0; i < GAME_COUNT; i++) {
        // Mix player counts 2–10
        const playerCount = 2 + (i % 9)
        const final = runOneGame(i * 9973 + 42, playerCount)

        expect(final.phase).toBe('game_over')
        expect(final.winnerId).toBeTruthy()
        expect(final.players.filter((p) => p.alive)).toHaveLength(1)
        expect(final.players.find((p) => p.alive)!.id).toBe(final.winnerId)

        totalRounds += final.round
        winners.set(final.winnerId!, (winners.get(final.winnerId!) ?? 0) + 1)
      }

      // Sanity: games made progress
      expect(totalRounds).toBeGreaterThan(GAME_COUNT)
      // Determinism smoke: re-run first seed
      const a = runOneGame(42, 2)
      const b = runOneGame(42, 2)
      expect(a.winnerId).toBe(b.winnerId)
      expect(a.round).toBe(b.round)
    },
    120_000,
  )
})
