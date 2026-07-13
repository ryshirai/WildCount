import { describe, expect, it } from 'vitest'
import {
  CHARACTER_STAMP_IDS,
  characterStampSrc,
  isCharacterStampId,
  isStampId,
  stampEmoji,
} from '@/online/stamps'

describe('stamps', () => {
  it('allowlists fixed stamp ids', () => {
    expect(isStampId('thumbs')).toBe(true)
    expect(isStampId('coyote')).toBe(true)
    expect(isStampId('nope')).toBe(false)
  })

  it('marks emotion stamps as character-skinned', () => {
    for (const id of CHARACTER_STAMP_IDS) {
      expect(isCharacterStampId(id)).toBe(true)
    }
    expect(isCharacterStampId('coyote')).toBe(false)
  })

  it('resolves character stamp paths', () => {
    expect(characterStampSrc('owl', 'thumbs')).toBe('/stamps/owl/thumbs.webp')
    expect(characterStampSrc('self', 'party')).toBe('/stamps/self/party.webp')
    expect(characterStampSrc('owl', 'coyote')).toBeNull()
    expect(characterStampSrc('unknown', 'thumbs')).toBeNull()
    expect(characterStampSrc(null, 'thumbs')).toBeNull()
  })

  it('still provides emoji fallbacks', () => {
    expect(stampEmoji('thumbs')).toBe('👍')
    expect(stampEmoji('coyote')).toBe('🐺')
  })
})
