import { describe, expect, it } from 'vitest'
import {
  cardRevealStaggerMs,
  classifyMargin,
  confettiDensityFor,
  isExtremeNumber,
  marginChipLabel,
  raiseIntensity,
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

  it('slower stagger for clutch/exact', () => {
    expect(cardRevealStaggerMs('exact')).toBe(130)
    expect(cardRevealStaggerMs('clutch')).toBe(130)
    expect(cardRevealStaggerMs('clear')).toBe(100)
  })
})
