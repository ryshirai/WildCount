import { describe, expect, it } from 'vitest'
import {
  AVATAR_COUNT,
  avatarByIndex,
  isValidAvatarIndex,
  sanitizeAvatarIndex,
} from '@/localGame/avatarCatalog'

describe('avatarCatalog', () => {
  it('has a fixed catalog size for wire indices', () => {
    expect(AVATAR_COUNT).toBe(15)
  })

  it('validates avatar indices strictly', () => {
    expect(isValidAvatarIndex(0)).toBe(true)
    expect(isValidAvatarIndex(AVATAR_COUNT - 1)).toBe(true)
    expect(isValidAvatarIndex(AVATAR_COUNT)).toBe(false)
    expect(isValidAvatarIndex(-1)).toBe(false)
    expect(isValidAvatarIndex(1.2)).toBe(false)
    expect(isValidAvatarIndex(NaN)).toBe(false)
    expect(isValidAvatarIndex('1')).toBe(false)
    expect(isValidAvatarIndex(null)).toBe(false)
  })

  it('sanitizes with clamp (UI / storage)', () => {
    expect(sanitizeAvatarIndex(3)).toBe(3)
    expect(sanitizeAvatarIndex('5')).toBe(5)
    expect(sanitizeAvatarIndex(99)).toBe(AVATAR_COUNT - 1)
    expect(sanitizeAvatarIndex(-2)).toBe(0)
    expect(sanitizeAvatarIndex(undefined, 4)).toBe(4)
    expect(sanitizeAvatarIndex(null, 100)).toBe(AVATAR_COUNT - 1)
    expect(sanitizeAvatarIndex('x', -3)).toBe(0)
  })

  it('avatarByIndex always resolves a catalog entry', () => {
    expect(avatarByIndex(0).id).toBe('self')
    expect(avatarByIndex(1).id).toBe('owl')
    expect(avatarByIndex(10).id).toBe('koi')
    expect(avatarByIndex(99).id).toBe('cat')
  })
})
