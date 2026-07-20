/**
 * Gameplay dopamine D4 — haptic pattern catalog.
 * Spec: `docs/gameplay-dopamine-plan.md` §5.3, §7 D4.
 *
 * Patterns are Vibration API sequences: number = vibrate ms,
 * alternating with gap ms (navigator.vibrate([v, gap, v, ...])).
 */

export type HapticId =
  | 'turn_self'
  | 'wild_call'
  | 'coyote'
  | 'life_loss'

export type HapticCatalogEntry = {
  id: HapticId
  /** Vibration pattern in ms (Vibration API). */
  pattern: number | number[]
  /** Min ms between plays of the same id (anti-spam). */
  cooldownMs: number
}

/**
 * Plan §5.3:
 * - 手番: 短振動 1 回
 * - WILD CALL: 短振動 2 回
 * - COYOTE: 強・間・強
 * - ライフ喪失: 中程度 2 回
 *
 * Keep patterns short; no continuous / per-second vibrate.
 */
export const HAPTIC_CATALOG: Record<HapticId, HapticCatalogEntry> = {
  turn_self: {
    id: 'turn_self',
    pattern: 36,
    cooldownMs: 450,
  },
  wild_call: {
    id: 'wild_call',
    // short · gap · short
    pattern: [28, 42, 28],
    cooldownMs: 350,
  },
  coyote: {
    id: 'coyote',
    // strong · gap · strong
    pattern: [72, 55, 72],
    cooldownMs: 500,
  },
  life_loss: {
    id: 'life_loss',
    // medium · gap · medium
    pattern: [48, 48, 48],
    cooldownMs: 500,
  },
}

export type PlayHapticOptions = {
  /** Skip per-id cooldown (rare). */
  force?: boolean
}
