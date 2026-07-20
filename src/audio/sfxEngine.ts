/**
 * SFX engine: unlock, mute/volume, policy, procedural synth.
 * Spec: `docs/gameplay-dopamine-plan.md` §5, §7 D2.
 *
 * SFX OFF never schedules audio nodes.
 * Tab hidden / not yet unlocked → silent no-op (no backlog on resume).
 */

import {
  applyPlayAccepted,
  createSfxPolicyState,
  decidePlay,
  type SfxPolicyState,
} from './sfxPolicy'
import {
  clampVolume,
  loadSfxSettings,
  saveSfxEnabled,
  saveSfxVolume,
  type SfxSettings,
} from './sfxSettings'
import { scheduleSfx } from './sfxSynth'
import type { PlaySfxOptions, SfxId } from './sfxTypes'

export type SfxPlayResult =
  | { played: true; id: SfxId; gain: number; pitch: number }
  | { played: false; id: SfxId; reason: string }

type Listener = () => void

/** Optional test hooks — production uses real AudioContext. */
export type SfxEngineOptions = {
  /** Inject clock (ms). Default: Date.now */
  now?: () => number
  /** Skip DOM listeners (tests). */
  headless?: boolean
  /**
   * When true, never create AudioContext; still runs policy & records plays.
   * Used by unit tests.
   */
  dryRun?: boolean
}

export class SfxEngine {
  private policy: SfxPolicyState
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private readonly now: () => number
  private readonly headless: boolean
  private readonly dryRun: boolean
  private unlockInstalled = false
  private visibilityInstalled = false
  private listeners = new Set<Listener>()
  /** Last successful play log (tests / debug). */
  readonly playLog: SfxPlayResult[] = []

  constructor(opts?: SfxEngineOptions) {
    const saved = loadSfxSettings()
    this.policy = createSfxPolicyState({
      enabled: saved.enabled,
      volume: saved.volume,
      unlocked: false,
      visible: true,
    })
    this.now = opts?.now ?? (() => Date.now())
    this.headless = opts?.headless === true
    this.dryRun = opts?.dryRun === true
    if (!this.headless && typeof document !== 'undefined') {
      this.installUnlock()
      this.installVisibility()
    }
  }

  getSettings(): SfxSettings {
    return { enabled: this.policy.enabled, volume: this.policy.volume }
  }

  isEnabled(): boolean {
    return this.policy.enabled
  }

  getVolume(): number {
    return this.policy.volume
  }

  isUnlocked(): boolean {
    return this.policy.unlocked
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
    saveSfxEnabled(enabled)
    if (!enabled) this.stopAllSoft()
    this.emit()
  }

  setVolume(volume: number): void {
    const v = clampVolume(volume)
    this.policy.volume = v
    saveSfxVolume(v)
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(v, this.ctx.currentTime)
    }
    this.emit()
  }

  toggleEnabled(): boolean {
    this.setEnabled(!this.policy.enabled)
    return this.policy.enabled
  }

  /**
   * Ensure AudioContext exists and is running (user-gesture safe).
   * Safe to call repeatedly.
   */
  unlock(): void {
    if (this.dryRun) {
      this.policy.unlocked = true
      return
    }
    if (typeof AudioContext === 'undefined' && typeof window === 'undefined') {
      return
    }
    try {
      const AC =
        typeof AudioContext !== 'undefined'
          ? AudioContext
          : (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
      if (!AC) return
      if (!this.ctx) {
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.policy.volume
        this.master.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume()
      }
      this.policy.unlocked = this.ctx.state === 'running' || this.ctx.state === 'suspended'
      // Treat suspended-after-create as unlockable; resume is async
      if (this.ctx.state === 'running') {
        this.policy.unlocked = true
      } else {
        void this.ctx.resume().then(() => {
          this.policy.unlocked = true
        })
        // Allow plays to schedule; browsers often resume on same gesture
        this.policy.unlocked = true
      }
    } catch {
      // Autoplay / unsupported
    }
  }

  private installUnlock(): void {
    if (this.unlockInstalled || typeof window === 'undefined') return
    this.unlockInstalled = true
    const once = () => {
      this.unlock()
      window.removeEventListener('pointerdown', once)
      window.removeEventListener('keydown', once)
      window.removeEventListener('touchstart', once)
    }
    window.addEventListener('pointerdown', once, { passive: true })
    window.addEventListener('keydown', once)
    window.addEventListener('touchstart', once, { passive: true })
  }

  private installVisibility(): void {
    if (this.visibilityInstalled || typeof document === 'undefined') return
    this.visibilityInstalled = true
    const sync = () => {
      this.policy.visible = document.visibilityState !== 'hidden'
      if (!this.policy.visible) this.stopAllSoft()
    }
    document.addEventListener('visibilitychange', sync)
    sync()
  }

  /** Soft-stop: drop duck state; do not close context (reuse). */
  private stopAllSoft(): void {
    this.policy.duckUntilMs = 0
    this.policy.duckPriority = null
    // Master mute flash for in-flight voices
    if (this.master && this.ctx && !this.policy.enabled) {
      try {
        this.master.gain.setValueAtTime(0, this.ctx.currentTime)
      } catch {
        // ignore
      }
    } else if (this.master && this.ctx) {
      try {
        this.master.gain.setValueAtTime(this.policy.volume, this.ctx.currentTime)
      } catch {
        // ignore
      }
    }
  }

  /**
   * Play a catalog SFX. Returns whether audio was scheduled.
   * Never throws; failures are silent no-ops.
   */
  play(id: SfxId, opts?: PlaySfxOptions): SfxPlayResult {
    // Auto-unlock attempt if already had a gesture path (ctx exists)
    if (!this.policy.unlocked && this.ctx) this.unlock()

    const nowMs = this.now()
    const decision = decidePlay(this.policy, id, nowMs, opts)
    if (!decision.ok) {
      const result: SfxPlayResult = { played: false, id, reason: decision.reason }
      return result
    }

    applyPlayAccepted(this.policy, id, nowMs, decision)

    if (!this.dryRun) {
      try {
        if (!this.ctx || !this.master) {
          this.unlock()
        }
        if (this.ctx && this.master && this.policy.enabled) {
          // Ensure master reflects current volume when re-enabled
          this.master.gain.setValueAtTime(
            this.policy.volume,
            this.ctx.currentTime,
          )
          const when = this.ctx.currentTime + 0.001
          scheduleSfx(id, {
            ctx: this.ctx,
            dest: this.master,
            when,
            gain: decision.effectiveGain / Math.max(0.001, this.policy.volume),
            pitch: decision.pitch,
          })
        }
      } catch {
        const result: SfxPlayResult = { played: false, id, reason: 'audio_error' }
        return result
      }
    }

    const result: SfxPlayResult = {
      played: true,
      id,
      gain: decision.effectiveGain,
      pitch: decision.pitch,
    }
    this.playLog.push(result)
    // Cap log for long sessions
    if (this.playLog.length > 200) this.playLog.splice(0, this.playLog.length - 100)
    return result
  }

  /** Test helper: replace policy clock fields. */
  _debugPolicy(): SfxPolicyState {
    return this.policy
  }
}

let singleton: SfxEngine | null = null

/** App-wide SFX engine (lazy). */
export function getSfxEngine(): SfxEngine {
  if (!singleton) singleton = new SfxEngine()
  return singleton
}

/** Tests: replace or clear singleton. */
export function __setSfxEngineForTests(engine: SfxEngine | null): void {
  singleton = engine
}

/** Convenience. */
export function playSfx(id: SfxId, opts?: PlaySfxOptions): SfxPlayResult {
  return getSfxEngine().play(id, opts)
}
