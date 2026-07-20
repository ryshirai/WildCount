import { describe, expect, it } from 'vitest'
import {
  applyAction,
  DEFAULT_EXTRA_RULES,
  getLegalMoves,
  seedRandom,
  startGame,
  type Card,
  type ExtraRulesConfig,
  type GameState,
  type PlayerId,
} from '../../../src/domain/game'

function allExtrasOn(): ExtraRulesConfig {
  return {
    same: true,
    change: true,
    reverse: true,
    shot: true,
    draw1: true,
    lifeDouble: true,
  }
}

function withHands(
  state: GameState,
  hands: Record<PlayerId, Card | Card[]>,
): GameState {
  const normalized: Record<PlayerId, Card[]> = {}
  for (const [id, h] of Object.entries(hands)) {
    normalized[id] = Array.isArray(h) ? h : [h]
  }
  return { ...state, hands: normalized }
}

function n(value: number, id: string): Card {
  return { id, kind: 'number', value }
}

describe('ExtraRulesConfig defaults', () => {
  it('all flags false by default', () => {
    expect(DEFAULT_EXTRA_RULES).toEqual({
      same: false,
      change: false,
      reverse: false,
      shot: false,
      draw1: false,
      lifeDouble: false,
    })
  })

  it('OFF: legal moves are only PLACE_BID / CHALLENGE (no SAME/CHANGE)', () => {
    const rng = seedRandom(1)
    let state = startGame({ playerIds: ['a', 'b'] }, rng)
    expect(getLegalMoves(state).map((m) => m.type)).toEqual(['PLACE_BID'])
    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)
    const types = getLegalMoves(state).map((m) => m.type).sort()
    expect(types).toEqual(['CHALLENGE', 'PLACE_BID'])
  })

  it('OFF: attaching reverse is illegal', () => {
    const rng = seedRandom(2)
    const state = startGame({ playerIds: ['a', 'b'] }, rng)
    expect(() =>
      applyAction(
        state,
        { type: 'PLACE_BID', value: 1, extra: { type: 'reverse' } },
        rng,
      ),
    ).toThrow()
  })
})

describe('half card via deck composition (not extra toggle)', () => {
  it('half specials in deck put half cards in the pile', () => {
    const rng = seedRandom(3)
    const state = startGame(
      {
        playerIds: ['a', 'b'],
        config: {
          deck: {
            id: 'with-half',
            numbers: [{ value: 5, count: 10 }],
            specials: {
              double: 0,
              half: 2,
              max_to_zero: 0,
              redraw: 0,
              zero_mix: 0,
            },
          },
        },
      },
      rng,
    )
    const all = [...state.deck, ...Object.values(state.hands).flat()]
    expect(all.filter((c) => c.kind === 'half')).toHaveLength(2)
    expect(all).toHaveLength(12)
  })
})

describe('ER-2 same', () => {
  it('keeps bid, advances turn, forbids consecutive same', () => {
    const rng = seedRandom(4)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: { same: true } },
      },
      rng,
    )
    state = applyAction(state, { type: 'PLACE_BID', value: 5 }, rng)
    expect(state.currentTurnPlayerId).toBe('b')
    state = applyAction(state, { type: 'SAME' }, rng)
    expect(state.currentBid).toBe(5)
    expect(state.currentBidderId).toBe('a')
    expect(state.currentTurnPlayerId).toBe('c')
    expect(state.lastAction).toBe('same')
    expect(state.pendingLifeDouble).toBe(false)
    expect(state.extraActionUsedThisRound).toContain('b')

    // c: consecutive same banned
    expect(() => applyAction(state, { type: 'SAME' }, rng)).toThrow()
    const types = getLegalMoves(state).map((m) => m.type)
    expect(types).toContain('CHALLENGE')
    expect(types).not.toContain('SAME')
  })

  it('consumes personal action slot (cannot same again later this round)', () => {
    const rng = seedRandom(41)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: { same: true, reverse: true } },
      },
      rng,
    )
    // a bids, b sames (uses slot), c bids, a cannot same again
    state = applyAction(state, { type: 'PLACE_BID', value: 2 }, rng)
    state = applyAction(state, { type: 'SAME' }, rng)
    expect(state.extraActionUsedThisRound).toContain('b')
    state = applyAction(state, { type: 'PLACE_BID', value: 3 }, rng)
    // b's turn again after a... wait: after c bids next is a, then b
    // From b same → c, c bids 3 → a, a bids 4 → b
    state = applyAction(state, { type: 'PLACE_BID', value: 4 }, rng)
    expect(state.currentTurnPlayerId).toBe('b')
    expect(() => applyAction(state, { type: 'SAME' }, rng)).toThrow()
    // also cannot ride reverse this round
    expect(() =>
      applyAction(
        state,
        { type: 'PLACE_BID', value: 5, extra: { type: 'reverse' } },
        rng,
      ),
    ).toThrow()
    // plain bid still ok
    state = applyAction(state, { type: 'PLACE_BID', value: 5 }, rng)
    expect(state.currentBid).toBe(5)
  })

  it('cannot same on opening (no bid)', () => {
    const rng = seedRandom(5)
    const state = startGame(
      { playerIds: ['a', 'b'], config: { extraRules: { same: true } } },
      rng,
    )
    expect(() => applyAction(state, { type: 'SAME' }, rng)).toThrow()
  })
})

describe('ER-3 reverse + personal action frame', () => {
  it('reverses direction and consumes personal slot', () => {
    const rng = seedRandom(6)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: { reverse: true } },
      },
      rng,
    )
    // a seats 0, b 1, c 2; reverse → next is c (direction -1)
    state = applyAction(
      state,
      { type: 'PLACE_BID', value: 1, extra: { type: 'reverse' } },
      rng,
    )
    expect(state.turnDirection).toBe(-1)
    expect(state.currentTurnPlayerId).toBe('c')
    expect(state.extraActionUsedThisRound).toContain('a')

    // a cannot reverse again this round (when it becomes a's turn after c bids)
    state = applyAction(state, { type: 'PLACE_BID', value: 2 }, rng)
    // direction -1: from c → b
    expect(state.currentTurnPlayerId).toBe('b')
  })
})

describe('ER-3b change', () => {
  it('7→9→change allows 8 and 10+, forbids 9 and ≤7', () => {
    const rng = seedRandom(7)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: { change: true } },
      },
      rng,
    )
    // a=7, b=9, c change
    state = applyAction(state, { type: 'PLACE_BID', value: 7 }, rng)
    state = applyAction(state, { type: 'PLACE_BID', value: 9 }, rng)
    expect(state.bidUnderCurrent).toBe(7)
    expect(state.currentBid).toBe(9)
    expect(state.currentTurnPlayerId).toBe('c')

    state = applyAction(state, { type: 'CHANGE' }, rng)
    expect(state.pendingChangeRebid).toMatchObject({
      playerId: 'b',
      forbiddenValue: 9,
      minExclusive: 7,
      resumeNextPlayerId: 'c', // change user resumes after rebid
    })
    expect(state.currentTurnPlayerId).toBe('b')
    expect(state.extraActionUsedThisRound).toContain('c')

    // illegal rebids
    expect(() => applyAction(state, { type: 'PLACE_BID', value: 9 }, rng)).toThrow()
    expect(() => applyAction(state, { type: 'PLACE_BID', value: 7 }, rng)).toThrow()
    expect(() => applyAction(state, { type: 'PLACE_BID', value: 6 }, rng)).toThrow()
    // challenge / same / change forbidden during rebid
    expect(() => applyAction(state, { type: 'CHALLENGE' }, rng)).toThrow()

    state = applyAction(state, { type: 'PLACE_BID', value: 8 }, rng)
    expect(state.currentBid).toBe(8)
    expect(state.currentBidderId).toBe('b')
    expect(state.bidUnderCurrent).toBe(7)
    expect(state.pendingChangeRebid).toBeNull()
    // Turn returns to the change user (not skipped)
    expect(state.currentTurnPlayerId).toBe('c')
  })

  it('opening-only change: rebid ≠ B and ≥ minOpeningBid', () => {
    const rng = seedRandom(8)
    let state = startGame(
      {
        playerIds: ['a', 'b'],
        config: { extraRules: { change: true } },
      },
      rng,
    )
    state = applyAction(state, { type: 'PLACE_BID', value: 3 }, rng)
    state = applyAction(state, { type: 'CHANGE' }, rng)
    expect(state.pendingChangeRebid).toMatchObject({
      playerId: 'a',
      forbiddenValue: 3,
      minExclusive: null,
      resumeNextPlayerId: 'b',
    })
    expect(() => applyAction(state, { type: 'PLACE_BID', value: 3 }, rng)).toThrow()
    expect(() => applyAction(state, { type: 'PLACE_BID', value: 0 }, rng)).toThrow()
    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)
    expect(state.currentBid).toBe(1)
    expect(state.currentTurnPlayerId).toBe('b')
  })
})

describe('ER-4 shot', () => {
  it('names next turn player (not self)', () => {
    const rng = seedRandom(9)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: { shot: true } },
      },
      rng,
    )
    state = applyAction(
      state,
      { type: 'PLACE_BID', value: 1, extra: { type: 'shot', targetId: 'c' } },
      rng,
    )
    expect(state.currentTurnPlayerId).toBe('c')
    // c still has a free personal slot this round
    state = applyAction(
      state,
      { type: 'PLACE_BID', value: 2, extra: { type: 'shot', targetId: 'a' } },
      rng,
    )
    expect(state.currentTurnPlayerId).toBe('a')
  })

  it('cannot shot self', () => {
    const rng = seedRandom(10)
    const state = startGame(
      {
        playerIds: ['a', 'b'],
        config: { extraRules: { shot: true } },
      },
      rng,
    )
    expect(() =>
      applyAction(
        state,
        { type: 'PLACE_BID', value: 1, extra: { type: 'shot', targetId: 'a' } },
        rng,
      ),
    ).toThrow()
  })
})

describe('ER-5 life double', () => {
  it('next challenge loses 2 lives; raise clears the flag', () => {
    const rng = seedRandom(11)
    let state = startGame(
      {
        playerIds: ['a', 'b'],
        config: {
          initialLives: 3,
          extraRules: { lifeDouble: true },
        },
      },
      rng,
    )
    state = withHands(state, {
      a: n(1, 'ha'),
      b: n(1, 'hb'),
    })
    state = applyAction(
      state,
      { type: 'PLACE_BID', value: 1, extra: { type: 'life_double' } },
      rng,
    )
    expect(state.pendingLifeDouble).toBe(true)

    // b raises → flag clears
    state = applyAction(state, { type: 'PLACE_BID', value: 2 }, rng)
    expect(state.pendingLifeDouble).toBe(false)
  })

  it('challenge after life_double applies −2', () => {
    const rng = seedRandom(12)
    let state = startGame(
      {
        playerIds: ['a', 'b'],
        config: {
          initialLives: 3,
          extraRules: { lifeDouble: true },
        },
      },
      rng,
    )
    // Force low total so bidder loses on high challenge
    state = withHands(state, {
      a: n(1, 'ha'),
      b: n(1, 'hb'),
    })
    state = applyAction(
      state,
      { type: 'PLACE_BID', value: 50, extra: { type: 'life_double' } },
      rng,
    )
    expect(state.pendingLifeDouble).toBe(true)
    state = applyAction(state, { type: 'CHALLENGE' }, rng)
    expect(state.lastOutcome?.lifeLoss).toBe(2)
    // actual 2 < 50 → bidder a loses 2 lives
    expect(state.players.find((p) => p.id === 'a')?.lives).toBe(1)
  })

  it('same clears pendingLifeDouble', () => {
    const rng = seedRandom(13)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: { lifeDouble: true, same: true } },
      },
      rng,
    )
    state = applyAction(
      state,
      { type: 'PLACE_BID', value: 1, extra: { type: 'life_double' } },
      rng,
    )
    expect(state.pendingLifeDouble).toBe(true)
    state = applyAction(state, { type: 'SAME' }, rng)
    expect(state.pendingLifeDouble).toBe(false)
  })
})

describe('ER-6 draw1', () => {
  it('adds one card to target; once per round; not self', () => {
    const rng = seedRandom(14)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: { draw1: true } },
      },
      rng,
    )
    expect(state.hands.b).toHaveLength(1)
    state = applyAction(
      state,
      { type: 'PLACE_BID', value: 1, extra: { type: 'draw1', targetId: 'b' } },
      rng,
    )
    expect(state.hands.b).toHaveLength(2)
    expect(state.draw1UsedThisRound).toBe(true)
    expect(state.extraActionUsedThisRound).toContain('a')

    // next player cannot draw1 again this round
    expect(() =>
      applyAction(
        state,
        {
          type: 'PLACE_BID',
          value: 2,
          extra: { type: 'draw1', targetId: 'c' },
        },
        rng,
      ),
    ).toThrow()
  })

  it('cannot draw1 self', () => {
    const rng = seedRandom(15)
    const state = startGame(
      {
        playerIds: ['a', 'b'],
        config: { extraRules: { draw1: true } },
      },
      rng,
    )
    expect(() =>
      applyAction(
        state,
        { type: 'PLACE_BID', value: 1, extra: { type: 'draw1', targetId: 'a' } },
        rng,
      ),
    ).toThrow()
  })
})

describe('personal action frame shared', () => {
  it('change and reverse share the same slot', () => {
    const rng = seedRandom(16)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: allExtrasOn() },
      },
      rng,
    )
    state = applyAction(
      state,
      { type: 'PLACE_BID', value: 1, extra: { type: 'reverse' } },
      rng,
    )
    // After reverse from a: turnDirection -1, next is c.
    expect(state.currentTurnPlayerId).toBe('c')
    state = applyAction(state, { type: 'PLACE_BID', value: 2 }, rng)
    // -1 from c → b
    expect(state.currentTurnPlayerId).toBe('b')
    state = applyAction(state, { type: 'PLACE_BID', value: 3 }, rng)
    // -1 from b → a
    expect(state.currentTurnPlayerId).toBe('a')
    // a already used slot — cannot change or same
    expect(() => applyAction(state, { type: 'CHANGE' }, rng)).toThrow()
    expect(() => applyAction(state, { type: 'SAME' }, rng)).toThrow()
  })

  it('same and change share the same slot', () => {
    const rng = seedRandom(17)
    let state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { extraRules: { same: true, change: true } },
      },
      rng,
    )
    state = applyAction(state, { type: 'PLACE_BID', value: 1 }, rng)
    state = applyAction(state, { type: 'SAME' }, rng)
    expect(state.extraActionUsedThisRound).toContain('b')
    // advance until b's turn again with a bid on table
    state = applyAction(state, { type: 'PLACE_BID', value: 2 }, rng) // c
    state = applyAction(state, { type: 'PLACE_BID', value: 3 }, rng) // a
    expect(state.currentTurnPlayerId).toBe('b')
    expect(() => applyAction(state, { type: 'CHANGE' }, rng)).toThrow()
  })
})
