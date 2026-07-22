/** Pure domain types for the Wild Count game engine. No UI / I/O deps. */

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type CardKind =
  | 'number'
  | 'double'
  | 'half'
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
   * Undefined for pure specials (double, half, max_to_zero, redraw).
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
  /** 1/2 card (extra rule). Multiplier ÷2 per card. */
  half: number
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
  halfCount: number
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
  /** Lives lost by the loser (1 default; 2 when life-double attached) */
  lifeLoss: number
  /**
   * Hands after `?` open (challenge resolve). Always set by the engine.
   * Result UI uses this so opened faces match the total.
   */
  resolvedHands: Record<PlayerId, Card[]>
  /**
   * Replacement card ids that came from opening a `?` this challenge.
   * Empty when no redraw was in play.
   */
  openedFromRedrawIds: readonly string[]
}

// ---------------------------------------------------------------------------
// Extra rules (host toggles; default all false)
// ---------------------------------------------------------------------------

/**
 * Lobby / GameConfig toggles for optional rules.
 * All false → identical to MVP behaviour.
 * Spec: docs/extra-rules.md
 */
/**
 * Host toggles for optional *turn* actions.
 * Note: 1/2 (half) cards are deck composition only — not a toggle here.
 */
export interface ExtraRulesConfig {
  /** Same (pass-like keep bid) */
  same: boolean
  /** Change (force previous bidder to rebid) */
  change: boolean
  /** Reverse turn direction (bid attach) */
  reverse: boolean
  /** Shot: name next turn player (bid attach) */
  shot: boolean
  /** Draw +1 card for another player (bid attach; 1/round table) */
  draw1: boolean
  /** Life double: next challenge loser loses 2 lives (bid attach) */
  lifeDouble: boolean
}

export const DEFAULT_EXTRA_RULES: ExtraRulesConfig = Object.freeze({
  same: false,
  change: false,
  reverse: false,
  shot: false,
  draw1: false,
  lifeDouble: false,
})

export type TurnDirection = 1 | -1

export type LastActionKind = 'bid' | 'same' | 'change' | 'challenge' | null

/** Forced rebid after CHANGE (see docs/extra-rules.md §2.3). */
export interface PendingChangeRebid {
  playerId: PlayerId
  /** Discarded bid B — cannot redeclare this value */
  forbiddenValue: number
  /** Previous bid A; null when only opening bid existed */
  minExclusive: number | null
  /** After rebid, turn goes to this player (the CHANGE user) */
  resumeNextPlayerId: PlayerId
}

export type BidExtraAction =
  | { type: 'reverse' }
  | { type: 'shot'; targetId: PlayerId }
  | { type: 'draw1'; targetId: PlayerId }
  | { type: 'life_double' }

// ---------------------------------------------------------------------------
// Game config & phase
// ---------------------------------------------------------------------------

/**
 * When the match ends after life loss / force-eliminate.
 * - `first_elimination` (default): any player reaching 0 lives ends the game
 * - `last_standing`: classic last-survivor; continues until one remains
 */
export type WinCondition = 'first_elimination' | 'last_standing'

export const DEFAULT_WIN_CONDITION: WinCondition = 'first_elimination'

export interface GameConfig {
  /** Default 3 */
  initialLives: number
  /**
   * Minimum first bid of a round (inclusive).
   * Default: 1 (宣言は 1 以上).
   */
  minOpeningBid: number
  /**
   * Deck recipe used at START_GAME.
   * Room host can later choose a preset or custom counts.
   * Default: STANDARD_DECK (see deck.ts).
   */
  deck: DeckComposition
  /** Extra rules toggles (default all false). */
  extraRules: ExtraRulesConfig
  /**
   * Match end condition (default: first_elimination).
   * Host can switch to last_standing in the lobby.
   */
  winCondition: WinCondition
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
  /**
   * Alive players' face-down cards this round.
   * Usually one card; draw1 can add more → array.
   */
  hands: Readonly<Record<PlayerId, readonly Card[]>>
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

  // --- Extra rules state (harmless when all toggles OFF) ---
  /** Seat order direction; reset to +1 each round */
  turnDirection: TurnDirection
  /** Last player action this round (for same-chain ban etc.) */
  lastAction: LastActionKind
  /**
   * Bid value immediately under currentBid (A when current is B).
   * Used as CHANGE rebid floor. null when current is the opening bid.
   */
  bidUnderCurrent: number | null
  /** Set while the previous bidder must redeclare after CHANGE */
  pendingChangeRebid: PendingChangeRebid | null
  /** Player ids who already used their personal action slot this round */
  extraActionUsedThisRound: readonly PlayerId[]
  /** True after draw1 is used once this round */
  draw1UsedThisRound: boolean
  /** True when last bid carried life_double (next challenge → −2 lives) */
  pendingLifeDouble: boolean
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'START_ROUND' }
  | { type: 'PLACE_BID'; value: number; extra?: BidExtraAction }
  | { type: 'SAME' }
  | { type: 'CHANGE' }
  | { type: 'CHALLENGE' }

export interface StartGameInput {
  playerIds: PlayerId[]
  /**
   * Partial config. `deck` may be a full DeckComposition or a preset id
   * string (e.g. "standard") — resolved in createInitialState.
   */
  config?: Omit<Partial<GameConfig>, 'deck' | 'extraRules'> & {
    deck?: DeckComposition | string
    extraRules?: Partial<ExtraRulesConfig>
    winCondition?: WinCondition
  }
}

// ---------------------------------------------------------------------------
// Legal moves
// ---------------------------------------------------------------------------

export type LegalMove =
  | {
      type: 'PLACE_BID'
      minValue: number
      /** When set (CHANGE rebid), value must not equal this */
      forbiddenValue?: number
      /** Attach extras allowed on this bid */
      extrasAllowed: boolean
    }
  | { type: 'CHALLENGE' }
  | { type: 'SAME' }
  | { type: 'CHANGE' }

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
