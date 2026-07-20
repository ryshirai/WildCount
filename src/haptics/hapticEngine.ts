/**
 * Haptic engine: settings, support guard, cooldown, Vibration API.
 * Spec: `docs/gameplay-dopamine-plan.md` §5.3, §7 D4.
 *
 * OFF / unsupported / tab hidden → silent no-op.
 * Does not convey private hand info (only public events wired by callers).
 */

import {
  applyHapticAccepted,
  createHapticPolicyState,
  decideHaptic,
  type HapticPolicyState,
} from './hapticPolicy'
import {
  loadHapticSettings,
  saveHapticEnabled,
  type HapticSettings,
} from './hapticSettings'
import type { HapticId, PlayHapticOptions } from './hapticTypes'

export type HapticPlayResult =
  | { played: true; id: HapticId }
  | { played: false; id: HapticId; reason: string }

type Listener = () => void

export type VibrateFn = (pattern: number | number[]) => boolean

export type HapticEngineOptions = {
  now?: () => number
  /** Skip DOM listeners (tests). */
  headless?: boolean
  /**
   * When true, never call navigator.vibrate; still runs policy & records plays.
   */
  dryRun?: boolean
  /** Inject vibrate implementation (tests). */
  vibrate?: VibrateFn
  /** Override support detection (tests). */
  supported?: boolean
}

function detectVibrateSupport(): boolean {
  if (typeof navigator === 'undefined') return false
  return typeof navigator.vibrate === 'function'
}

function defaultVibrate(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false
  }
  try {
    return navigator.vibrate(pattern)
  } catch {
    return false
  }
}

export class HapticEngine {
  private policy: HapticPolicyState
  private readonly now: () => number
  private readonly headless: boolean
  private readonly dryRun: boolean
  private readonly vibrateImpl: VibrateFn
  private visibilityInstalled = false
  private listeners = new Set<Listener>()
  /** Last successful play log (tests / debug). */
  readonly playLog: HapticPlayResult[] = []

  constructor(opts?: HapticEngineOptions) {
    const saved = loadHapticSettings()
    const supported =
      opts?.supported ?? (!opts?.dryRun && !opts?.headless ? detectVibrateSupport() : true)
    this.policy = createHapticPolicyState({
      enabled: saved.enabled,
      supported,
      visible: true,
    })
    this.now = opts?.now ?? (() => Date.now())
    this.headless = opts?.headless === true
    this.dryRun = opts?.dryRun === true
    this.vibrateImpl = opts?.vibrate ?? defaultVibrate
    if (!this.headless && typeof document !== 'undefined') {
      this.installVisibility()
    }
  }

  getSettings(): HapticSettings {
    return { enabled: this.policy.enabled }
  }

  isEnabled(): boolean {
    return this.policy.enabled
  }

  isSupported(): boolean {
    return this.policy.supported
  }

  /** Subscribe to settings changes (UI). */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  setEnabled(enabled: boolean): void {
    this.policy.enabled = enabled
    saveHapticEnabled(enabled)
    if (!enabled) this.cancel()
    this.emit()
  }

  toggleEnabled(): boolean {
    this.setEnabled(!this.policy.enabled)
    return this.policy.enabled
  }

  /** Stop any in-flight vibration. */
  cancel(): void {
    if (this.dryRun) return
    try {
      this.vibrateImpl(0)
    } catch {
      // ignore
    }
  }

  private installVisibility(): void {
    if (this.visibilityInstalled || typeof document === 'undefined') return
    this.visibilityInstalled = true
    const sync = () => {
      this.policy.visible = document.visibilityState !== 'hidden'
      if (!this.policy.visible) this.cancel()
    }
    document.addEventListener('visibilitychange', sync)
    sync()
  }

  /**
   * Fire a catalog haptic. Returns whether vibration was requested.
   * Never throws; failures are silent no-ops.
   */
  play(id: HapticId, opts?: PlayHapticOptions): HapticPlayResult {
    // Re-probe support once if we thought unsupported but API appeared
    if (!this.policy.supported && !this.dryRun && detectVibrateSupport()) {
      this.policy.supported = true
    }

    const nowMs = this.now()
    const decision = decideHaptic(this.policy, id, nowMs, opts)
    if (!decision.ok) {
      return { played: false, id, reason: decision.reason }
    }

    applyHapticAccepted(this.policy, id, nowMs)

    if (!this.dryRun) {
      try {
        const ok = this.vibrateImpl(decision.pattern)
        if (!ok) {
          return { played: false, id, reason: 'vibrate_rejected' }
        }
      } catch {
        return { played: false, id, reason: 'vibrate_error' }
      }
    }

    const result: HapticPlayResult = { played: true, id }
    this.playLog.push(result)
    if (this.playLog.length > 200) {
      this.playLog.splice(0, this.playLog.length - 100)
    }
    return result
  }

  /** Test helper. */
  _debugPolicy(): HapticPolicyState {
    return this.policy
  }
}

let singleton: HapticEngine | null = null

/** App-wide haptic engine (lazy). */
export function getHapticEngine(): HapticEngine {
  if (!singleton) singleton = new HapticEngine()
  return singleton
}

/** Tests: replace or clear singleton. */
export function __setHapticEngineForTests(engine: HapticEngine | null): void {
  singleton = engine
}

/** Convenience. */
export function playHaptic(
  id: HapticId,
  opts?: PlayHapticOptions,
): HapticPlayResult {
  return getHapticEngine().play(id, opts)
}
