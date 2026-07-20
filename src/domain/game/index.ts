/**
 * Wild Count pure game engine (Phase 0 + Extra rules).
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
  ExtraRulesConfig,
  TurnDirection,
  LastActionKind,
  PendingChangeRebid,
  BidExtraAction,
  GameConfig,
  GamePhase,
  GameState,
  GameAction,
  StartGameInput,
  LegalMove,
  WinCondition,
} from './types'
export {
  GameError,
  DEFAULT_EXTRA_RULES,
  DEFAULT_WIN_CONDITION,
} from './types'

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
  normalizeSpecials,
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
  evaluateGameEnd,
  allHandCards,
} from './resolve'
export type { GameEndEvaluation } from './resolve'

export {
  createInitialState,
  startGame,
  applyAction,
  getLegalMoves,
  forceEliminatePlayer,
  nextAlivePlayerId,
  DEFAULT_CONFIG,
} from './engine'

export {
  canPlaceBid,
  canChallenge,
  canSame,
  canChange,
  canAttachExtra,
  describeIllegal,
  isPlayersTurn,
  getPlayer,
  hasUsedExtraAction,
  minBidValue,
} from './validate'
