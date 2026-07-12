import {
  createDeck,
  resolveDeckComposition,
  shuffle,
  STANDARD_DECK,
  validateDeckComposition,
} from './deck'
import type { RandomSource } from './random'
import {
  alivePlayers,
  applyLifeLoss,
  resolveChallenge,
  soleSurvivor,
} from './resolve'
import { describeIllegal, getLegalMoves } from './validate'
import type {
  Card,
  GameAction,
  GameConfig,
  GameState,
  Player,
  PlayerId,
  StartGameInput,
} from './types'
import { GameError } from './types'

export const DEFAULT_CONFIG: GameConfig = {
  initialLives: 3,
  /** Opening bid must be at least 1 (no zero / free open). */
  minOpeningBid: 1,
  deck: STANDARD_DECK,
}

const MIN_PLAYERS = 2
const MAX_PLAYERS = 10

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a lobby state with players seated in the given order.
 * Call applyAction(state, { type: 'START_GAME' }, rng) or startGame() helper.
 */
export function createInitialState(input: StartGameInput): GameState {
  const ids = input.playerIds
  if (ids.length < MIN_PLAYERS || ids.length > MAX_PLAYERS) {
    throw new GameError(
      `Player count must be ${MIN_PLAYERS}–${MAX_PLAYERS}, got ${ids.length}`,
      'INVALID_PLAYER_COUNT',
    )
  }
  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    throw new GameError('Duplicate player ids', 'INVALID_PLAYER_COUNT')
  }

  const raw = input.config ?? {}
  const deck = resolveDeckComposition(raw.deck)
  validateDeckComposition(deck)

  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    initialLives: raw.initialLives ?? DEFAULT_CONFIG.initialLives,
    minOpeningBid: raw.minOpeningBid ?? DEFAULT_CONFIG.minOpeningBid,
    deck,
  }

  const players: Player[] = ids.map((id, seatIndex) => ({
    id,
    seatIndex,
    lives: config.initialLives,
    alive: true,
  }))

  return {
    config,
    phase: 'lobby',
    round: 0,
    players,
    deck: [],
    discard: [],
    hands: {},
    currentBid: null,
    currentBidderId: null,
    currentTurnPlayerId: null,
    roundStartSeatIndex: 0,
    lastOutcome: null,
    winnerId: null,
    revision: 0,
  }
}

/** Convenience: create state and start first round in one step. */
export function startGame(input: StartGameInput, rng: RandomSource): GameState {
  const lobby = createInitialState(input)
  return applyAction(lobby, { type: 'START_GAME' }, rng)
}

/**
 * Reduce: pure state transition.
 * Always returns a new GameState (immutable).
 */
export function applyAction(
  state: GameState,
  action: GameAction,
  rng: RandomSource,
): GameState {
  if (state.phase === 'game_over' && action.type !== 'START_GAME') {
    throw new GameError('Game is over', 'GAME_OVER')
  }

  switch (action.type) {
    case 'START_GAME':
      return doStartGame(state, rng)
    case 'START_ROUND':
      return doStartRound(state, rng)
    case 'PLACE_BID':
      return doPlaceBid(state, action.value)
    case 'CHALLENGE':
      return doChallenge(state, rng)
    default: {
      const _exhaustive: never = action
      throw new GameError(
        `Unknown action: ${JSON.stringify(_exhaustive)}`,
        'INVALID_ACTION',
      )
    }
  }
}

export { getLegalMoves }

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function doStartGame(state: GameState, rng: RandomSource): GameState {
  if (state.phase !== 'lobby') {
    throw new GameError('START_GAME only from lobby', 'INVALID_PHASE')
  }
  const deck = shuffle(createDeck(state.config.deck), rng)
  const withDeck: GameState = {
    ...state,
    deck,
    discard: [],
    revision: state.revision + 1,
  }
  return dealAndEnterBidding(withDeck, rng, /* startSeat */ 0)
}

function doStartRound(state: GameState, rng: RandomSource): GameState {
  const err = describeIllegal(state, { type: 'START_ROUND' })
  if (err) throw new GameError(err, 'INVALID_ACTION')

  // Next round starts with the next alive seat after previous starter,
  // or the loser of the last challenge if available (Coyote-ish feel).
  let startSeat = state.roundStartSeatIndex
  if (state.lastOutcome) {
    const loser = state.players.find((p) => p.id === state.lastOutcome!.loserId)
    if (loser && loser.alive) {
      startSeat = loser.seatIndex
    } else {
      startSeat = nextAliveSeatIndex(state.players, state.roundStartSeatIndex)
    }
  } else {
    startSeat = nextAliveSeatIndex(state.players, state.roundStartSeatIndex)
  }

  // Move previous hands to discard before re-deal (no-op if already cleared)
  const prevCards = Object.values(state.hands)
  const withDiscard: GameState = {
    ...state,
    discard: [...state.discard, ...prevCards],
    hands: {},
    // Keep lastOutcome until the next challenge overwrites it
    revision: state.revision + 1,
  }

  return dealAndEnterBidding(withDiscard, rng, startSeat)
}

function doPlaceBid(state: GameState, value: number): GameState {
  const err = describeIllegal(state, { type: 'PLACE_BID', value })
  if (err) {
    throw new GameError(err, err.includes('integer') ? 'INVALID_BID' : 'INVALID_ACTION')
  }
  if (state.currentTurnPlayerId == null) {
    throw new GameError('No current turn', 'INVALID_ACTION')
  }

  const bidderId = state.currentTurnPlayerId
  const nextTurn = nextAlivePlayerId(state.players, bidderId)

  return {
    ...state,
    currentBid: value,
    currentBidderId: bidderId,
    currentTurnPlayerId: nextTurn,
    revision: state.revision + 1,
  }
}

function doChallenge(state: GameState, _rng: RandomSource): GameState {
  const err = describeIllegal(state, { type: 'CHALLENGE' })
  if (err) throw new GameError(err, 'INVALID_ACTION')

  const challengerId = state.currentTurnPlayerId!
  const bidderId = state.currentBidderId!
  const bid = state.currentBid!

  // Resolve with cards currently in hands (alive players only; dead have no hand)
  const cards = Object.values(state.hands)
  const outcome = resolveChallenge({
    cards,
    bid,
    bidderId,
    challengerId,
  })

  const players = applyLifeLoss(state.players, outcome.loserId)
  const winner = soleSurvivor(players)

  // Spent hands → discard after reveal
  const discard = [...state.discard, ...cards]

  if (winner) {
    return {
      ...state,
      phase: 'game_over',
      players,
      hands: {},
      discard,
      lastOutcome: outcome,
      winnerId: winner.id,
      currentBid: null,
      currentBidderId: null,
      currentTurnPlayerId: null,
      revision: state.revision + 1,
    }
  }

  // Stop at round_end — callers (sim / local / Worker) apply START_ROUND only
  // after everyone has left the result screen (or immediately in pure sims).
  return {
    ...state,
    phase: 'round_end',
    players,
    hands: {},
    discard,
    lastOutcome: outcome,
    currentBid: null,
    currentBidderId: null,
    currentTurnPlayerId: null,
    revision: state.revision + 1,
  }
}

/**
 * Force-eliminate a player (mid-game leave / disconnect timeout forfeit).
 *
 * - Sets lives to 0 and alive=false
 * - Keeps this round's hand so a later challenge still counts their card
 * - Advances the turn if it was theirs
 * - Ends the game when one survivor remains (or zero survivors)
 *
 * No-op when already dead, lobby, or game_over.
 */
export function forceEliminatePlayer(
  state: GameState,
  playerId: PlayerId,
): GameState {
  if (state.phase === 'lobby' || state.phase === 'game_over') {
    return state
  }
  const target = state.players.find((p) => p.id === playerId)
  if (!target || !target.alive) {
    return state
  }

  const players: Player[] = state.players.map((p) =>
    p.id === playerId ? { ...p, lives: 0, alive: false } : p,
  )
  const winner = soleSurvivor(players)
  const living = alivePlayers(players)

  if (winner) {
    // Hand cards discarded without reveal when game ends by forfeit mid-round
    const discarded = [...state.discard, ...Object.values(state.hands)]
    return {
      ...state,
      phase: 'game_over',
      players,
      hands: {},
      discard: discarded,
      winnerId: winner.id,
      currentBid: null,
      currentBidderId: null,
      currentTurnPlayerId: null,
      revision: state.revision + 1,
    }
  }

  if (living.length === 0) {
    const discarded = [...state.discard, ...Object.values(state.hands)]
    return {
      ...state,
      phase: 'game_over',
      players,
      hands: {},
      discard: discarded,
      winnerId: null,
      currentBid: null,
      currentBidderId: null,
      currentTurnPlayerId: null,
      revision: state.revision + 1,
    }
  }

  let currentTurnPlayerId = state.currentTurnPlayerId
  if (currentTurnPlayerId === playerId) {
    currentTurnPlayerId = nextAlivePlayerId(players, playerId)
  }

  // Keep currentBid / currentBidderId even if the bidder left — others may still
  // challenge that number. Life loss on an already-dead bidder is a no-op.

  return {
    ...state,
    players,
    currentTurnPlayerId,
    revision: state.revision + 1,
  }
}

// ---------------------------------------------------------------------------
// Deal
// ---------------------------------------------------------------------------

/**
 * Deal one card to each living player, handling REDRAW / ZERO_MIX.
 *
 * Assumptions (documented for Phase 0; see work-log):
 * - REDRAW (?): on deal, discard the ? and draw again until a non-redraw card
 *   (or deck exhaustion error). The ? never stays in hand.
 * - ZERO_MIX (捨て札ミックス0): after being dealt into a hand, discard pile
 *   is shuffled back into the deck (山札リセット). Card stays as value 0.
 */
function dealAndEnterBidding(
  state: GameState,
  rng: RandomSource,
  startSeat: number,
): GameState {
  const living = alivePlayers(state.players)
  if (living.length < 2) {
    throw new GameError('Need at least 2 living players to deal', 'INVALID_ACTION')
  }

  let deck = state.deck.slice()
  let discard = state.discard.slice()
  const hands: Record<PlayerId, Card> = {}

  // Deal in seat order among living
  const ordered = [...living].sort((a, b) => a.seatIndex - b.seatIndex)

  for (const player of ordered) {
    const drawn = drawResolvingRedraw(deck, discard, rng)
    deck = drawn.deck
    discard = drawn.discard
    let card = drawn.card

    // ZERO_MIX: reshuffle discard into deck after receiving the card
    if (card.kind === 'zero_mix' && discard.length > 0) {
      deck = shuffle([...deck, ...discard], rng)
      discard = []
    }

    hands[player.id] = card
  }

  // Prefer exact seat; else next higher seat; else lowest seat (wrap)
  const turnPlayer = pickStartPlayer(living, startSeat)

  return {
    ...state,
    phase: 'bidding',
    round: state.round + 1,
    deck,
    discard,
    hands,
    currentBid: null,
    currentBidderId: null,
    currentTurnPlayerId: turnPlayer.id,
    roundStartSeatIndex: turnPlayer.seatIndex,
    winnerId: null,
    revision: state.revision + 1,
  }
}

function pickStartPlayer(living: Player[], preferredSeat: number): Player {
  const exact = living.find((p) => p.seatIndex === preferredSeat)
  if (exact) return exact
  const higher = living
    .filter((p) => p.seatIndex > preferredSeat)
    .sort((a, b) => a.seatIndex - b.seatIndex)[0]
  if (higher) return higher
  return living.reduce((a, b) => (a.seatIndex < b.seatIndex ? a : b))
}

/**
 * Draw one playable card. REDRAW cards are discarded and replaced.
 * If the draw pile is empty, discard is shuffled back in.
 * If still empty after that → DECK_EXHAUSTED.
 */
function drawResolvingRedraw(
  deck: Card[],
  discard: Card[],
  rng: RandomSource,
): { card: Card; deck: Card[]; discard: Card[] } {
  let d = deck
  let disc = discard
  const maxAttempts = DECK_HARD_LIMIT

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const filled = ensureDeckHasCards(d, disc, rng)
    d = filled.deck
    disc = filled.discard

    if (d.length === 0) {
      throw new GameError(
        'Deck exhausted: no cards left to draw after reshuffling discard',
        'DECK_EXHAUSTED',
      )
    }

    // Pop from end (top of pile)
    const card = d[d.length - 1]!
    d = d.slice(0, -1)

    if (card.kind === 'redraw') {
      // Assumption: redraw is discarded immediately; draw again.
      disc = [...disc, card]
      continue
    }

    return { card, deck: d, discard: disc }
  }

  throw new GameError(
    'Deck exhausted: only REDRAW cards remaining',
    'DECK_EXHAUSTED',
  )
}

/** Safety bound for redraw loops (deck is small). */
const DECK_HARD_LIMIT = 64

function ensureDeckHasCards(
  deck: Card[],
  discard: Card[],
  rng: RandomSource,
): { deck: Card[]; discard: Card[] } {
  if (deck.length > 0) return { deck, discard }
  if (discard.length === 0) return { deck, discard }
  return {
    deck: shuffle(discard, rng),
    discard: [],
  }
}

// ---------------------------------------------------------------------------
// Seat helpers
// ---------------------------------------------------------------------------

function nextAlivePlayerId(
  players: readonly Player[],
  afterId: PlayerId,
): PlayerId {
  const living = alivePlayers(players).sort((a, b) => a.seatIndex - b.seatIndex)
  const idx = living.findIndex((p) => p.id === afterId)
  if (idx < 0) {
    // Current player might have been eliminated mid-logic; start from lowest
    return living[0]!.id
  }
  return living[(idx + 1) % living.length]!.id
}

function nextAliveSeatIndex(
  players: readonly Player[],
  afterSeat: number,
): number {
  const living = alivePlayers(players).sort((a, b) => a.seatIndex - b.seatIndex)
  const higher = living.find((p) => p.seatIndex > afterSeat)
  if (higher) return higher.seatIndex
  return living[0]!.seatIndex
}
