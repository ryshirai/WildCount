/**
 * Wild Count pure game engine (Phase 0).
 *
 * No DOM / localStorage / WebSocket / Vue / Pinia dependencies.
 * Inject RandomSource for all randomness.
 */

export type {
  Card,
  CardKind,
  NumberCount,
  SpecialCounts,
  DeckComposition,
  Player,
  PlayerId,
  CalculationStep,
  CalculationResult,
  ChallengeLoserRole,
  ChallengeOutcome,
  GameConfig,
  GamePhase,
  GameState,
  GameAction,
  StartGameInput,
  LegalMove,
} from './types'
export { GameError } from './types'

export {
  createDeck,
  shuffle,
  cardLabel,
  countCards,
  validateDeckComposition,
  validateRoomDeckComposition,
  resolveDeckComposition,
  defineDeckComposition,
  cloneDeckComposition,
  toEditorDeckComposition,
  isStandardDeckComposition,
  deckSummaryLabel,
  STANDARD_DECK,
  DECK_PRESETS,
  DECK_SIZE,
  MAX_CUSTOM_DECK_CARDS,
  MIN_CUSTOM_DECK_CARDS,
  DECK_EDITOR_NUMBER_VALUES,
} from './deck'
export type { DeckPresetId } from './deck'

export type { RandomSource } from './random'
export { seedRandom, mathRandomSource, randomInt } from './random'

export { calculateTotal } from './calculate'

export {
  resolveChallenge,
  applyLifeLoss,
  alivePlayers,
  soleSurvivor,
} from './resolve'

export {
  createInitialState,
  startGame,
  applyAction,
  getLegalMoves,
  forceEliminatePlayer,
  DEFAULT_CONFIG,
} from './engine'

export {
  canPlaceBid,
  canChallenge,
  describeIllegal,
  isPlayersTurn,
  getPlayer,
} from './validate'
