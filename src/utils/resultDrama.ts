/**
 * Dopamine wave-3: pure drama classification for results and bids.
 * No Vue / engine / network deps — unit-test friendly.
 */

export type MarginTier = 'exact' | 'clutch' | 'clear' | 'blowout'

/** Raise intensity for center bid FX + optional declare cut-in. */
export type RaiseIntensity = 'open' | 'soft' | 'normal' | 'hard'

/** |margin| ≤ this (and not exact) → clutch */
export const CLUTCH_ABS_MAX = 2
/** |margin| ≥ this → blowout */
export const BLOWOUT_ABS_MIN = 10
/** Raise delta ≥ this → hard intensity + cut-in */
export const HARD_RAISE_MIN = 5
/** Number card emphasis thresholds */
export const EXTREME_HIGH = 15
export const EXTREME_LOW = -5

export function marginOf(finalTotal: number, bidValue: number): number {
  return finalTotal - bidValue
}

export function classifyMargin(finalTotal: number, bidValue: number): MarginTier {
  const abs = Math.abs(marginOf(finalTotal, bidValue))
  if (abs === 0) return 'exact'
  if (abs <= CLUTCH_ABS_MAX) return 'clutch'
  if (abs >= BLOWOUT_ABS_MIN) return 'blowout'
  return 'clear'
}

/** Short chip label for result banner (null = no chip). */
export function marginChipLabel(tier: MarginTier): string | null {
  switch (tier) {
    case 'exact':
      return 'ジャスト'
    case 'clutch':
      return 'ギリギリ'
    case 'blowout':
      return '大差'
    default:
      return null
  }
}

/**
 * Main verdict title (non game-over).
 * bidderWins: actualTotal >= bid (challenger loses).
 */
export function verdictTitleFor(opts: {
  tier: MarginTier
  bidderWins: boolean
  isGameOver?: boolean
}): string {
  if (opts.isGameOver) return 'ゲーム終了'
  const { tier, bidderWins } = opts
  if (tier === 'exact') {
    return bidderWins ? 'ジャスト！ 宣言が通った' : 'ジャスト！ コヨーテ成功'
  }
  if (tier === 'clutch') {
    return bidderWins ? 'ギリギリ！ 宣言が通った' : 'ギリギリ！ コヨーテ成功'
  }
  if (tier === 'blowout') {
    return bidderWins ? '余裕で宣言が通った' : '大差でコヨーテ成功'
  }
  return bidderWins ? '宣言が通った！' : 'コヨーテ成功！'
}

/**
 * Detail line under the title.
 * selfIsLoser → second-person loss phrasing.
 */
export function verdictDetailFor(opts: {
  finalTotal: number
  bidValue: number
  bidderWins: boolean
  lifeLoss: number
  selfIsLoser: boolean
  eliminated: boolean
  lifeLostName: string
}): string {
  const {
    finalTotal,
    bidValue,
    bidderWins,
    lifeLoss,
    selfIsLoser,
    eliminated,
    lifeLostName,
  } = opts

  const loss =
    lifeLoss > 1 ? `ライフを ${lifeLoss} 失います（ダブル）` : 'ライフを失います'

  let who: string
  if (selfIsLoser) {
    who = eliminated
      ? 'あなたが脱落します'
      : `あなたが${loss}`
  } else if (eliminated) {
    who = `${lifeLostName} が脱落します`
  } else if (bidderWins) {
    who = `チャレンジした人が${loss}`
  } else {
    who = `宣言した人が${loss}`
  }

  if (bidderWins) {
    return `合計 ${finalTotal} は宣言 ${bidValue} 以上 → ${who}`
  }
  return `合計 ${finalTotal} は宣言 ${bidValue} より小さい → ${who}`
}

/**
 * Classify a bid change for FX / cut-in.
 * @param previous previous currentBid (null = no bid yet)
 * @param next new bid value (must be a number when called)
 */
export function raiseIntensity(
  previous: number | null,
  next: number,
): RaiseIntensity {
  if (previous == null) return 'open'
  const delta = next - previous
  if (delta >= HARD_RAISE_MIN) return 'hard'
  if (delta <= 1) return 'soft'
  return 'normal'
}

/** Whether to show BidDeclareCutIn for this raise. */
export function shouldShowBidCutIn(intensity: RaiseIntensity): boolean {
  return intensity === 'open' || intensity === 'hard'
}

export function isExtremeNumber(value: number | null | undefined): boolean {
  if (value == null || Number.isNaN(value)) return false
  return value >= EXTREME_HIGH || value <= EXTREME_LOW
}

export type ConfettiDensity = 'sm' | 'md' | 'lg'

export function confettiDensityFor(opts: {
  isGameOver: boolean
  tier: MarginTier
}): ConfettiDensity {
  if (opts.isGameOver) return 'lg'
  if (opts.tier === 'exact') return 'lg'
  if (opts.tier === 'blowout') return 'sm'
  return 'md'
}

/** Stagger ms between card flips on post-coyote reveal. */
export function cardRevealStaggerMs(tier: MarginTier): number {
  if (tier === 'exact' || tier === 'clutch') return 130
  return 100
}
