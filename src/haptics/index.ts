/**
 * Public haptic API (D4).
 */

export {
  HapticEngine,
  getHapticEngine,
  playHaptic,
  __setHapticEngineForTests,
  type HapticPlayResult,
  type HapticEngineOptions,
  type VibrateFn,
} from './hapticEngine'
export {
  loadHapticSettings,
  saveHapticSettings,
  saveHapticEnabled,
  parseHapticEnabled,
  DEFAULT_HAPTIC_ENABLED,
  HAPTIC_ENABLED_KEY,
  type HapticSettings,
} from './hapticSettings'
export {
  decideHaptic,
  createHapticPolicyState,
  applyHapticAccepted,
} from './hapticPolicy'
export {
  HAPTIC_CATALOG,
  type HapticId,
  type PlayHapticOptions,
} from './hapticTypes'
