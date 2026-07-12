import { describe, expect, it } from 'vitest'
import { resolveChallenge, applyLifeLoss } from '../../../src/domain/game/resolve'
import type { Card, Player } from '../../../src/domain/game/types'

function num(value: number, id = `n${value}`): Card {
  return { id, kind: 'number', value }
}

describe('resolveChallenge', () => {
  it('bidder wins when actualTotal > bid', () => {
    const o = resolveChallenge({
      cards: [num(10), num(5)],
      bid: 12,
      bidderId: 'b',
      challengerId: 'c',
    })
    expect(o.actualTotal).toBe(15)
    expect(o.bidderWins).toBe(true)
    expect(o.loserRole).toBe('challenger')
    expect(o.loserId).toBe('c')
  })

  it('bidder wins on exact tie (actualTotal === bid)', () => {
    const o = resolveChallenge({
      cards: [num(10), num(5)],
      bid: 15,
      bidderId: 'bidder',
      challengerId: 'challenger',
    })
    expect(o.actualTotal).toBe(15)
    expect(o.bidderWins).toBe(true)
    expect(o.loserRole).toBe('challenger')
    expect(o.loserId).toBe('challenger')
  })

  it('challenger wins when actualTotal < bid', () => {
    const o = resolveChallenge({
      cards: [num(1), num(2)],
      bid: 10,
      bidderId: 'b',
      challengerId: 'c',
    })
    expect(o.actualTotal).toBe(3)
    expect(o.bidderWins).toBe(false)
    expect(o.loserRole).toBe('bidder')
    expect(o.loserId).toBe('b')
  })

  it('includes calculation process on the outcome', () => {
    const o = resolveChallenge({
      cards: [num(5)],
      bid: 1,
      bidderId: 'b',
      challengerId: 'c',
    })
    expect(o.calculation.finalTotal).toBe(5)
    expect(o.calculation.steps.length).toBeGreaterThan(0)
  })
})

describe('applyLifeLoss', () => {
  const base: Player[] = [
    { id: 'a', seatIndex: 0, lives: 1, alive: true },
    { id: 'b', seatIndex: 1, lives: 3, alive: true },
  ]

  it('decrements lives by 1', () => {
    const next = applyLifeLoss(base, 'b')
    expect(next.find((p) => p.id === 'b')?.lives).toBe(2)
    expect(next.find((p) => p.id === 'b')?.alive).toBe(true)
  })

  it('decrements lives by amount (life double)', () => {
    const next = applyLifeLoss(base, 'b', 2)
    expect(next.find((p) => p.id === 'b')?.lives).toBe(1)
  })

  it('eliminates player at 0 lives', () => {
    const next = applyLifeLoss(base, 'a')
    expect(next.find((p) => p.id === 'a')?.lives).toBe(0)
    expect(next.find((p) => p.id === 'a')?.alive).toBe(false)
  })

  it('overkill to 0 is allowed', () => {
    const next = applyLifeLoss(base, 'a', 2)
    expect(next.find((p) => p.id === 'a')?.lives).toBe(0)
    expect(next.find((p) => p.id === 'a')?.alive).toBe(false)
  })

  it('does not mutate input', () => {
    applyLifeLoss(base, 'a')
    expect(base[0]!.lives).toBe(1)
  })
})
