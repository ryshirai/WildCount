import { describe, expect, it } from 'vitest'
import {
  describeCardFace,
  MYSTERY_CARD_DESCRIPTION,
} from '@/data/cardDescriptions'

describe('describeCardFace', () => {
  it('returns null for empty labels', () => {
    expect(describeCardFace(null)).toBeNull()
    expect(describeCardFace(undefined)).toBeNull()
    expect(describeCardFace('')).toBeNull()
    expect(describeCardFace('   ')).toBeNull()
  })

  it('describes special faces', () => {
    expect(describeCardFace('×2')?.name).toContain('倍化')
    expect(describeCardFace('1/2')?.effect).toMatch(/半分/)
    expect(describeCardFace('M→0')?.name).toContain('最大値')
    expect(describeCardFace('?')?.name).toContain('引き直し')
    expect(describeCardFace('?')?.effect).toMatch(/オープン|チャレンジ/)
    expect(describeCardFace('0*')?.effect).toMatch(/山/)
  })

  it('describes number faces without revealing secret identities', () => {
    const plus = describeCardFace('+5')
    expect(plus?.name).toContain('+5')
    expect(plus?.effect).toMatch(/\+5/)

    const zero = describeCardFace('0')
    expect(zero?.name).toContain('0')

    const neg = describeCardFace('-10')
    expect(neg?.effect).toMatch(/-10/)
  })

  it('mystery copy never names a face value', () => {
    expect(MYSTERY_CARD_DESCRIPTION.name).toBe('非公開')
    expect(MYSTERY_CARD_DESCRIPTION.effect).not.toMatch(/[×xX]|M→0|\+?\d/)
  })
})
