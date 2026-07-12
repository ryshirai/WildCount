/** Pure domain types for the Wild Count game engine. No UI / I/O deps. */

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type CardKind =
  | 'number'
  | 'double'
  | 'max_to_zero'
  | 'redraw'
  | 'zero_mix'

export interface Card {
  /** Stable unique id within a deck instance */
  id: string
  kind: CardKind
  /**
   * Numeric value for `number` cards.
   * `zero_mix` is treated as 0 in totals (value may be 0 for display).
   * Undefined for pure specials (double, max_to_zero, redraw).
   */
  value?: number
}

// ---------------------------------------------------------------------------
// Deck composition (room-configurable)
// ---------------------------------------------------------------------------

/** How many of each numeric value to put in the deck. */
export interface NumberCount {
  value: number
  count: number
}

/** Counts for non-number cards. All keys required (use 0 to omit). */
export interface SpecialCounts {
  double: number
  max_to_zero: number
  redraw: number
  zero_mix: number
}

/**
 * Declarative deck recipe.
 * Room creation can pick a preset id or supply a custom composition.
 * Engine builds cards only via createDeck(composition).
 */
export interface DeckComposition {
  /** Optional preset / custom id (e.g. "standard", "large") */
  id?: string
  /** Optional UI label */
  label?: string
  numbers: readonly NumberCount[]
  specials: SpecialCounts
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export type PlayerId = string

export interface Player {
  id: PlayerId
  /** Seat order (0-based). Turn order follows ascending seatIndex among alive. */
  seatIndex: number
  lives: number
  /** Derived convenience; lives > 0 when true */
  alive: boolean
}

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

export interface CalculationStep {
  id: string
  title: string
  detail: string
  /** Intermediate total after this step, when applicable */
  totalAfter?: number
}

export interface CalculationResult {
  steps: CalculationStep[]
  finalTotal: number
  /** Cards after MAX_TO_ZERO zeroing (value may change for number cards) */
  adjustedCards: Card[]
  doubleCount: number
  maxToZeroApplied: boolean
  rawNumberSum: number
}

// ---------------------------------------------------------------------------
// Challenge
// ---------------------------------------------------------------------------

export type ChallengeLoserRole = 'bidder' | 'challenger'

export interface ChallengeOutcome {
  bid: number
  actualTotal: number
  calculation: CalculationResult
  /** true when actualTotal >= bid */
  bidderWins: boolean
  loserRole: ChallengeLoserRole
  loserId: PlayerId
  bidderId: PlayerId
  challengerId: PlayerId
}

// ---------------------------------------------------------------------------
// Game config & phase
// ---------------------------------------------------------------------------

export interface GameConfig {
  /** Default 3 */
  initialLives: number
  /**
   * Minimum first bid of a round (inclusive).
   * Phase 0: fixed at 0.
   */
  minOpeningBid: number
  /**
   * Deck recipe used at START_GAME.
   * Room host can later choose a preset or custom counts.
   * Default: STANDARD_DECK (see deck.ts).
   */
  deck: DeckComposition
}

export type GamePhase =
  | 'lobby'
  | 'bidding'
  | 'resolving'
  | 'round_end'
  | 'game_over'

// ---------------------------------------------------------------------------
// Game state (immutable snapshots)
// ---------------------------------------------------------------------------

export interface GameState {
  config: GameConfig
  phase: GamePhase
  /** 1-based round number; 0 before first startRound */
  round: number
  players: readonly Player[]
  /** Draw pile (top = end of array for pop) */
  deck: readonly Card[]
  discard: readonly Card[]
  /** Alive players' face-down cards this round */
  hands: Readonly<Record<PlayerId, Card>>
  /** Current bid value, or null if no bid yet this round */
  currentBid: number | null
  /** Player who placed currentBid */
  currentBidderId: PlayerId | null
  /** Whose turn to act (bid or challenge) */
  currentTurnPlayerId: PlayerId | null
  /** Seat index that opened the current round's bidding */
  roundStartSeatIndex: number
  /** Last challenge outcome (set after resolve, cleared on next deal) */
  lastOutcome: ChallengeOutcome | null
  /** Sole survivor when phase === 'game_over' */
  winnerId: PlayerId | null
  /** Revision counter for consumers (optional bookkeeping) */
  revision: number
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'START_ROUND' }
  | { type: 'PLACE_BID'; value: number }
  | { type: 'CHALLENGE' }

export interface StartGameInput {
  playerIds: PlayerId[]
  /**
   * Partial config. `deck` may be a full DeckComposition or a preset id
   * string (e.g. "standard") — resolved in createInitialState.
   */
  config?: Omit<Partial<GameConfig>, 'deck'> & {
    deck?: DeckComposition | string
  }
}

// ---------------------------------------------------------------------------
// Legal moves
// ---------------------------------------------------------------------------

export type LegalMove =
  | { type: 'PLACE_BID'; minValue: number }
  | { type: 'CHALLENGE' }

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GameError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'INVALID_ACTION'
      | 'INVALID_PHASE'
      | 'INVALID_BID'
      | 'NOT_YOUR_TURN'
      | 'DECK_EXHAUSTED'
      | 'INVALID_PLAYER_COUNT'
      | 'INVALID_DECK'
      | 'GAME_OVER',
  ) {
    super(message)
    this.name = 'GameError'
  }
}
