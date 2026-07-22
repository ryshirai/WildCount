import { describe, expect, it } from 'vitest'
import {
  buildSimpleCalcSummary,
  cardRevealStaggerMs,
  classifyMargin,
  classifyRareTags,
  comparisonOperator,
  comparisonReasonFor,
  confettiDensityFor,
  COYOTE_SILENCE_MS,
  hasAffectingSpecials,
  isExtremeNumber,
  isMaxHeat,
  isSurvived,
  isWildReversal,
  LAST_SECOND_MS,
  livesBeforeLoss,
  marginChipLabel,
  MAX_HEAT_BID_COUNT,
  naiveNumberSum,
  parseSumTerms,
  preSlamHoldMs,
  PRE_SLAM_HOLD_CLUTCH_MS,
  PRE_SLAM_HOLD_MS,
  raiseIntensity,
  rareTagLabel,
  resultSequenceEventId,
  shouldShowBidCutIn,
  verdictDetailFor,
  verdictTitleFor,
} from '../../src/utils/resultDrama'

describe('classifyMargin', () => {
  it('exact when total equals bid', () => {
    expect(classifyMargin(18, 18)).toBe('exact')
    expect(classifyMargin(0, 0)).toBe('exact')
  })

  it('clutch for abs margin 1–2', () => {
    expect(classifyMargin(19, 18)).toBe('clutch')
    expect(classifyMargin(16, 18)).toBe('clutch')
    expect(classifyMargin(20, 18)).toBe('clutch')
  })

  it('clear for mid margins', () => {
    expect(classifyMargin(21, 18)).toBe('clear')
    expect(classifyMargin(10, 18)).toBe('clear')
    expect(classifyMargin(27, 18)).toBe('clear')
  })

  it('blowout for abs ≥ 10', () => {
    expect(classifyMargin(28, 18)).toBe('blowout')
    expect(classifyMargin(5, 18)).toBe('blowout')
    expect(classifyMargin(-5, 10)).toBe('blowout')
  })
})

describe('marginChipLabel / verdictTitleFor', () => {
  it('chip only for non-clear tiers', () => {
    expect(marginChipLabel('exact')).toBe('ジャスト')
    expect(marginChipLabel('clutch')).toBe('ギリギリ')
    expect(marginChipLabel('blowout')).toBe('大差')
    expect(marginChipLabel('clear')).toBeNull()
  })

  it('titles branch on tier and winner', () => {
    expect(verdictTitleFor({ tier: 'clear', bidderWins: true })).toBe(
      '宣言が通った！',
    )
    expect(verdictTitleFor({ tier: 'clear', bidderWins: false })).toBe(
      'コヨーテ成功！',
    )
    expect(verdictTitleFor({ tier: 'exact', bidderWins: true })).toContain(
      'ジャスト',
    )
    expect(verdictTitleFor({ tier: 'clutch', bidderWins: false })).toContain(
      'ギリギリ',
    )
    expect(verdictTitleFor({ tier: 'blowout', bidderWins: false })).toContain(
      '大差',
    )
    expect(verdictTitleFor({ tier: 'clear', bidderWins: true, isGameOver: true })).toBe(
      'ゲーム終了',
    )
  })
})

describe('verdictDetailFor', () => {
  it('uses あなた when self is loser', () => {
    const d = verdictDetailFor({
      finalTotal: 10,
      bidValue: 12,
      bidderWins: false,
      lifeLoss: 1,
      selfIsLoser: true,
      eliminated: false,
      lifeLostName: 'あなた',
    })
    expect(d).toContain('あなたが')
    expect(d).toContain('ライフを失います')
  })

  it('uses 脱落 when eliminated', () => {
    const d = verdictDetailFor({
      finalTotal: 20,
      bidValue: 10,
      bidderWins: true,
      lifeLoss: 1,
      selfIsLoser: false,
      eliminated: true,
      lifeLostName: 'フクロウ',
    })
    expect(d).toContain('フクロウ')
    expect(d).toContain('脱落')
  })
})

describe('raiseIntensity / cut-in gate', () => {
  it('open on first bid', () => {
    expect(raiseIntensity(null, 5)).toBe('open')
    expect(shouldShowBidCutIn('open')).toBe(true)
  })

  it('soft on +1, no cut-in', () => {
    expect(raiseIntensity(5, 6)).toBe('soft')
    expect(shouldShowBidCutIn('soft')).toBe(false)
  })

  it('normal on +2..+4, no cut-in', () => {
    expect(raiseIntensity(5, 7)).toBe('normal')
    expect(raiseIntensity(5, 9)).toBe('normal')
    expect(shouldShowBidCutIn('normal')).toBe(false)
  })

  it('hard on +5+, cut-in', () => {
    expect(raiseIntensity(5, 10)).toBe('hard')
    expect(raiseIntensity(1, 20)).toBe('hard')
    expect(shouldShowBidCutIn('hard')).toBe(true)
  })
})

describe('isExtremeNumber / confetti / stagger', () => {
  it('extreme thresholds', () => {
    expect(isExtremeNumber(15)).toBe(true)
    expect(isExtremeNumber(14)).toBe(false)
    expect(isExtremeNumber(-5)).toBe(true)
    expect(isExtremeNumber(-4)).toBe(false)
    expect(isExtremeNumber(null)).toBe(false)
  })

  it('confetti density by tier', () => {
    expect(confettiDensityFor({ isGameOver: true, tier: 'clear' })).toBe('lg')
    expect(confettiDensityFor({ isGameOver: false, tier: 'exact' })).toBe('lg')
    expect(confettiDensityFor({ isGameOver: false, tier: 'blowout' })).toBe(
      'sm',
    )
    expect(confettiDensityFor({ isGameOver: false, tier: 'clear' })).toBe('md')
  })

  it('confetti density boosted by max heat rare tag', () => {
    expect(
      confettiDensityFor({
        isGameOver: false,
        tier: 'clear',
        rareTags: ['max_heat'],
      }),
    ).toBe('lg')
  })

  it('slower stagger for clutch/exact', () => {
    expect(cardRevealStaggerMs('exact')).toBe(130)
    expect(cardRevealStaggerMs('clutch')).toBe(130)
    expect(cardRevealStaggerMs('clear')).toBe(100)
  })
})

describe('D3 rare tags / timing', () => {
  it('timing constants are positive', () => {
    expect(COYOTE_SILENCE_MS).toBe(250)
    expect(PRE_SLAM_HOLD_MS).toBe(500)
    expect(PRE_SLAM_HOLD_CLUTCH_MS).toBeGreaterThan(PRE_SLAM_HOLD_MS)
    expect(LAST_SECOND_MS).toBe(1000)
    expect(MAX_HEAT_BID_COUNT).toBe(9)
  })

  it('preSlamHoldMs longer for exact/clutch', () => {
    expect(preSlamHoldMs('exact')).toBe(PRE_SLAM_HOLD_CLUTCH_MS)
    expect(preSlamHoldMs('clutch')).toBe(PRE_SLAM_HOLD_CLUTCH_MS)
    expect(preSlamHoldMs('clear')).toBe(PRE_SLAM_HOLD_MS)
    expect(preSlamHoldMs('blowout')).toBe(PRE_SLAM_HOLD_MS)
  })

  it('naiveNumberSum ignores pure specials', () => {
    expect(
      naiveNumberSum([
        { kind: 'number', value: 5 },
        { kind: 'number', value: -2 },
        { kind: 'double', value: null },
        { kind: 'max_to_zero', value: null },
        { kind: 'zero_mix', value: 0 },
      ]),
    ).toBe(3)
  })

  it('isWildReversal when specials flip win/loss', () => {
    // naive 20 >= bid 18 → bidder would win; final 10 < 18 → bidder loses
    expect(
      isWildReversal({
        cards: [
          { kind: 'number', value: 20 },
          { kind: 'half', value: null },
        ],
        bidValue: 18,
        finalTotal: 10,
      }),
    ).toBe(true)

    // No specials → never reversal
    expect(
      isWildReversal({
        cards: [{ kind: 'number', value: 10 }],
        bidValue: 12,
        finalTotal: 10,
      }),
    ).toBe(false)

    // Specials but same winner (naive 12 >= 10 and final 24 >= 10)
    expect(
      isWildReversal({
        cards: [
          { kind: 'number', value: 12 },
          { kind: 'double', value: null },
        ],
        bidValue: 10,
        finalTotal: 24,
      }),
    ).toBe(false)
  })

  it('hasAffectingSpecials detects double/half/max_to_zero only', () => {
    expect(hasAffectingSpecials([{ kind: 'redraw' }])).toBe(false)
    expect(hasAffectingSpecials([{ kind: 'double' }])).toBe(true)
  })

  it('isSurvived / isMaxHeat boundaries', () => {
    expect(isSurvived(1, false)).toBe(true)
    expect(isSurvived(1, true)).toBe(false)
    expect(isSurvived(0)).toBe(false)
    expect(isSurvived(2)).toBe(false)
    expect(isMaxHeat(MAX_HEAT_BID_COUNT)).toBe(true)
    expect(isMaxHeat(MAX_HEAT_BID_COUNT - 1)).toBe(false)
    expect(isMaxHeat(null)).toBe(false)
  })

  it('classifyRareTags stacks perfect + context tags', () => {
    const tags = classifyRareTags({
      finalTotal: 18,
      bidValue: 18,
      cards: [
        { kind: 'number', value: 20 },
        { kind: 'half', value: null },
      ],
      livesAfter: 1,
      eliminated: false,
      lastSecondBid: true,
      roundBidCount: 12,
    })
    // exact → perfect; wild_reversal (20>=18 vs 18>=18? wait final 18 = bid, bidder wins; naive 20 >= 18 bidder wins → same, no reversal)
    expect(tags).toContain('perfect')
    expect(tags).toContain('last_second')
    expect(tags).toContain('survived')
    expect(tags).toContain('max_heat')
    expect(tags).not.toContain('clutch')
  })

  it('classifyRareTags wild reversal with clutch', () => {
    // naive 5 < bid 10 → bidder loses; final 12 >= 10 → bidder wins; abs margin 2 → clutch
    const tags = classifyRareTags({
      finalTotal: 12,
      bidValue: 10,
      cards: [
        { kind: 'number', value: 5 },
        { kind: 'double', value: null },
      ],
    })
    expect(tags).toContain('clutch')
    expect(tags).toContain('wild_reversal')
  })

  it('rareTagLabel and resultSequenceEventId are stable', () => {
    expect(rareTagLabel('perfect')).toBe('PERFECT')
    expect(rareTagLabel('wild_reversal')).toBe('WILD REVERSAL')
    const a = resultSequenceEventId({
      round: 2,
      bidValue: 10,
      finalTotal: 9,
      challengerName: 'A',
    })
    const b = resultSequenceEventId({
      round: 2,
      bidValue: 10,
      finalTotal: 9,
      challengerName: 'A',
    })
    expect(a).toBe(b)
    expect(a).toContain('result_verdict:')
  })
})

describe('comparisonOperator / comparisonReasonFor', () => {
  it('coyote success uses > (bid exceeds total)', () => {
    expect(comparisonOperator(false)).toBe('>')
    expect(
      comparisonReasonFor({ bidderWins: false, finalTotal: 3, bidValue: 8 }),
    ).toContain('超えました')
  })

  it('bidder holds uses ≤', () => {
    expect(comparisonOperator(true)).toBe('≤')
    expect(
      comparisonReasonFor({ bidderWins: true, finalTotal: 20, bidValue: 18 }),
    ).toContain('以上')
    expect(
      comparisonReasonFor({ bidderWins: true, finalTotal: 18, bidValue: 18 }),
    ).toContain('一致')
  })
})

describe('buildSimpleCalcSummary / parseSumTerms', () => {
  it('parses sum terms and only applied specials', () => {
    expect(parseSumTerms('-5 + 5 + 0 + 3 + 4 + 2 + 1 + 0 = 10')).toEqual([
      '-5',
      '5',
      '0',
      '3',
      '4',
      '2',
      '1',
      '0',
    ])
    const summary = buildSimpleCalcSummary([
      {
        id: 'max_to_zero',
        title: 'M→0',
        detail: 'いちばん大きいプラス 10 を 0 に（1 枚）',
      },
      {
        id: 'sum',
        title: '数字を足す',
        detail: '-5 + 5 + 0 + 3 = 3',
        totalAfter: 3,
      },
      {
        id: 'double',
        title: '×2',
        detail: 'このラウンドでは出ませんでした',
        totalAfter: 3,
      },
    ])
    expect(summary.baseSum).toBe(3)
    expect(summary.terms).toEqual(['-5', '5', '0', '3'])
    expect(summary.specials.map((s) => s.id)).toEqual(['max_to_zero'])
  })

  it('omits max_to_zero when not on board', () => {
    const summary = buildSimpleCalcSummary([
      {
        id: 'max_to_zero',
        title: 'M→0',
        detail: 'このラウンドでは出ませんでした',
      },
      {
        id: 'sum',
        title: '数字を足す',
        detail: '+2 +1 = 3',
        totalAfter: 3,
      },
      {
        id: 'double',
        title: '×2',
        detail: '3 × 2（×2 が 1 枚）',
        totalAfter: 6,
      },
    ])
    expect(summary.specials.map((s) => s.label)).toEqual(['×2'])
  })
})

describe('livesBeforeLoss', () => {
  it('adds loss to after', () => {
    expect(livesBeforeLoss(1, 1)).toBe(2)
    expect(livesBeforeLoss(0, 2)).toBe(2)
    expect(livesBeforeLoss(null, 1)).toBeNull()
  })
})
