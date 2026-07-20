import { describe, expect, it } from 'vitest'
import {
  applyPlayAccepted,
  createSfxPolicyState,
  decidePlay,
  pitchForBidLand,
  pitchForHeat,
  pitchForRaise,
} from '../../src/audio/sfxPolicy'
import { SFX_CATALOG } from '../../src/audio/sfxTypes'

describe('decidePlay', () => {
  it('rejects when muted', () => {
    const state = createSfxPolicyState({ enabled: false, unlocked: true })
    expect(decidePlay(state, 'ui_tick', 1000)).toEqual({
      ok: false,
      reason: 'muted',
    })
  })

  it('rejects when volume zero', () => {
    const state = createSfxPolicyState({
      enabled: true,
      volume: 0,
      unlocked: true,
    })
    expect(decidePlay(state, 'ui_tick', 1000).ok).toBe(false)
  })

  it('rejects when tab hidden', () => {
    const state = createSfxPolicyState({
      unlocked: true,
      visible: false,
    })
    expect(decidePlay(state, 'bid_land', 1000)).toMatchObject({
      ok: false,
      reason: 'hidden',
    })
  })

  it('rejects when not unlocked (autoplay gate)', () => {
    const state = createSfxPolicyState({ unlocked: false })
    expect(decidePlay(state, 'coyote', 1000)).toMatchObject({
      ok: false,
      reason: 'locked',
    })
  })

  it('enforces per-id cooldown', () => {
    const state = createSfxPolicyState({ unlocked: true })
    const first = decidePlay(state, 'ui_tick', 1000)
    expect(first.ok).toBe(true)
    if (first.ok) applyPlayAccepted(state, 'ui_tick', 1000, first)

    const cd = SFX_CATALOG.ui_tick.cooldownMs
    expect(decidePlay(state, 'ui_tick', 1000 + cd - 1)).toMatchObject({
      ok: false,
      reason: 'cooldown',
    })
    expect(decidePlay(state, 'ui_tick', 1000 + cd).ok).toBe(true)
  })

  it('force bypasses cooldown', () => {
    const state = createSfxPolicyState({ unlocked: true })
    const first = decidePlay(state, 'coyote', 1000)
    if (first.ok) applyPlayAccepted(state, 'coyote', 1000, first)
    expect(decidePlay(state, 'coyote', 1001, { force: true }).ok).toBe(true)
  })

  it('ducks lower priority after high priority play', () => {
    const state = createSfxPolicyState({ unlocked: true, volume: 1 })
    const coyote = decidePlay(state, 'coyote', 1000)
    expect(coyote.ok).toBe(true)
    if (coyote.ok) applyPlayAccepted(state, 'coyote', 1000, coyote)

    const tick = decidePlay(state, 'ui_tick', 1050)
    expect(tick.ok).toBe(true)
    if (tick.ok) {
      // Ducked vs unducked full volume
      expect(tick.effectiveGain).toBeLessThan(0.5)
    }
  })

  it('applies pitch clamp', () => {
    const state = createSfxPolicyState({ unlocked: true })
    const hi = decidePlay(state, 'bid_land', 1000, { pitch: 99 })
    expect(hi.ok && hi.pitch).toBe(2.5)
    const lo = decidePlay(state, 'bid_land', 2000, { pitch: 0.01 })
    expect(lo.ok && lo.pitch).toBe(0.4)
  })
})

describe('pitch helpers', () => {
  it('HEAT raises pitch stepwise', () => {
    expect(pitchForHeat('none')).toBe(1)
    expect(pitchForHeat('heating')).toBeGreaterThan(pitchForHeat('warm'))
    expect(pitchForHeat('wild')).toBeGreaterThan(pitchForHeat('danger'))
  })

  it('RAISE multiplies into bid_land pitch', () => {
    expect(pitchForRaise('wild')).toBeGreaterThan(pitchForRaise('nice'))
    const p = pitchForBidLand({ heat: 'danger', tier: 'big' })
    expect(p).toBeGreaterThan(1)
    expect(p).toBeLessThanOrEqual(2)
  })
})
