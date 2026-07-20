/**
 * Dopamine wave-3 + D3: pure drama classification for results and bids.
 * No Vue / engine / network deps — unit-test friendly.
 *
 * Spec: `docs/gameplay-dopamine-plan.md` §4.7–4.8, §7 D3.
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

// ---------------------------------------------------------------------------
// D3 — COYOTE sequence timing (display-only)
// ---------------------------------------------------------------------------

/** Mute lower SFX layers before CoyoteCutIn. */
export const COYOTE_SILENCE_MS = 250
/** Hold after calc steps before total slam (clear / blowout). */
export const PRE_SLAM_HOLD_MS = 500
/** Longer hold for exact / clutch drama. */
export const PRE_SLAM_HOLD_CLUTCH_MS = 720
/** Bid remaining ms ≤ this → LAST SECOND rare tag (client-tracked). */
export const LAST_SECOND_MS = 1000
/** Consecutive bids at/above this → MAX HEAT (aligns with HEAT wild in bidDrama). */
export const MAX_HEAT_BID_COUNT = 9

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

/** Pre-slam hold ms from margin tier (0 when reduced-motion caller opts out). */
export function preSlamHoldMs(tier: MarginTier): number {
  if (tier === 'exact' || tier === 'clutch') return PRE_SLAM_HOLD_CLUTCH_MS
  return PRE_SLAM_HOLD_MS
}

// ---------------------------------------------------------------------------
// D3 — Rare tags (public play only; no RNG)
// ---------------------------------------------------------------------------

/**
 * Play-content rare labels (plan §4.8).
 * PERFECT/CLUTCH mirror margin tiers; others stack when conditions hold.
 */
export type RareTag =
  | 'perfect'
  | 'clutch'
  | 'wild_reversal'
  | 'last_second'
  | 'survived'
  | 'max_heat'

/** Display order when multiple tags apply. */
export const RARE_TAG_ORDER: readonly RareTag[] = [
  'perfect',
  'clutch',
  'wild_reversal',
  'last_second',
  'survived',
  'max_heat',
] as const

export function rareTagLabel(tag: RareTag): string {
  switch (tag) {
    case 'perfect':
      return 'PERFECT'
    case 'clutch':
      return 'CLUTCH'
    case 'wild_reversal':
      return 'WILD REVERSAL'
    case 'last_second':
      return 'LAST SECOND'
    case 'survived':
      return 'SURVIVED'
    case 'max_heat':
      return 'MAX HEAT'
    default:
      return tag
  }
}

/** Minimal card shape for naive sum / special detection (public reveal). */
export type DramaCardLike = {
  kind: string
  value?: number | null
}

/**
 * Sum of number-like values as if specials did not exist.
 * zero_mix contributes its value (usually 0); pure specials contribute 0.
 */
export function naiveNumberSum(cards: readonly DramaCardLike[]): number {
  let sum = 0
  for (const c of cards) {
    if (c.kind === 'number' || c.kind === 'zero_mix') {
      const v = c.value
      if (typeof v === 'number' && Number.isFinite(v)) sum += v
    }
  }
  return sum
}

/** Cards that can change the total vs naive number sum. */
export function hasAffectingSpecials(cards: readonly DramaCardLike[]): boolean {
  return cards.some(
    (c) =>
      c.kind === 'double' ||
      c.kind === 'half' ||
      c.kind === 'max_to_zero',
  )
}

/**
 * Specials flipped win/loss vs naive number sum.
 * bidder wins when total >= bid (same rule as engine).
 */
export function isWildReversal(opts: {
  cards: readonly DramaCardLike[]
  bidValue: number
  finalTotal: number
}): boolean {
  if (!hasAffectingSpecials(opts.cards)) return false
  const naive = naiveNumberSum(opts.cards)
  const naiveBidderWins = naive >= opts.bidValue
  const finalBidderWins = opts.finalTotal >= opts.bidValue
  return naiveBidderWins !== finalBidderWins
}

/** Loser still alive with exactly 1 life after the challenge. */
export function isSurvived(
  livesAfter: number | null | undefined,
  eliminated?: boolean,
): boolean {
  if (eliminated === true) return false
  return livesAfter === 1
}

/** WILD HEAT table at challenge time (bid count ≥ MAX_HEAT_BID_COUNT). */
export function isMaxHeat(roundBidCount: number | null | undefined): boolean {
  if (roundBidCount == null || !Number.isFinite(roundBidCount)) return false
  return Math.floor(roundBidCount) >= MAX_HEAT_BID_COUNT
}

export type ClassifyRareTagsInput = {
  finalTotal: number
  bidValue: number
  cards?: readonly DramaCardLike[]
  livesAfter?: number | null
  eliminated?: boolean
  /** Client-tracked: last successful bid with ≤ LAST_SECOND_MS remaining */
  lastSecondBid?: boolean
  /** Public consecutive bids this round when COYOTE fired */
  roundBidCount?: number | null
}

/**
 * Collect rare tags from public result + optional client drama context.
 * Order follows {@link RARE_TAG_ORDER}.
 */
export function classifyRareTags(input: ClassifyRareTagsInput): RareTag[] {
  const tier = classifyMargin(input.finalTotal, input.bidValue)
  const tags: RareTag[] = []

  if (tier === 'exact') tags.push('perfect')
  else if (tier === 'clutch') tags.push('clutch')

  if (
    input.cards &&
    isWildReversal({
      cards: input.cards,
      bidValue: input.bidValue,
      finalTotal: input.finalTotal,
    })
  ) {
    tags.push('wild_reversal')
  }

  if (input.lastSecondBid === true) tags.push('last_second')

  if (isSurvived(input.livesAfter, input.eliminated)) tags.push('survived')

  if (isMaxHeat(input.roundBidCount)) tags.push('max_heat')

  return tags
}

/** Stable id for result-screen sequence (calc → hold → slam). */
export function resultSequenceEventId(opts: {
  round: number
  bidValue: number
  finalTotal: number
  challengerName?: string
  lifeLostName?: string
}): string {
  const parts = [
    `round=${opts.round}`,
    `bid=${opts.bidValue}`,
    `total=${opts.finalTotal}`,
  ]
  if (opts.challengerName) parts.push(`ch=${opts.challengerName}`)
  if (opts.lifeLostName) parts.push(`lost=${opts.lifeLostName}`)
  return `result_verdict:${parts.join(':')}`
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
  } else if (lifeLostName) {
    who = `${lifeLostName} が${loss}`
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
  /** D3 rare tags boost density (MAX HEAT / PERFECT already lg) */
  rareTags?: readonly RareTag[]
}): ConfettiDensity {
  if (opts.isGameOver) return 'lg'
  if (opts.tier === 'exact') return 'lg'
  if (opts.rareTags?.includes('max_heat')) return 'lg'
  if (opts.rareTags?.includes('wild_reversal')) return 'md'
  if (opts.tier === 'blowout') return 'sm'
  return 'md'
}

/** Stagger ms between card flips on post-coyote reveal. */
export function cardRevealStaggerMs(tier: MarginTier): number {
  if (tier === 'exact' || tier === 'clutch') return 130
  return 100
}
