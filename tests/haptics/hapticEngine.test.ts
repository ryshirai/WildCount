import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __setHapticEngineForTests,
  HapticEngine,
  playHaptic,
} from '../../src/haptics/hapticEngine'
import { saveHapticEnabled } from '../../src/haptics/hapticSettings'

function installMemoryStorage() {
  const map = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, String(v))
      },
      removeItem: (k: string) => {
        map.delete(k)
      },
      clear: () => map.clear(),
    },
    configurable: true,
    writable: true,
  })
}

describe('HapticEngine', () => {
  let engine: HapticEngine
  let now = 10_000
  let vibrateCalls: Array<number | number[]>

  beforeEach(() => {
    installMemoryStorage()
    now = 10_000
    vibrateCalls = []
    engine = new HapticEngine({
      headless: true,
      dryRun: false,
      supported: true,
      now: () => now,
      vibrate: (pattern) => {
        vibrateCalls.push(pattern)
        return true
      },
    })
    engine.setEnabled(true)
    __setHapticEngineForTests(engine)
  })

  it('defaults OFF and never vibrates when muted', () => {
    // Reset persistence so a new instance loads default OFF
    saveHapticEnabled(false)
    const fresh = new HapticEngine({
      headless: true,
      dryRun: true,
      supported: true,
      now: () => now,
    })
    expect(fresh.isEnabled()).toBe(false)
    const r = fresh.play('coyote')
    expect(r.played).toBe(false)
    if (!r.played) expect(r.reason).toBe('muted')
  })

  it('plays after enable when supported', () => {
    const r = engine.play('turn_self')
    expect(r.played).toBe(true)
    expect(vibrateCalls).toHaveLength(1)
    expect(vibrateCalls[0]).toBe(36)
    expect(engine.playLog).toHaveLength(1)
  })

  it('does not stack same id within cooldown', () => {
    expect(engine.play('wild_call').played).toBe(true)
    now += 20
    expect(engine.play('wild_call').played).toBe(false)
    now += 400
    expect(engine.play('wild_call').played).toBe(true)
    expect(vibrateCalls).toHaveLength(2)
  })

  it('unsupported never vibrates', () => {
    const unsup = new HapticEngine({
      headless: true,
      supported: false,
      now: () => now,
      vibrate: (p) => {
        vibrateCalls.push(p)
        return true
      },
    })
    unsup.setEnabled(true)
    const r = unsup.play('life_loss')
    expect(r.played).toBe(false)
    if (!r.played) expect(r.reason).toBe('unsupported')
    expect(vibrateCalls).toHaveLength(0)
  })

  it('persists enable across new engine instance', () => {
    engine.setEnabled(true)
    saveHapticEnabled(true)
    const next = new HapticEngine({
      headless: true,
      dryRun: true,
      supported: true,
      now: () => now,
    })
    expect(next.isEnabled()).toBe(true)
  })

  it('toggleEnabled and cancel on disable', () => {
    expect(engine.isEnabled()).toBe(true)
    engine.toggleEnabled()
    expect(engine.isEnabled()).toBe(false)
    // cancel should call vibrate(0)
    expect(vibrateCalls.some((p) => p === 0)).toBe(true)
  })

  it('playHaptic uses singleton', () => {
    const r = playHaptic('coyote')
    expect(r.played).toBe(true)
  })

  it('dryRun records play without vibrate', () => {
    const dry = new HapticEngine({
      headless: true,
      dryRun: true,
      supported: true,
      now: () => now,
      vibrate: vi.fn(() => true),
    })
    dry.setEnabled(true)
    const r = dry.play('life_loss')
    expect(r.played).toBe(true)
    expect(dry.playLog).toHaveLength(1)
  })
})
