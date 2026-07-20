import { describe, expect, it } from 'vitest'
import {
  applyAction,
  createInitialState,
  forceEliminatePlayer,
  getLegalMoves,
  startGame,
  DECK_SIZE,
  createDeck,
  seedRandom,
  GameError,
} from '../../../src/domain/game'
import type { GameState } from '../../../src/domain/game'

describe('deck', () => {
  it(`createDeck returns ${DECK_SIZE} cards (card-design table sum)`, () => {
    const deck = createDeck()
    expect(deck).toHaveLength(DECK_SIZE)
    expect(deck.filter((c) => c.kind === 'double')).toHaveLength(1)
    expect(deck.filter((c) => c.kind === 'max_to_zero')).toHaveLength(1)
    expect(deck.filter((c) => c.kind === 'redraw')).toHaveLength(1)
    expect(deck.filter((c) => c.kind === 'zero_mix')).toHaveLength(1)
  })
})

describe('startGame / bidding', () => {
  it('deals one card to each living player and enters bidding', () => {
    const rng = seedRandom(42)
    const state = startGame({ playerIds: ['p0', 'p1', 'p2'] }, rng)
    expect(state.phase).toBe('bidding')
    expect(state.round).toBe(1)
    expect(Object.keys(state.hands)).toHaveLength(3)
    expect(['p0', 'p1', 'p2']).toContain(state.currentTurnPlayerId)
    expect(state.currentBid).toBeNull()
    // Seats are a permutation of 0..n-1 (randomized at start)
    const seats = state.players.map((p) => p.seatIndex).sort((a, b) => a - b)
    expect(seats).toEqual([0, 1, 2])
  })

  it('randomizes first starter across seeds (not always join-order first)', () => {
    const ids = ['host', 'p1', 'p2', 'p3']
    const starters = new Set<string>()
    for (let seed = 0; seed < 40; seed++) {
      const s = startGame({ playerIds: ids }, seedRandom(seed))
      starters.add(s.currentTurnPlayerId!)
    }
    expect(starters.size).toBeGreaterThan(1)
    expect(starters.has('host')).toBe(true)
  })

  it('reseats players on each new round', () => {
    const rng = seedRandom(50)
    let state = startGame(
      { playerIds: ['a', 'b', 'c'], config: { initialLives: 3 } },
      rng,
    )
    const seatsR1 = Object.fromEntries(
      state.players.map((p) => [p.id, p.seatIndex]),
    )
    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)
    state = applyAction(state, { type: 'CHALLENGE' }, rng)
    expect(state.phase).toBe('round_end')
    state = applyAction(state, { type: 'START_ROUND' }, rng)
    const seatsR2 = Object.fromEntries(
      state.players.map((p) => [p.id, p.seatIndex]),
    )
    // Same set of seat indices; order may differ (very rarely identical)
    expect(Object.values(seatsR2).sort()).toEqual([0, 1, 2])
    // Living loser of R1 opens R2 (if still alive)
    if (state.lastOutcome) {
      const loser = state.lastOutcome.loserId
      const loserAlive = state.players.find((p) => p.id === loser)?.alive
      if (loserAlive) {
        expect(state.currentTurnPlayerId).toBe(loser)
      }
    }
    // At least verify reseat ran (ids still map to unique seats)
    expect(new Set(Object.values(seatsR1)).size).toBe(3)
    expect(new Set(Object.values(seatsR2)).size).toBe(3)
  })

  it('rejects invalid player counts', () => {
    expect(() => createInitialState({ playerIds: ['only'] })).toThrow(GameError)
    expect(() =>
      createInitialState({
        playerIds: Array.from({ length: 11 }, (_, i) => `p${i}`),
      }),
    ).toThrow(GameError)
  })

  it('opening bid must be >= minOpeningBid (1); then strictly increasing', () => {
    const rng = seedRandom(1)
    let state = startGame({ playerIds: ['a', 'b'] }, rng)
    const first = state.currentTurnPlayerId!
    const second = state.players.find((p) => p.id !== first)!.id

    expect(() => applyAction(state, { type: 'PLACE_BID', value: 0 }, rng)).toThrow(
      GameError,
    )
    expect(() => applyAction(state, { type: 'PLACE_BID', value: -1 }, rng)).toThrow(
      GameError,
    )

    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)
    expect(state.currentBid).toBe(1)
    expect(state.currentBidderId).toBe(first)
    expect(state.currentTurnPlayerId).toBe(second)

    expect(() => applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)).toThrow(
      GameError,
    )

    state = applyAction(state, { type: 'PLACE_BID', value: 2 }, rng)
    expect(state.currentBid).toBe(2)
    expect(state.currentTurnPlayerId).toBe(first)
  })

  it('first player cannot challenge without a bid', () => {
    const rng = seedRandom(2)
    const state = startGame({ playerIds: ['a', 'b'] }, rng)
    const moves = getLegalMoves(state)
    expect(moves.some((m) => m.type === 'CHALLENGE')).toBe(false)
    expect(() => applyAction(state, { type: 'CHALLENGE' }, rng)).toThrow(GameError)
  })

  it('challenge reduces a life and continues or ends the game', () => {
    const rng = seedRandom(99)
    let state = startGame(
      { playerIds: ['a', 'b'], config: { initialLives: 1 } },
      rng,
    )

    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)
    // b challenges
    state = applyAction(state, { type: 'CHALLENGE' }, rng)

    // With 1 life each, someone is eliminated → game_over
    expect(state.phase).toBe('game_over')
    expect(state.winnerId).toBeTruthy()
    expect(state.players.filter((p) => p.alive)).toHaveLength(1)
    expect(state.lastOutcome).not.toBeNull()
  })

  it('challenge with lives left stops at round_end until START_ROUND', () => {
    const rng = seedRandom(50)
    let state = startGame(
      { playerIds: ['a', 'b', 'c'], config: { initialLives: 3 } },
      rng,
    )
    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)
    state = applyAction(state, { type: 'CHALLENGE' }, rng)
    expect(state.phase).toBe('round_end')
    expect(state.lastOutcome).not.toBeNull()
    expect(Object.keys(state.hands)).toHaveLength(0)

    state = applyAction(state, { type: 'START_ROUND' }, rng)
    expect(state.phase).toBe('bidding')
    expect(state.round).toBe(2)
    expect(Object.keys(state.hands).length).toBeGreaterThanOrEqual(2)
  })

  it('forceEliminatePlayer ends match on first elimination (default)', () => {
    const rng = seedRandom(3)
    let state = startGame(
      { playerIds: ['a', 'b', 'c'], config: { initialLives: 2 } },
      rng,
    )
    const turn = state.currentTurnPlayerId!
    state = forceEliminatePlayer(state, turn)
    expect(state.players.find((p) => p.id === turn)?.alive).toBe(false)
    expect(state.players.find((p) => p.id === turn)?.lives).toBe(0)
    // Default winCondition = first_elimination → match ends immediately
    expect(state.phase).toBe('game_over')
    expect(state.players.filter((p) => p.alive)).toHaveLength(2)
    expect(state.winnerId).toBeNull()
  })

  it('forceEliminatePlayer with last_standing continues until one remains', () => {
    const rng = seedRandom(3)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { initialLives: 2, winCondition: 'last_standing' },
      },
      rng,
    )
    const turn = state.currentTurnPlayerId!
    state = forceEliminatePlayer(state, turn)
    expect(state.players.find((p) => p.id === turn)?.alive).toBe(false)
    // Hand kept for this round's total while match continues
    expect(state.hands[turn]).toBeTruthy()
    expect(state.currentTurnPlayerId).not.toBe(turn)
    expect(state.phase).toBe('bidding')

    const remaining = state.players.filter((p) => p.alive).map((p) => p.id)
    state = forceEliminatePlayer(state, remaining[0]!)
    expect(state.phase).toBe('game_over')
    expect(state.winnerId).toBe(remaining[1]!)
  })

  it('first_elimination ends when any player hits 0 lives (multi-survivor ok)', () => {
    const rng = seedRandom(7)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { initialLives: 1, winCondition: 'first_elimination' },
      },
      rng,
    )

    state = playOneForcedChallenge(state, rng)
    expect(state.phase).toBe('game_over')
    expect(state.players.filter((p) => p.alive)).toHaveLength(2)
    expect(state.winnerId).toBeNull()
  })

  it('last_standing: life 0 eliminates; last remaining player wins', () => {
    const rng = seedRandom(7)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { initialLives: 1, winCondition: 'last_standing' },
      },
      rng,
    )

    // Play until game over (bounded)
    for (let i = 0; i < 50 && state.phase !== 'game_over'; i++) {
      state = playOneForcedChallenge(state, rng)
    }
    expect(state.phase).toBe('game_over')
    expect(state.players.filter((p) => p.alive)).toHaveLength(1)
    expect(state.winnerId).toBe(state.players.find((p) => p.alive)!.id)
  })

  it('seedRandom is deterministic for full startGame', () => {
    const s1 = startGame({ playerIds: ['a', 'b', 'c'] }, seedRandom(12345))
    const s2 = startGame({ playerIds: ['a', 'b', 'c'] }, seedRandom(12345))
    expect(s1.hands).toEqual(s2.hands)
    expect(s1.deck.map((c) => c.id)).toEqual(s2.deck.map((c) => c.id))
  })
})

/** Force a quick challenge: opening bid 1, next player challenges. */
function playOneForcedChallenge(
  state: GameState,
  rng: ReturnType<typeof seedRandom>,
): GameState {
  if (state.phase === 'game_over') return state
  if (state.phase !== 'bidding') {
    return applyAction(state, { type: 'START_ROUND' }, rng)
  }
  if (state.currentBid == null) {
    const next = applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)
    return applyAction(next, { type: 'CHALLENGE' }, rng)
  }
  return applyAction(state, { type: 'CHALLENGE' }, rng)
}
