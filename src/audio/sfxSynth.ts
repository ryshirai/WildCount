/**
 * Procedural SFX via Web Audio (no external audio assets).
 * Short UI / game feedback tones — desert-night feel without music beds.
 */

import type { SfxId } from './sfxTypes'

type SynthOpts = {
  ctx: AudioContext
  dest: AudioNode
  /** Absolute AudioContext time to start */
  when: number
  gain: number
  pitch: number
}

function envGain(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), when + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay)
  g.connect(dest)
  return g
}

function osc(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  when: number,
  duration: number,
  dest: AudioNode,
): OscillatorNode {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, when)
  o.connect(dest)
  o.start(when)
  o.stop(when + duration + 0.02)
  return o
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function playNoise(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  duration: number,
  peak: number,
): void {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, duration + 0.02)
  const g = envGain(ctx, dest, when, peak, 0.004, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(900, when)
  src.connect(filter)
  filter.connect(g)
  src.start(when)
  src.stop(when + duration + 0.03)
}

/** Schedule a named SFX into the graph. Returns approx duration (s). */
export function scheduleSfx(id: SfxId, opts: SynthOpts): number {
  const { ctx, dest, when, gain, pitch } = opts
  const p = pitch
  const g = gain

  switch (id) {
    case 'ui_tick': {
      const eg = envGain(ctx, dest, when, g * 0.22, 0.003, 0.045)
      osc(ctx, 'triangle', 880 * p, when, 0.05, eg)
      return 0.06
    }
    case 'ui_boundary': {
      const eg = envGain(ctx, dest, when, g * 0.18, 0.004, 0.06)
      osc(ctx, 'square', 220 * p, when, 0.07, eg)
      return 0.08
    }
    case 'bid_land': {
      // Soft thump + bright ping (table hit)
      const body = envGain(ctx, dest, when, g * 0.38, 0.004, 0.14)
      osc(ctx, 'sine', 140 * p, when, 0.16, body)
      const ping = envGain(ctx, dest, when + 0.02, g * 0.28, 0.003, 0.12)
      osc(ctx, 'triangle', 660 * p, when + 0.02, 0.14, ping)
      playNoise(ctx, dest, when, 0.04, g * 0.08)
      return 0.2
    }
    case 'turn_self': {
      // Clear “your turn” attention chime — easy to notice without looking.
      // Soft body thump + bright ascending C–E–G triad (distinct from bid_land).
      const body = envGain(ctx, dest, when, g * 0.42, 0.005, 0.14)
      osc(ctx, 'sine', 160 * p, when, 0.16, body)
      playNoise(ctx, dest, when, 0.035, g * 0.07)
      const notes = [523.25, 659.25, 783.99] // C5 E5 G5
      notes.forEach((f, i) => {
        const t = when + 0.05 + i * 0.11
        const peak = g * (0.52 - i * 0.05)
        const eg = envGain(ctx, dest, t, peak, 0.008, 0.22)
        osc(ctx, 'sine', f * p, t, 0.24, eg)
        // Octave harmonic for cut-through on phone speakers
        const bright = envGain(ctx, dest, t, peak * 0.38, 0.004, 0.12)
        osc(ctx, 'triangle', f * 2 * p, t, 0.12, bright)
      })
      return 0.48
    }
    case 'extra': {
      const eg = envGain(ctx, dest, when, g * 0.34, 0.006, 0.18)
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(320 * p, when)
      o.frequency.exponentialRampToValueAtTime(720 * p, when + 0.12)
      o.connect(eg)
      o.start(when)
      o.stop(when + 0.22)
      return 0.24
    }
    case 'coyote': {
      // Sting: low hit + rising howl fragment
      const hit = envGain(ctx, dest, when, g * 0.5, 0.005, 0.2)
      osc(ctx, 'sine', 70 * p, when, 0.22, hit)
      playNoise(ctx, dest, when, 0.08, g * 0.15)
      const howl = envGain(ctx, dest, when + 0.06, g * 0.35, 0.02, 0.35)
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(280 * p, when + 0.06)
      o.frequency.exponentialRampToValueAtTime(520 * p, when + 0.28)
      o.connect(howl)
      o.start(when + 0.06)
      o.stop(when + 0.45)
      return 0.48
    }
    case 'card_flip': {
      playNoise(ctx, dest, when, 0.035, g * 0.12)
      const eg = envGain(ctx, dest, when, g * 0.16, 0.002, 0.04)
      osc(ctx, 'triangle', 1200 * p, when, 0.04, eg)
      return 0.05
    }
    case 'result_slam': {
      const eg = envGain(ctx, dest, when, g * 0.55, 0.004, 0.28)
      osc(ctx, 'sine', 90 * p, when, 0.3, eg)
      const bright = envGain(ctx, dest, when + 0.03, g * 0.3, 0.005, 0.2)
      osc(ctx, 'triangle', 440 * p, when + 0.03, 0.22, bright)
      playNoise(ctx, dest, when, 0.06, g * 0.12)
      return 0.35
    }
    case 'result_win': {
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((f, i) => {
        const t = when + i * 0.09
        const eg = envGain(ctx, dest, t, g * 0.28, 0.01, 0.22)
        osc(ctx, 'sine', f * p, t, 0.24, eg)
      })
      return 0.55
    }
    case 'result_lose': {
      const notes = [392, 349.23, 293.66]
      notes.forEach((f, i) => {
        const t = when + i * 0.12
        const eg = envGain(ctx, dest, t, g * 0.26, 0.015, 0.28)
        osc(ctx, 'triangle', f * p, t, 0.3, eg)
      })
      return 0.5
    }
    case 'timer_pulse': {
      // Soft dual thump (heartbeat-ish), low volume
      const eg1 = envGain(ctx, dest, when, g * 0.14, 0.004, 0.1)
      osc(ctx, 'sine', 80 * p, when, 0.12, eg1)
      const eg2 = envGain(ctx, dest, when + 0.16, g * 0.1, 0.004, 0.1)
      osc(ctx, 'sine', 70 * p, when + 0.16, 0.12, eg2)
      return 0.35
    }
    default:
      return 0
  }
}
