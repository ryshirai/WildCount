import type { CalculationResult, CalculationStep, Card } from './types'
import { cardLabel } from './deck'

/**
 * Total calculation per docs/game-rules.md + docs/extra-rules.md:
 *
 * 1. Collect round cards
 * 2. MAX_TO_ZERO — zero all positive values equal to the max positive
 * 3. Sum number-like values (negatives included; specials without value skip)
 * 4. DOUBLE and HALF as combined multiplier: trunc(sum * 2^d / 2^h)
 * 5. Final total (integer, toward 0 via Math.trunc)
 *
 * Phase 0 notes:
 * - “合計値0化” (instant zero total) from design-overview is NOT implemented
 *   (no such card in card-design). Reserved / unused.
 * - `zero_mix` contributes 0 to the numeric sum.
 * - `double` / `half` / `max_to_zero` / `redraw` do not add a number; redraw
 *   should already have been resolved at deal time.
 */
export function calculateTotal(cards: readonly Card[]): CalculationResult {
  const steps: CalculationStep[] = []
  const collected = cards.slice()

  steps.push({
    id: 'collect',
    title: '場のカード',
    detail:
      collected.length === 0
        ? 'カードなし'
        : collected.map(cardLabel).join(', '),
  })

  // --- 2. MAX_TO_ZERO -------------------------------------------------------
  const hasMaxToZero = collected.some((c) => c.kind === 'max_to_zero')
  let adjusted: Card[] = collected.map((c) => ({ ...c }))

  if (hasMaxToZero) {
    const positiveValues = adjusted
      .filter((c) => c.kind === 'number' && (c.value ?? 0) > 0)
      .map((c) => c.value!)

    if (positiveValues.length > 0) {
      const maxPos = Math.max(...positiveValues)
      let zeroed = 0
      adjusted = adjusted.map((c) => {
        if (c.kind === 'number' && c.value === maxPos) {
          zeroed += 1
          return { ...c, value: 0 }
        }
        return c
      })
      steps.push({
        id: 'max_to_zero',
        title: 'M→0（最大値をゼロに）',
        detail: `いちばん大きいプラス ${maxPos} を 0 に（${zeroed} 枚）`,
      })
    } else {
      steps.push({
        id: 'max_to_zero',
        title: 'M→0（最大値をゼロに）',
        detail: 'プラスの数字がないので変化なし',
      })
    }
  } else {
    steps.push({
      id: 'max_to_zero',
      title: 'M→0',
      detail: 'このラウンドでは出ませんでした',
    })
  }

  // --- 3. Numeric sum -------------------------------------------------------
  // number and zero_mix contribute their value (zero_mix → 0).
  let rawNumberSum = 0
  const sumParts: string[] = []
  for (const c of adjusted) {
    if (c.kind === 'number' || c.kind === 'zero_mix') {
      const v = c.value ?? 0
      rawNumberSum += v
      sumParts.push(cardLabel({ ...c, kind: 'number', value: v }))
    }
  }

  steps.push({
    id: 'sum',
    title: '数字を足す',
    detail: sumParts.length > 0 ? sumParts.join(' + ') : '0（数字なし）',
    totalAfter: rawNumberSum,
  })

  // --- 4. DOUBLE + HALF (combined multiplier, trunc toward 0) --------------
  const doubleCount = adjusted.filter((c) => c.kind === 'double').length
  const halfCount = adjusted.filter((c) => c.kind === 'half').length
  let finalTotal = rawNumberSum

  if (doubleCount > 0 || halfCount > 0) {
    // trunc(sum * 2^d / 2^h) — use integer multiply then divide for exactness
    const multiplied = rawNumberSum * 2 ** doubleCount
    finalTotal = Math.trunc(multiplied / 2 ** halfCount)

    if (doubleCount > 0 && halfCount > 0) {
      steps.push({
        id: 'multiplier',
        title: '×2 / 1/2',
        detail: `${rawNumberSum} × ${2 ** doubleCount} ÷ ${2 ** halfCount} → ${finalTotal}（×2×${doubleCount}・1/2×${halfCount}）`,
        totalAfter: finalTotal,
      })
    } else if (doubleCount > 0) {
      steps.push({
        id: 'double',
        title: '×2（倍化）',
        detail: `${rawNumberSum} × ${2 ** doubleCount}（×2 が ${doubleCount} 枚）`,
        totalAfter: finalTotal,
      })
    } else {
      steps.push({
        id: 'half',
        title: '1/2（半減）',
        detail: `${rawNumberSum} ÷ ${2 ** halfCount} → ${finalTotal}（1/2 が ${halfCount} 枚・0方向切り捨て）`,
        totalAfter: finalTotal,
      })
    }
  } else {
    steps.push({
      id: 'double',
      title: '×2（倍化）',
      detail: 'このラウンドでは出ませんでした',
      totalAfter: finalTotal,
    })
  }

  // --- 5. Final -------------------------------------------------------------
  steps.push({
    id: 'final',
    title: '最終合計',
    detail: `最終的な合計は ${finalTotal}`,
    totalAfter: finalTotal,
  })

  return {
    steps,
    finalTotal,
    adjustedCards: adjusted,
    doubleCount,
    halfCount,
    maxToZeroApplied: hasMaxToZero,
    rawNumberSum,
  }
}
