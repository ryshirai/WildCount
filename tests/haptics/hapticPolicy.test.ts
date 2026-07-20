import { describe, expect, it } from 'vitest'
import {
  applyHapticAccepted,
  createHapticPolicyState,
  decideHaptic,
} from '../../src/haptics/hapticPolicy'
import { HAPTIC_CATALOG } from '../../src/haptics/hapticTypes'

describe('hapticPolicy', () => {
  it('rejects when muted (OFF)', () => {
    const state = createHapticPolicyState({
      enabled: false,
      supported: true,
    })
    expect(decideHaptic(state, 'turn_self', 1000)).toEqual({
      ok: false,
      reason: 'muted',
    })
  })

  it('rejects when unsupported', () => {
    const state = createHapticPolicyState({
      enabled: true,
      supported: false,
    })
    expect(decideHaptic(state, 'coyote', 1000)).toEqual({
      ok: false,
      reason: 'unsupported',
    })
  })

  it('rejects when tab hidden', () => {
    const state = createHapticPolicyState({
      enabled: true,
      supported: true,
      visible: false,
    })
    expect(decideHaptic(state, 'life_loss', 1000)).toEqual({
      ok: false,
      reason: 'hidden',
    })
  })

  it('accepts when enabled + supported + visible', () => {
    const state = createHapticPolicyState({
      enabled: true,
      supported: true,
    })
    const d = decideHaptic(state, 'wild_call', 1000)
    expect(d.ok).toBe(true)
    if (d.ok) {
      expect(d.pattern).toEqual(HAPTIC_CATALOG.wild_call.pattern)
    }
  })

  it('enforces per-id cooldown', () => {
    const state = createHapticPolicyState({
      enabled: true,
      supported: true,
    })
    const t0 = 10_000
    const first = decideHaptic(state, 'turn_self', t0)
    expect(first.ok).toBe(true)
    if (first.ok) applyHapticAccepted(state, 'turn_self', t0)

    const soon = decideHaptic(state, 'turn_self', t0 + 50)
    expect(soon).toEqual({ ok: false, reason: 'cooldown' })

    const later = decideHaptic(
      state,
      'turn_self',
      t0 + HAPTIC_CATALOG.turn_self.cooldownMs + 1,
    )
    expect(later.ok).toBe(true)
  })

  it('force skips cooldown', () => {
    const state = createHapticPolicyState({
      enabled: true,
      supported: true,
      lastPlayMs: { coyote: 10_000 },
    })
    const d = decideHaptic(state, 'coyote', 10_100, { force: true })
    expect(d.ok).toBe(true)
  })

  it('different ids do not share cooldown', () => {
    const state = createHapticPolicyState({
      enabled: true,
      supported: true,
    })
    const t0 = 5000
    applyHapticAccepted(state, 'turn_self', t0)
    expect(decideHaptic(state, 'coyote', t0 + 10).ok).toBe(true)
  })
})
