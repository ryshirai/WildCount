import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_HAPTIC_ENABLED,
  HAPTIC_ENABLED_KEY,
  loadHapticSettings,
  parseHapticEnabled,
  saveHapticEnabled,
  saveHapticSettings,
} from '../../src/haptics/hapticSettings'

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

describe('hapticSettings', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('defaults to OFF when empty', () => {
    expect(loadHapticSettings()).toEqual({ enabled: DEFAULT_HAPTIC_ENABLED })
    expect(DEFAULT_HAPTIC_ENABLED).toBe(false)
  })

  it('parseHapticEnabled accepts common truthy/falsy', () => {
    expect(parseHapticEnabled(null)).toBe(false)
    expect(parseHapticEnabled('0')).toBe(false)
    expect(parseHapticEnabled('false')).toBe(false)
    expect(parseHapticEnabled('off')).toBe(false)
    expect(parseHapticEnabled('1')).toBe(true)
    expect(parseHapticEnabled('true')).toBe(true)
    expect(parseHapticEnabled('on')).toBe(true)
  })

  it('round-trips enabled flag', () => {
    saveHapticEnabled(true)
    expect(localStorage.getItem(HAPTIC_ENABLED_KEY)).toBe('1')
    expect(loadHapticSettings()).toEqual({ enabled: true })

    saveHapticSettings({ enabled: false })
    expect(localStorage.getItem(HAPTIC_ENABLED_KEY)).toBe('0')
    expect(loadHapticSettings()).toEqual({ enabled: false })
  })
})
