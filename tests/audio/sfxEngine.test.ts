import { beforeEach, describe, expect, it } from 'vitest'
import {
  __setSfxEngineForTests,
  SfxEngine,
  playSfx,
} from '../../src/audio/sfxEngine'

/** Minimal in-memory localStorage for Node vitest. */
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

describe('SfxEngine', () => {
  let engine: SfxEngine
  let now = 10_000

  beforeEach(() => {
    installMemoryStorage()
    now = 10_000
    engine = new SfxEngine({
      headless: true,
      dryRun: true,
      now: () => now,
    })
    engine.unlock()
    __setSfxEngineForTests(engine)
  })

  it('SFX OFF never reports played', () => {
    engine.setEnabled(false)
    const r = engine.play('coyote')
    expect(r.played).toBe(false)
    if (!r.played) expect(r.reason).toBe('muted')
    expect(engine.playLog).toHaveLength(0)
  })

  it('plays after unlock when enabled', () => {
    const r = engine.play('bid_land', { pitch: 1.1 })
    expect(r.played).toBe(true)
    if (r.played) {
      expect(r.id).toBe('bid_land')
      expect(r.pitch).toBe(1.1)
    }
    expect(engine.playLog).toHaveLength(1)
  })

  it('persists mute across new engine instance', () => {
    engine.setEnabled(false)
    const next = new SfxEngine({
      headless: true,
      dryRun: true,
      now: () => now,
    })
    next.unlock()
    expect(next.isEnabled()).toBe(false)
    expect(next.play('ui_tick').played).toBe(false)
  })

  it('toggleEnabled and volume', () => {
    expect(engine.isEnabled()).toBe(true)
    engine.toggleEnabled()
    expect(engine.isEnabled()).toBe(false)
    engine.setVolume(0.2)
    expect(engine.getVolume()).toBe(0.2)
  })

  it('playSfx uses singleton', () => {
    const r = playSfx('turn_self')
    expect(r.played).toBe(true)
  })

  it('does not stack same id within cooldown', () => {
    expect(engine.play('ui_tick').played).toBe(true)
    now += 5
    expect(engine.play('ui_tick').played).toBe(false)
    now += 50
    expect(engine.play('ui_tick').played).toBe(true)
  })
})
