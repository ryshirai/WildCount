import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './types'

/** Generate a random room code (cryptographically strong when available). */
export function generateRoomCode(
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes,
): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH)
  let out = ''
  const mod = ROOM_CODE_ALPHABET.length
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i]! % mod]!
  }
  return out
}

/** Normalize user input: trim, upper-case, strip invalid chars. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH)
}

/** True if code matches alphabet + length (after normalize). */
export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false
  }
  return true
}

function defaultRandomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  return buf
}
