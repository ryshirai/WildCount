/**
 * Haptic preference persistence (localStorage).
 * Default OFF — opt-in only (plan D4).
 */

export const HAPTIC_ENABLED_KEY = 'wc:hapticEnabled'

/** Default: OFF (vibration is opt-in). */
export const DEFAULT_HAPTIC_ENABLED = false

export type HapticSettings = {
  enabled: boolean
}

export function parseHapticEnabled(raw: string | null): boolean {
  if (raw == null) return DEFAULT_HAPTIC_ENABLED
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  return DEFAULT_HAPTIC_ENABLED
}

export function loadHapticSettings(): HapticSettings {
  try {
    return { enabled: parseHapticEnabled(localStorage.getItem(HAPTIC_ENABLED_KEY)) }
  } catch {
    return { enabled: DEFAULT_HAPTIC_ENABLED }
  }
}

export function saveHapticEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTIC_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // private mode / quota
  }
}

export function saveHapticSettings(settings: HapticSettings): void {
  saveHapticEnabled(settings.enabled)
}
