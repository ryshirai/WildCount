import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearResumeToken,
  hasResumableSession,
  loadLastRoomCode,
  loadResumeToken,
  saveDisplayName,
  loadSavedDisplayName,
  saveResumeToken,
} from '@/online/resumeStorage'

/** Minimal in-memory localStorage for Node vitest. */
function installMemoryStorage() {
  const map = new Map<string, string>()
  const storage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, String(value))
    },
    removeItem(key: string) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
  return storage
}

describe('resumeStorage', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  afterEach(() => {
    // leave a clean global
    installMemoryStorage()
  })

  it('saves and loads resume token with normalized room code', () => {
    saveResumeToken('ab7kq2', 'token-1')
    expect(loadResumeToken('AB7KQ2')).toBe('token-1')
    expect(loadResumeToken('ab7kq2')).toBe('token-1')
    expect(loadLastRoomCode()).toBe('AB7KQ2')
    expect(hasResumableSession()).toBe(true)
    expect(hasResumableSession('AB7KQ2')).toBe(true)
  })

  it('clears token and last room together', () => {
    saveResumeToken('XYZ234', 't')
    clearResumeToken('xyz234')
    expect(loadResumeToken('XYZ234')).toBeNull()
    expect(loadLastRoomCode()).toBeNull()
    expect(hasResumableSession()).toBe(false)
  })

  it('loadLastRoomCode ignores orphan lastRoom without token', () => {
    localStorage.setItem('wc:lastRoom', 'ORPHAN1')
    expect(loadLastRoomCode()).toBeNull()
  })

  it('persists display name', () => {
    saveDisplayName('  狐  ')
    expect(loadSavedDisplayName()).toBe('狐')
  })
})
