/**
 * Pure policy for SFX play decisions (cooldown, mute, duck).
 * Unit-test friendly — no Web Audio.
 */

import { SFX_CATALOG, type PlaySfxOptions, type SfxId, type SfxPriority } from './sfxTypes'

export type SfxPolicyState = {
  enabled: boolean
  /** Master volume 0..1 */
  volume: number
  /** Document / tab visible */
  visible: boolean
  /** Audio graph unlocked after a user gesture */
  unlocked: boolean
  /** Last play time per id (ms epoch or monotonic) */
  lastPlayMs: Partial<Record<SfxId, number>>
  /** Currently ducking until this time (ms) */
  duckUntilMs: number
  /** Highest priority of active duck source */
  duckPriority: SfxPriority | null
}

export type SfxPlayDecision =
  | { ok: true; effectiveGain: number; pitch: number; duckLower: boolean; duckMs: number }
  | { ok: false; reason: 'muted' | 'volume_zero' | 'hidden' | 'locked' | 'cooldown' }

export function createSfxPolicyState(
  partial?: Partial<SfxPolicyState>,
): SfxPolicyState {
  return {
    enabled: true,
    volume: 0.65,
    visible: true,
    unlocked: false,
    lastPlayMs: {},
    duckUntilMs: 0,
    duckPriority: null,
    ...partial,
  }
}

/**
 * Decide whether a sound may play and at what gain/pitch.
 * Does not mutate state — caller applies {@link applyPlayAccepted}.
 */
export function decidePlay(
  state: SfxPolicyState,
  id: SfxId,
  nowMs: number,
  opts?: PlaySfxOptions,
): SfxPlayDecision {
  if (!state.enabled) return { ok: false, reason: 'muted' }
  if (state.volume <= 0) return { ok: false, reason: 'volume_zero' }
  if (!state.visible) return { ok: false, reason: 'hidden' }
  if (!state.unlocked) return { ok: false, reason: 'locked' }

  const entry = SFX_CATALOG[id]
  if (!opts?.force) {
    const last = state.lastPlayMs[id]
    if (last != null && nowMs - last < entry.cooldownMs) {
      return { ok: false, reason: 'cooldown' }
    }
  }

  const pitch =
    typeof opts?.pitch === 'number' && Number.isFinite(opts.pitch) && opts.pitch > 0
      ? Math.min(2.5, Math.max(0.4, opts.pitch))
      : 1

  let local =
    typeof opts?.gain === 'number' && Number.isFinite(opts.gain)
      ? Math.min(1, Math.max(0, opts.gain))
      : 1

  // Soft duck when a higher-priority voice recently fired
  if (
    state.duckUntilMs > nowMs &&
    state.duckPriority != null &&
    entry.priority > state.duckPriority
  ) {
    local *= 0.22
  }

  const effectiveGain = Math.min(1, state.volume * local)
  if (effectiveGain <= 0.001) return { ok: false, reason: 'volume_zero' }

  return {
    ok: true,
    effectiveGain,
    pitch,
    duckLower: entry.duckMs > 0,
    duckMs: entry.duckMs,
  }
}

/** Mutate policy after a successful play. */
export function applyPlayAccepted(
  state: SfxPolicyState,
  id: SfxId,
  nowMs: number,
  decision: Extract<SfxPlayDecision, { ok: true }>,
): void {
  const entry = SFX_CATALOG[id]
  state.lastPlayMs[id] = nowMs
  if (decision.duckLower && decision.duckMs > 0) {
    const until = nowMs + decision.duckMs
    if (
      until >= state.duckUntilMs ||
      state.duckPriority == null ||
      entry.priority <= state.duckPriority
    ) {
      state.duckUntilMs = until
      state.duckPriority = entry.priority
    }
  }
}

/** HEAT stage → bid_land pitch multiplier. */
export function pitchForHeat(
  heat: 'none' | 'warm' | 'heating' | 'danger' | 'wild' | string,
): number {
  switch (heat) {
    case 'heating':
      return 1.06
    case 'danger':
      return 1.14
    case 'wild':
      return 1.22
    case 'warm':
      return 1.02
    default:
      return 1
  }
}

/** RAISE tier → additional pitch on bid_land. */
export function pitchForRaise(
  tier: 'normal' | 'nice' | 'big' | 'wild' | string,
): number {
  switch (tier) {
    case 'nice':
      return 1.08
    case 'big':
      return 1.16
    case 'wild':
      return 1.28
    default:
      return 1
  }
}

/** Combine heat + raise pitch factors (capped). */
export function pitchForBidLand(opts: {
  heat?: string
  tier?: string
}): number {
  const p =
    pitchForHeat(opts.heat ?? 'none') * pitchForRaise(opts.tier ?? 'normal')
  return Math.min(2, Math.max(0.5, Math.round(p * 1000) / 1000))
}
