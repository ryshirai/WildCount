import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clampVolume,
  DEFAULT_SFX_ENABLED,
  DEFAULT_SFX_VOLUME,
  loadSfxSettings,
  parseEnabled,
  saveSfxEnabled,
  saveSfxSettings,
  saveSfxVolume,
  SFX_ENABLED_KEY,
  SFX_VOLUME_KEY,
} from '../../src/audio/sfxSettings'

/** Minimal in-memory localStorage for Node vitest. */
function installMemoryStorage() {
  const map = new Map<string, string>()
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v))
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
  return storage
}

describe('sfxSettings', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  afterEach(() => {
    // leave storage as-is
  })

  it('defaults when empty', () => {
    expect(loadSfxSettings()).toEqual({
      enabled: DEFAULT_SFX_ENABLED,
      volume: DEFAULT_SFX_VOLUME,
    })
  })

  it('parseEnabled accepts common truthy/falsy', () => {
    expect(parseEnabled(null)).toBe(DEFAULT_SFX_ENABLED)
    expect(parseEnabled('0')).toBe(false)
    expect(parseEnabled('false')).toBe(false)
    expect(parseEnabled('off')).toBe(false)
    expect(parseEnabled('1')).toBe(true)
    expect(parseEnabled('true')).toBe(true)
    expect(parseEnabled('on')).toBe(true)
  })

  it('clampVolume bounds and rounds', () => {
    expect(clampVolume(-1)).toBe(0)
    expect(clampVolume(2)).toBe(1)
    expect(clampVolume(0.333)).toBe(0.33)
    expect(clampVolume('nope')).toBe(DEFAULT_SFX_VOLUME)
  })

  it('round-trips enabled and volume', () => {
    saveSfxEnabled(false)
    saveSfxVolume(0.4)
    expect(localStorage.getItem(SFX_ENABLED_KEY)).toBe('0')
    expect(localStorage.getItem(SFX_VOLUME_KEY)).toBe('0.4')
    expect(loadSfxSettings()).toEqual({ enabled: false, volume: 0.4 })

    saveSfxSettings({ enabled: true, volume: 0.9 })
    expect(loadSfxSettings()).toEqual({ enabled: true, volume: 0.9 })
  })
})
