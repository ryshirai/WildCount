/**
 * Pure policy for haptic play decisions (enabled, support, cooldown, visibility).
 * Unit-test friendly — no navigator.vibrate.
 */

import {
  HAPTIC_CATALOG,
  type HapticId,
  type PlayHapticOptions,
} from './hapticTypes'

export type HapticPolicyState = {
  enabled: boolean
  /** Vibration API available on this device/browser. */
  supported: boolean
  /** Document / tab visible. */
  visible: boolean
  /** Last play time per id (ms). */
  lastPlayMs: Partial<Record<HapticId, number>>
}

export type HapticPlayDecision =
  | { ok: true; pattern: number | number[] }
  | {
      ok: false
      reason:
        | 'muted'
        | 'unsupported'
        | 'hidden'
        | 'cooldown'
    }

export function createHapticPolicyState(
  partial?: Partial<HapticPolicyState>,
): HapticPolicyState {
  return {
    enabled: false,
    supported: false,
    visible: true,
    lastPlayMs: {},
    ...partial,
  }
}

/**
 * Decide whether a haptic may fire.
 * Does not mutate state — caller applies {@link applyHapticAccepted}.
 */
export function decideHaptic(
  state: HapticPolicyState,
  id: HapticId,
  nowMs: number,
  opts?: PlayHapticOptions,
): HapticPlayDecision {
  if (!state.enabled) return { ok: false, reason: 'muted' }
  if (!state.supported) return { ok: false, reason: 'unsupported' }
  if (!state.visible) return { ok: false, reason: 'hidden' }

  const entry = HAPTIC_CATALOG[id]
  if (!opts?.force) {
    const last = state.lastPlayMs[id]
    if (last != null && nowMs - last < entry.cooldownMs) {
      return { ok: false, reason: 'cooldown' }
    }
  }

  return { ok: true, pattern: entry.pattern }
}

/** Mutate policy after a successful play. */
export function applyHapticAccepted(
  state: HapticPolicyState,
  id: HapticId,
  nowMs: number,
): void {
  state.lastPlayMs[id] = nowMs
}
