import type { CalculationResult, CalculationStep, Card } from './types'
import { cardLabel } from './deck'

/**
 * Total calculation per docs/game-rules.md (authoritative order):
 *
 * 1. Collect round cards
 * 2. MAX_TO_ZERO — zero all positive values equal to the max positive
 * 3. Sum number-like values (negatives included; specials without value skip)
 * 4. DOUBLE — multiply by 2^count
 * 5. Final total
 *
 * Phase 0 notes:
 * - “合計値0化” (instant zero total) from design-overview is NOT implemented
 *   (no such card in card-design). Reserved / unused.
 * - `zero_mix` contributes 0 to the numeric sum.
 * - `double` / `max_to_zero` / `redraw` do not add a number; redraw should
 *   already have been resolved at deal time (so redraw cards should not
 *   appear here in normal play). If present, they are ignored in the sum.
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
      detail: 'このラウンドには出ませんでした',
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

  // --- 4. DOUBLE ------------------------------------------------------------
  const doubleCount = adjusted.filter((c) => c.kind === 'double').length
  let finalTotal = rawNumberSum
  if (doubleCount > 0) {
    const factor = 2 ** doubleCount
    finalTotal = rawNumberSum * factor
    steps.push({
      id: 'double',
      title: '×2（倍化）',
      detail: `${rawNumberSum} × ${factor}（×2 が ${doubleCount} 枚）`,
      totalAfter: finalTotal,
    })
  } else {
    steps.push({
      id: 'double',
      title: '×2（倍化）',
      detail: 'このラウンドには出ませんでした',
      totalAfter: finalTotal,
    })
  }

  // --- 5. Final -------------------------------------------------------------
  steps.push({
    id: 'final',
    title: '最終合計',
    detail: `合計は ${finalTotal}`,
    totalAfter: finalTotal,
  })

  return {
    steps,
    finalTotal,
    adjustedCards: adjusted,
    doubleCount,
    maxToZeroApplied: hasMaxToZero,
    rawNumberSum,
  }
}
