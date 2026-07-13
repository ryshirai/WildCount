import { describe, expect, it } from 'vitest'
import { STANDARD_DECK } from '@/domain/game'
import { onlineToGameView } from '@/mappers/onlineToGameView'
import type { PlayerView } from '@/online/protocol'

function sampleView(): PlayerView {
  return {
    phase: 'playing',
    roomCode: 'ABC234',
    hostId: 'a',
    selfPlayerId: 'a',
    status: 'playing',
    canStart: false,
    playerCount: 2,
    maxPlayers: 10,
    deck: {
      id: STANDARD_DECK.id,
      label: STANDARD_DECK.label,
      numbers: STANDARD_DECK.numbers.map((n) => ({
        value: n.value,
        count: n.count,
      })),
      specials: { ...STANDARD_DECK.specials },
    },
    extraRules: {
      same: false,
      change: false,
      reverse: false,
      shot: false,
      draw1: false,
      lifeDouble: false,
    },
    players: [
      {
        id: 'a',
        displayName: 'Alice',
        ready: true,
        connected: true,
        isHost: true,
        avatarIndex: 0,
      },
      {
        id: 'b',
        displayName: 'Bob',
        ready: true,
        connected: true,
        isHost: false,
        avatarIndex: 1,
      },
    ],
    game: {
      phase: 'bidding',
      round: 1,
      currentBid: 3,
      currentBidderId: 'b',
      currentTurnPlayerId: 'a',
      winnerId: null,
      seats: [
        {
          id: 'a',
          seatIndex: 0,
          displayName: 'Alice',
          avatarIndex: 0,
          lives: 3,
          alive: true,
          bid: null,
          hasDeclared: false,
          isSelf: true,
          isCurrentTurn: true,
          hand: null,
          handHidden: true,
          connected: true,
          isHost: true,
        },
        {
          id: 'b',
          seatIndex: 1,
          displayName: 'Bob',
          avatarIndex: 1,
          lives: 3,
          alive: true,
          bid: 3,
          hasDeclared: true,
          isSelf: false,
          isCurrentTurn: false,
          hand: { id: 'c2', kind: 'number', value: 5, label: '+5' },
          handHidden: false,
          connected: true,
          isHost: false,
        },
      ],
      minBid: 4,
      isMyTurn: true,
      canDeclare: true,
      canChallenge: true,
      turnsUntilSelf: 0,
      legalMoves: [],
      isGameOver: false,
    },
  }
}

describe('onlineToGameView', () => {
  it('maps masked seats and keeps self hand hidden', () => {
    const vm = onlineToGameView(sampleView())
    expect(vm).not.toBeNull()
    expect(vm!.roomCode).toBe('ABC234')
    expect(vm!.canDeclare).toBe(true)
    expect(vm!.canChallenge).toBe(true)
    expect(vm!.minBid).toBe(4)

    const self = vm!.players.find((p) => p.isSelf)!
    expect(self.handHidden).toBe(true)
    expect(self.handLabel).toBeNull()
    expect(self.handLabels).toEqual([])
    expect(self.handCount).toBeGreaterThanOrEqual(0)

    const other = vm!.players.find((p) => !p.isSelf)!
    expect(other.handHidden).toBe(false)
    expect(other.handLabel).toBe('+5')
    expect(other.handLabels).toEqual(['+5'])
    expect(other.handCount).toBe(1)
  })
})
