const RESUME_PREFIX = 'wc:resume:'
const NAME_KEY = 'wc:displayName'

export function loadResumeToken(roomCode: string): string | null {
  try {
    return localStorage.getItem(RESUME_PREFIX + roomCode.toUpperCase())
  } catch {
    return null
  }
}

export function saveResumeToken(roomCode: string, token: string): void {
  try {
    localStorage.setItem(RESUME_PREFIX + roomCode.toUpperCase(), token)
  } catch {
    // private mode / quota
  }
}

export function clearResumeToken(roomCode: string): void {
  try {
    localStorage.removeItem(RESUME_PREFIX + roomCode.toUpperCase())
  } catch {
    // ignore
  }
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
