/**
 * SFX preference persistence (localStorage).
 * Pure load/save helpers — no AudioContext.
 */

export const SFX_ENABLED_KEY = 'wc:sfxEnabled'
export const SFX_VOLUME_KEY = 'wc:sfxVolume'

/** Default: ON (mute is opt-out). Volume mid-high for first play. */
export const DEFAULT_SFX_ENABLED = true
export const DEFAULT_SFX_VOLUME = 0.65

export type SfxSettings = {
  enabled: boolean
  /** Master volume 0..1 */
  volume: number
}

export function clampVolume(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_SFX_VOLUME
  if (n <= 0) return 0
  if (n >= 1) return 1
  return Math.round(n * 100) / 100
}

export function parseEnabled(raw: string | null): boolean {
  if (raw == null) return DEFAULT_SFX_ENABLED
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  return DEFAULT_SFX_ENABLED
}

export function loadSfxSettings(): SfxSettings {
  try {
    const enabled = parseEnabled(localStorage.getItem(SFX_ENABLED_KEY))
    const volRaw = localStorage.getItem(SFX_VOLUME_KEY)
    const volume =
      volRaw == null ? DEFAULT_SFX_VOLUME : clampVolume(Number(volRaw))
    return { enabled, volume }
  } catch {
    return { enabled: DEFAULT_SFX_ENABLED, volume: DEFAULT_SFX_VOLUME }
  }
}

export function saveSfxEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SFX_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // private mode / quota
  }
}

export function saveSfxVolume(volume: number): void {
  try {
    localStorage.setItem(SFX_VOLUME_KEY, String(clampVolume(volume)))
  } catch {
    // ignore
  }
}

export function saveSfxSettings(settings: SfxSettings): void {
  saveSfxEnabled(settings.enabled)
  saveSfxVolume(settings.volume)
}
