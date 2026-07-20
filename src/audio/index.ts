/**
 * Public SFX API (D2).
 */

export {
  SfxEngine,
  getSfxEngine,
  playSfx,
  __setSfxEngineForTests,
  type SfxPlayResult,
  type SfxEngineOptions,
} from './sfxEngine'
export {
  loadSfxSettings,
  saveSfxSettings,
  saveSfxEnabled,
  saveSfxVolume,
  clampVolume,
  parseEnabled,
  DEFAULT_SFX_ENABLED,
  DEFAULT_SFX_VOLUME,
  type SfxSettings,
} from './sfxSettings'
export {
  pitchForBidLand,
  pitchForHeat,
  pitchForRaise,
  decidePlay,
  createSfxPolicyState,
  applyPlayAccepted,
} from './sfxPolicy'
export {
  SFX_CATALOG,
  type SfxId,
  type SfxCategory,
  type SfxPriority,
  type PlaySfxOptions,
} from './sfxTypes'
