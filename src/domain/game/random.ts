/**
 * Injectable RNG for the pure game engine.
 * Domain code must never call Math.random directly.
 */

export interface RandomSource {
  /** Returns a float in [0, 1). */
  next(): number
}

/**
 * mulberry32 — small fast 32-bit PRNG.
 * Deterministic for a given seed (good for tests / simulation).
 */
export function seedRandom(seed: number): RandomSource {
  let t = seed >>> 0
  return {
    next(): number {
      t = (t + 0x6d2b79f5) >>> 0
      let r = Math.imul(t ^ (t >>> 15), 1 | t)
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    },
  }
}

/**
 * Production-oriented wrapper. Keep outside domain call sites when possible;
 * provided here as a convenience for non-domain host code.
 */
export function mathRandomSource(): RandomSource {
  return {
    next: () => Math.random(),
  }
}

/** Inclusive integer in [min, max]. */
export function randomInt(rng: RandomSource, min: number, max: number): number {
  if (max < min) {
    throw new Error(`randomInt: max (${max}) < min (${min})`)
  }
  const span = max - min + 1
  return min + Math.floor(rng.next() * span)
}
