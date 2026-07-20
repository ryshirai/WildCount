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

  it('counts seats until self along the ring', () => {
    expect(computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot1', 'self')).toBe(3)
    expect(computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot2', 'self')).toBe(2)
    expect(computeTurnsUntilSelf(['self', 'bot1', 'bot2', 'bot3'], 'bot3', 'self')).toBe(1)
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
    expect(vm.currentBid).toBeNull()
    expect(vm.players).toHaveLength(4)
    expect(vm.players[0]!.id).toBe(SELF_ID)
    expect(vm.players[0]!.isSelf).toBe(true)
    expect(vm.players[0]!.lives).toBe(3)
    expect(vm.players[0]!.seatIndex).toBe(1) // 1-based UI
    // B3: portrait src from profiles, emoji still present as fallback
    expect(vm.players[0]!.avatarSrc).toBe('/avatars/self.webp')
    expect(vm.players[0]!.avatar).toBe('🐻')
    expect(vm.players.find((p) => p.id === 'bot1')?.avatarSrc).toBe('/avatars/owl.webp')
    // Indian poker: own card hidden, others face-up
    expect(vm.players[0]!.handHidden).toBe(true)
    expect(vm.players[0]!.handLabel).toBeTruthy() // label kept for result; UI uses handHidden
    expect(vm.players[0]!.handCount).toBeGreaterThanOrEqual(1)
    expect(vm.players[0]!.handLabels.length).toBe(vm.players[0]!.handCount)
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
    expect(vm.currentTurnPlayerId).toBe(SELF_ID)
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
    // Ensure self has the turn: self is seat 0 and starts first with seed lineup
    expect(state.currentTurnPlayerId).toBe(SELF_ID)

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
