import { describe, expect, it } from 'vitest'
import { seedRandom, startGame, applyAction, type GameState } from '../../src/domain/game'
import {
  computeTurnsUntilSelf,
  toGameView,
} from '../../src/mappers/toGameView'
import { DEFAULT_PROFILES, SELF_ID } from '../../src/localGame/profiles'

function freshState(): GameState {
  return startGame(
    {
      playerIds: DEFAULT_PROFILES.map((p) => p.id),
      config: { initialLives: 3, deck: 'standard' },
    },
    seedRandom(7),
  )
}

describe('computeTurnsUntilSelf', () => {
  it('returns 0 on self turn', () => {
    expect(computeTurnsUntilSelf(['self', 'bot1', 'bot2'], 'self', 'self')).toBe(0)
  })

  it('counts seats until self along the forward ring', () => {
    expect(computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot1', 'self')).toBe(3)
    expect(computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot2', 'self')).toBe(2)
    expect(computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot3', 'self')).toBe(1)
  })

  it('counts seats until self along reverse direction', () => {
    // alive: self, bot1, bot2, bot3 (seat order)
    // reverse from bot1 → bot1 → self → bot3 → bot2 → bot1 …
    // so from bot1 to self is 1 step reverse
    expect(
      computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot1', 'self', -1),
    ).toBe(1)
    // from bot2 reverse: bot2 → bot1 → self → … = 2
    expect(
      computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot2', 'self', -1),
    ).toBe(2)
    // from bot3 reverse: bot3 → bot2 → bot1 → self = 3
    expect(
      computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot3', 'self', -1),
    ).toBe(3)
  })

  it('defaults to forward when direction omitted', () => {
    expect(computeTurnsUntilSelf(['a', 'b', 'c'], 'b', 'a')).toBe(2)
  })
})

describe('toGameView', () => {
  it('maps lives, seats, and self flags from GameState', () => {
    const state = freshState()
    const vm = toGameView({
      state,
      profiles: DEFAULT_PROFILES,
      roomCode: 'TEST01',
    })

    expect(vm.roomCode).toBe('TEST01')
    expect(vm.round).toBe(1)
    expect(vm.playerCount).toBe(4)
    // 36 recipe − 4 dealt hands = 32 left in draw pile
    expect(vm.deckRemaining).toBe(32)
    expect(vm.currentBid).toBeNull()
    expect(vm.players).toHaveLength(4)
    // UI list is seat order (1-based badges), not join order
    expect(vm.players.map((p) => p.seatIndex)).toEqual([1, 2, 3, 4])
    const self = vm.players.find((p) => p.id === SELF_ID)!
    expect(self.isSelf).toBe(true)
    expect(self.lives).toBe(3)
    // B3: portrait src from profiles, emoji still present as fallback
    expect(self.avatarSrc).toMatch(/^\/avatars\/self\.webp\?v=/)
    expect(self.avatar).toBe('🐻')
    expect(vm.players.find((p) => p.id === 'bot1')?.avatarSrc).toMatch(
      /^\/avatars\/owl\.webp\?v=/,
    )
    // Indian poker: own card hidden, others face-up
    expect(self.handHidden).toBe(true)
    expect(self.handLabel).toBeTruthy() // label kept for result; UI uses handHidden
    expect(self.handCount).toBeGreaterThanOrEqual(1)
    expect(self.handLabels.length).toBe(self.handCount)
    const others = vm.players.filter((p) => !p.isSelf)
    expect(others.every((p) => p.handHidden === false)).toBe(true)
    expect(others.every((p) => p.handLabel != null && p.handLabel.length > 0)).toBe(true)
    expect(others.every((p) => p.handLabels.length === p.handCount && p.handCount >= 1)).toBe(
      true,
    )
    expect(vm.minBid).toBe(1)
    expect(vm.phase).toBe('bidding')
    expect(vm.roundBidCount).toBe(0)
    expect(vm.lastBidderId).toBeNull()
    expect(vm.currentTurnPlayerId).toBeTruthy()
  })

  it('maps multi-card hands as separate labels (draw1)', () => {
    let state = freshState()
    const victim = state.players.find((p) => p.id !== SELF_ID && p.alive)!
    // Force two cards on another player
    const hand = state.hands[victim.id] ?? []
    const extra = { id: 'extra-double', kind: 'double' as const }
    state = {
      ...state,
      hands: {
        ...state.hands,
        [victim.id]: [...hand, extra],
      },
    }

    const vm = toGameView({ state, profiles: DEFAULT_PROFILES })
    const seat = vm.players.find((p) => p.id === victim.id)!
    expect(seat.handCount).toBe(2)
    expect(seat.handLabels).toHaveLength(2)
    expect(seat.handLabels[1]).toBe('×2')
    expect(seat.handLabel).toContain('×2')
  })

  it('marks current bidder hasDeclared and updates minBid after PLACE_BID', () => {
    let state = freshState()
    const actor = state.currentTurnPlayerId!
    state = applyAction(state, { type: 'PLACE_BID', value: 5 }, seedRandom(1))

    const vm = toGameView({
      state,
      profiles: DEFAULT_PROFILES,
      bidHistory: [{ playerId: actor, value: 5, round: 1 }],
    })

    expect(vm.currentBid).toBe(5)
    expect(vm.minBid).toBe(6)
    const bidder = vm.players.find((p) => p.id === actor)
    expect(bidder?.hasDeclared).toBe(true)
    expect(bidder?.bid).toBe(5)
  })

  it('sets canDeclare / canChallenge only on self turn', () => {
    let state = freshState()
    // Force self's turn (starter is random after reseat)
    state = { ...state, currentTurnPlayerId: SELF_ID }

    let vm = toGameView({ state, profiles: DEFAULT_PROFILES })
    expect(vm.isSelfTurn).toBe(true)
    expect(vm.canDeclare).toBe(true)
    expect(vm.canChallenge).toBe(false)

    state = applyAction(state, { type: 'PLACE_BID', value: 2 }, seedRandom(2))
    vm = toGameView({
      state,
      profiles: DEFAULT_PROFILES,
      bidHistory: [{ playerId: SELF_ID, value: 2, round: 1 }],
    })
    expect(vm.isSelfTurn).toBe(false)
    expect(vm.canDeclare).toBe(false)
    expect(vm.canChallenge).toBe(false)
  })
})
