const RESUME_PREFIX = 'wc:resume:'
const NAME_KEY = 'wc:displayName'
const LAST_ROOM_KEY = 'wc:lastRoom'

function normalizeCode(roomCode: string): string {
  return roomCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export function loadResumeToken(roomCode: string): string | null {
  try {
    const code = normalizeCode(roomCode)
    if (!code) return null
    return localStorage.getItem(RESUME_PREFIX + code)
  } catch {
    return null
  }
}

export function saveResumeToken(roomCode: string, token: string): void {
  try {
    const code = normalizeCode(roomCode)
    if (!code || !token) return
    localStorage.setItem(RESUME_PREFIX + code, token)
    localStorage.setItem(LAST_ROOM_KEY, code)
  } catch {
    // private mode / quota
  }
}

export function clearResumeToken(roomCode: string): void {
  try {
    const code = normalizeCode(roomCode)
    if (!code) return
    localStorage.removeItem(RESUME_PREFIX + code)
    if (localStorage.getItem(LAST_ROOM_KEY) === code) {
      localStorage.removeItem(LAST_ROOM_KEY)
    }
  } catch {
    // ignore
  }
}

/** Last room that still has a resume token (for reload / home banner). */
export function loadLastRoomCode(): string | null {
  try {
    const code = localStorage.getItem(LAST_ROOM_KEY)
    if (!code) return null
    if (!localStorage.getItem(RESUME_PREFIX + code)) {
      localStorage.removeItem(LAST_ROOM_KEY)
      return null
    }
    return code
  } catch {
    return null
  }
}

export function hasResumableSession(roomCode?: string): boolean {
  const code = roomCode ? normalizeCode(roomCode) : loadLastRoomCode()
  if (!code) return false
  return loadResumeToken(code) != null
}

export function loadSavedDisplayName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveDisplayName(name: string): void {
  try {
    const t = name.trim()
    if (t) localStorage.setItem(NAME_KEY, t)
  } catch {
    // ignore
  }
}
