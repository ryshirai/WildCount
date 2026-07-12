import { describe, expect, it } from 'vitest'
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from './roomCode'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './types'

describe('roomCode', () => {
  it('generates fixed-length codes from the safe alphabet', () => {
    const bytes = new Uint8Array(ROOM_CODE_LENGTH).fill(0)
    const code = generateRoomCode(() => bytes)
    expect(code).toHaveLength(ROOM_CODE_LENGTH)
    for (const ch of code) {
      expect(ROOM_CODE_ALPHABET).toContain(ch)
    }
    // 0 % alphabet → first char
    expect(code).toBe(ROOM_CODE_ALPHABET[0]!.repeat(ROOM_CODE_LENGTH))
  })

  it('normalizes user input', () => {
    expect(normalizeRoomCode(' ab-cd ')).toBe('ABCD')
    expect(normalizeRoomCode('abcdefghij')).toBe('ABCDEF')
  })

  it('validates alphabet and length', () => {
    expect(isValidRoomCode('ABC234')).toBe(true)
    expect(isValidRoomCode('ABC23')).toBe(false)
    expect(isValidRoomCode('ABCIO0')).toBe(false) // I, O, 0 excluded
  })
})
