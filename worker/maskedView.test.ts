import { describe, expect, it } from 'vitest'
import { seedRandom, startGame, type Card } from '../src/domain/game'
import {
  assertNoSelfHandLeak,
  buildMaskedGame,
  buildPendingResultSnapshot,
  cardToWire,
} from './maskedView'
import type { RoomPlayer } from './roomLogic'

function roomPlayers(ids: string[]): RoomPlayer[] {
  return ids.map((id, i) => ({
    id,
    displayName: `P${i}`,
    joinedAt: i,
    ready: true,
    connected: true,
    resumeToken: `t${i}`,
    avatarIndex: i,
  }))
}

describe('maskedView', () => {
  it('does not include own hand card for the viewing player', () => {
    const ids = ['a', 'b', 'c']
    const game = startGame({ playerIds: ids }, seedRandom(42))
    const payload = buildMaskedGame(
      game,
      'a',
      roomPlayers(ids),
      [],
      'a',
    )

    const self = payload.seats.find((s) => s.id === 'a')!
    expect(self.handHidden).toBe(true)
    expect(self.hand).toBeNull()

    const other = payload.seats.find((s) => s.id === 'b')!
    expect(other.handHidden).toBe(false)
    expect(other.hand).not.toBeNull()
    expect(other.hand?.kind).toBeTruthy()

    assertNoSelfHandLeak(payload, 'a')

    // JSON wire must not contain self card id
    const json = JSON.stringify(payload)
    const selfCard = game.hands['a']![0]!
    expect(json).not.toContain(selfCard.id)
    expect(json).toContain(game.hands['b']![0]!.id)
    expect(payload.roundBidCount).toBe(0)
  })

  it('exposes roundBidCount from public bid history', () => {
    const ids = ['a', 'b', 'c']
    const game = startGame({ playerIds: ids }, seedRandom(7))
    const history = [
      { playerId: 'a', value: 2, round: 1 },
      { playerId: 'b', value: 5, round: 1 },
    ]
    const payload = buildMaskedGame(
      game,
      'a',
      roomPlayers(ids),
      history,
      'a',
    )
    expect(payload.roundBidCount).toBe(2)
  })

  it('pending result includes all hands including self', () => {
    const hands: Record<string, Card[]> = {
      a: [{ id: 'c1', kind: 'number', value: 5 }],
      b: [{ id: 'c2', kind: 'double' }],
    }
    const snap = buildPendingResultSnapshot({
      round: 1,
      winnerId: null,
      isGameOver: false,
      hands,
      outcome: {
        bid: 10,
        actualTotal: 5,
        calculation: {
          steps: [],
          finalTotal: 5,
          adjustedCards: [],
          doubleCount: 0,
          halfCount: 0,
          maxToZeroApplied: false,
          rawNumberSum: 5,
        },
        bidderWins: false,
        loserRole: 'bidder',
        loserId: 'a',
        bidderId: 'a',
        challengerId: 'b',
        lifeLoss: 1,
      },
    })
    expect(snap.hands.a?.[0]?.label).toBeTruthy()
    expect(snap.hands.b?.[0]?.kind).toBe('double')
  })

  it('cardToWire preserves kind/value', () => {
    expect(cardToWire({ id: 'x', kind: 'number', value: -1 }).value).toBe(-1)
  })
})
