import { describe, expect, it } from 'vitest'
import {
  applyAction,
  seedRandom,
  startGame,
  type Card,
  type ChallengeOutcome,
  type Player,
} from '../../src/domain/game'
import { toResultView } from '../../src/mappers/toResultView'
import { DEFAULT_PROFILES, SELF_ID } from '../../src/localGame/profiles'

describe('toResultView', () => {
  it('builds ResultMock from outcome.calculation and hands snapshot', () => {
    const rng = seedRandom(99)
    let state = startGame(
      {
        playerIds: DEFAULT_PROFILES.map((p) => p.id),
        config: { initialLives: 3, deck: 'standard' },
      },
      rng,
    )

    // Force a challenge: bid then challenge as next player
    const bidderId = state.currentTurnPlayerId!
    state = applyAction(state, { type: 'PLACE_BID', value: 100 }, rng)
    const challengerId = state.currentTurnPlayerId!
    const hands: Record<string, Card> = { ...state.hands }
    const round = state.round
    state = applyAction(state, { type: 'CHALLENGE' }, rng)

    const outcome = state.lastOutcome as ChallengeOutcome
    expect(outcome).toBeTruthy()

    const vm = toResultView({
      outcome,
      hands,
      players: state.players as Player[],
      round,
      roomCode: 'R1',
      profiles: DEFAULT_PROFILES,
      winnerId: state.winnerId,
    })

    expect(vm.roomCode).toBe('R1')
    expect(vm.round).toBe(round)
    expect(vm.bidValue).toBe(100)
    expect(vm.finalTotal).toBe(outcome.calculation.finalTotal)
    expect(vm.calcSteps.length).toBe(outcome.calculation.steps.length)
    expect(vm.calcSteps[0]!.title).toBe(outcome.calculation.steps[0]!.title)
    expect(vm.bidderWins).toBe(outcome.bidderWins)
    expect(vm.cards.length).toBe(Object.keys(hands).length)
    expect(vm.cards.every((c) => c.label.length > 0)).toBe(true)
    expect(vm.loserId).toBe(outcome.loserId)

    // Names from profiles
    const bidderProfile = DEFAULT_PROFILES.find((p) => p.id === bidderId)!
    const challengerProfile = DEFAULT_PROFILES.find((p) => p.id === challengerId)!
    expect(vm.bidderName).toBe(bidderProfile.name)
    expect(vm.challengerName).toBe(challengerProfile.name)
    expect(vm.bidderAvatarSrc).toBe(bidderProfile.avatarSrc)
    expect(vm.challengerAvatarSrc).toBe(challengerProfile.avatarSrc)

    const selfCard = vm.cards.find((c) => c.playerId === SELF_ID)
    if (selfCard) {
      expect(selfCard.isSelf).toBe(true)
      expect(selfCard.avatarSrc).toBe('/avatars/self.webp')
    }
  })

  it('marks game over when winnerId is set', () => {
    const outcome: ChallengeOutcome = {
      bid: 10,
      actualTotal: 5,
      calculation: {
        steps: [{ id: 's1', title: '合計', detail: '5', totalAfter: 5 }],
        finalTotal: 5,
        adjustedCards: [],
        doubleCount: 0,
        maxToZeroApplied: false,
        rawNumberSum: 5,
      },
      bidderWins: false,
      loserRole: 'bidder',
      loserId: 'bot1',
      bidderId: 'bot1',
      challengerId: SELF_ID,
    }

    const hands = {
      [SELF_ID]: { id: 'c1', kind: 'number' as const, value: 3 },
      bot1: { id: 'c2', kind: 'number' as const, value: 2 },
    }

    const players: Player[] = [
      { id: SELF_ID, seatIndex: 0, lives: 1, alive: true },
      { id: 'bot1', seatIndex: 1, lives: 0, alive: false },
    ]

    const vm = toResultView({
      outcome,
      hands,
      players,
      round: 2,
      profiles: DEFAULT_PROFILES,
      winnerId: SELF_ID,
    })

    expect(vm.isGameOver).toBe(true)
    expect(vm.winnerId).toBe(SELF_ID)
    expect(vm.winnerName).toBe('あなた')
    expect(vm.bidderWins).toBe(false)
  })
})
