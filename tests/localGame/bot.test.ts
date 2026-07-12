import { describe, expect, it } from 'vitest'
import {
  applyAction,
  seedRandom,
  startGame,
  type Card,
  type GameState,
  type PlayerId,
} from '../../src/domain/game'
import { chooseBotAction, estimateRoundTotal } from '../../src/localGame/bot'

function withHands(
  state: GameState,
  hands: Record<PlayerId, Card>,
): GameState {
  return { ...state, hands: { ...hands } }
}

describe('estimateRoundTotal', () => {
  it('sums visible number cards and adds own-card estimate', () => {
    let state = startGame(
      { playerIds: ['bot', 'a', 'b'] },
      seedRandom(1),
    )
    state = withHands(state, {
      bot: { id: 'h-bot', kind: 'number', value: 99 },
      a: { id: 'h-a', kind: 'number', value: 5 },
      b: { id: 'h-b', kind: 'number', value: 3 },
    })
    // visible 5+3 + own est 4 = 12
    expect(estimateRoundTotal(state, 'bot')).toBe(12)
  })

  it('applies double among visible cards', () => {
    let state = startGame(
      { playerIds: ['bot', 'a', 'b'] },
      seedRandom(1),
    )
    state = withHands(state, {
      bot: { id: 'h-bot', kind: 'number', value: 1 },
      a: { id: 'h-a', kind: 'number', value: 5 },
      b: { id: 'h-b', kind: 'double' },
    })
    // (5 + own 4) * 2 = 18
    expect(estimateRoundTotal(state, 'bot')).toBe(18)
  })
})

describe('chooseBotAction', () => {
  it('opens with a PLACE_BID when no bid yet', () => {
    const state = startGame(
      { playerIds: ['bot1', 'self', 'bot2'] },
      seedRandom(7),
    )
    // Force bot1 turn if needed
    const s =
      state.currentTurnPlayerId === 'bot1'
        ? state
        : { ...state, currentTurnPlayerId: 'bot1' as PlayerId }
    const action = chooseBotAction(s, seedRandom(99))
    expect(action.type).toBe('PLACE_BID')
    if (action.type === 'PLACE_BID') {
      expect(action.value).toBeGreaterThanOrEqual(1)
    }
  })

  it('challenges when current bid is far above the estimate', () => {
    let state = startGame(
      { playerIds: ['self', 'bot1', 'bot2'] },
      seedRandom(2),
    )
    // Low visible totals → low estimate
    state = withHands(state, {
      self: { id: 'h-self', kind: 'number', value: 1 },
      bot1: { id: 'h-bot1', kind: 'number', value: 0 },
      bot2: { id: 'h-bot2', kind: 'number', value: 1 },
    })
    // Place a human bid first so bot can challenge
    state = {
      ...state,
      currentTurnPlayerId: 'self',
      currentBid: null,
      currentBidderId: null,
    }
    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, seedRandom(1))
    // Now force a huge bid as if raised
    state = {
      ...state,
      currentBid: 40,
      currentBidderId: 'self',
      currentTurnPlayerId: 'bot1',
    }

    // Deterministic: rng that always returns 0 → always under any challengeP > 0
    const alwaysLow = { next: () => 0 }
    const action = chooseBotAction(state, alwaysLow)
    expect(action).toEqual({ type: 'CHALLENGE' })
  })

  it('prefers raising when bid is safely under the estimate', () => {
    let state = startGame(
      { playerIds: ['self', 'bot1', 'bot2'] },
      seedRandom(3),
    )
    state = withHands(state, {
      self: { id: 'h-self', kind: 'number', value: 10 },
      bot1: { id: 'h-bot1', kind: 'number', value: 5 },
      bot2: { id: 'h-bot2', kind: 'number', value: 10 },
    })
    // estimate for bot1 ≈ 10+10+4 = 24
    state = {
      ...state,
      currentTurnPlayerId: 'self',
      currentBid: null,
      currentBidderId: null,
    }
    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, seedRandom(1))
    state = {
      ...state,
      currentBid: 2,
      currentBidderId: 'self',
      currentTurnPlayerId: 'bot1',
    }

    // High rng → never challenge (challengeP is small when under estimate)
    const alwaysHigh = { next: () => 0.99 }
    const action = chooseBotAction(state, alwaysHigh)
    expect(action.type).toBe('PLACE_BID')
    if (action.type === 'PLACE_BID') {
      expect(action.value).toBeGreaterThan(2)
    }
  })
})
