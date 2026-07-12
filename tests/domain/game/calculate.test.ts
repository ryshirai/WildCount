import { describe, expect, it } from 'vitest'
import { calculateTotal } from '../../../src/domain/game/calculate'
import type { Card } from '../../../src/domain/game/types'

function num(value: number, id = `n${value}`): Card {
  return { id, kind: 'number', value }
}
function dbl(id = 'd'): Card {
  return { id, kind: 'double' }
}
function max0(id = 'm'): Card {
  return { id, kind: 'max_to_zero' }
}
function zeroMix(id = 'z'): Card {
  return { id, kind: 'zero_mix', value: 0 }
}

describe('calculateTotal', () => {
  it('sums plain numbers including negatives', () => {
    const r = calculateTotal([num(5), num(3), num(-5)])
    expect(r.finalTotal).toBe(3)
    expect(r.rawNumberSum).toBe(3)
    expect(r.doubleCount).toBe(0)
    expect(r.maxToZeroApplied).toBe(false)
  })

  it('allows a fully negative total', () => {
    const r = calculateTotal([num(-5), num(-10)])
    expect(r.finalTotal).toBe(-15)
  })

  it('returns 0 for empty card list', () => {
    const r = calculateTotal([])
    expect(r.finalTotal).toBe(0)
    expect(r.steps.some((s) => s.id === 'collect')).toBe(true)
  })

  it('applies MAX_TO_ZERO to the single positive maximum', () => {
    // 20, 5, -5 + MAX → 0 + 5 + -5 = 0
    const r = calculateTotal([num(20), num(5), num(-5), max0()])
    expect(r.maxToZeroApplied).toBe(true)
    expect(r.rawNumberSum).toBe(0)
    expect(r.finalTotal).toBe(0)
  })

  it('zeros ALL cards equal to the positive maximum (ties)', () => {
    // two +10s both zeroed: 10, 10, 3 → 0, 0, 3 = 3
    const r = calculateTotal([num(10, 'a'), num(10, 'b'), num(3), max0()])
    expect(r.finalTotal).toBe(3)
    const zeroed = r.adjustedCards.filter(
      (c) => c.kind === 'number' && c.value === 0 && (c.id === 'a' || c.id === 'b'),
    )
    expect(zeroed).toHaveLength(2)
  })

  it('MAX_TO_ZERO does not affect zero or negative values as “max positive”', () => {
    // only positives considered; if none, no change
    const r = calculateTotal([num(-5), num(0), num(-10), max0()])
    expect(r.finalTotal).toBe(-15)
  })

  it('applies one DOUBLE as ×2', () => {
    const r = calculateTotal([num(5), num(3), dbl()])
    expect(r.doubleCount).toBe(1)
    expect(r.rawNumberSum).toBe(8)
    expect(r.finalTotal).toBe(16)
  })

  it('stacks DOUBLE: 2 cards → ×4', () => {
    const r = calculateTotal([num(5), dbl('d1'), dbl('d2')])
    expect(r.doubleCount).toBe(2)
    expect(r.finalTotal).toBe(20)
  })

  it('order: MAX_TO_ZERO before sum before DOUBLE', () => {
    // max 10 → 0; sum 0+5=5; ×2 = 10
    const r = calculateTotal([num(10), num(5), max0(), dbl()])
    expect(r.rawNumberSum).toBe(5)
    expect(r.finalTotal).toBe(10)
  })

  it('DOUBLE multiplies negative sums', () => {
    const r = calculateTotal([num(-5), num(-10), dbl()])
    expect(r.finalTotal).toBe(-30)
  })

  it('zero_mix contributes 0 to the sum', () => {
    const r = calculateTotal([num(5), zeroMix()])
    expect(r.finalTotal).toBe(5)
  })

  it('records process steps with final total', () => {
    const r = calculateTotal([num(4), num(1), dbl()])
    expect(r.steps.map((s) => s.id)).toEqual([
      'collect',
      'max_to_zero',
      'sum',
      'double',
      'final',
    ])
    expect(r.steps.at(-1)?.totalAfter).toBe(10)
    expect(r.finalTotal).toBe(10)
  })

  it('only doubles (no numbers) → total 0', () => {
    const r = calculateTotal([dbl()])
    expect(r.finalTotal).toBe(0)
  })
})
