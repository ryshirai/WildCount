import {
  cardLabel,
  createDeck,
  resolveDeckComposition,
  shuffle,
  STANDARD_DECK,
  validateDeckComposition,
} from './deck'
import type { RandomSource } from './random'
import { randomInt } from './random'
import {
  alivePlayers,
  allHandCards,
  applyLifeLoss,
  evaluateGameEnd,
  resolveChallenge,
} from './resolve'
import { describeIllegal, getLegalMoves } from './validate'
import type {
  BidExtraAction,
  Card,
  ExtraRulesConfig,
  GameAction,
  GameConfig,
  GameState,
  Player,
  PlayerId,
  StartGameInput,
  TurnDirection,
  WinCondition,
} from './types'
import {
  DEFAULT_EXTRA_RULES,
  DEFAULT_WIN_CONDITION,
  GameError,
} from './types'

export const DEFAULT_CONFIG: GameConfig = {
  initialLives: 3,
  /** Opening bid must be at least 1 (no zero / free open). */
  minOpeningBid: 1,
  deck: STANDARD_DECK,
  extraRules: DEFAULT_EXTRA_RULES,
  winCondition: DEFAULT_WIN_CONDITION,
}

function resolveWinCondition(raw: unknown): WinCondition {
  if (raw === 'last_standing' || raw === 'first_elimination') return raw
  return DEFAULT_WIN_CONDITION
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
  const extraRules: ExtraRulesConfig = {
    ...DEFAULT_EXTRA_RULES,
    ...(raw.extraRules ?? {}),
  }
  validateDeckComposition(deck)

  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    initialLives: raw.initialLives ?? DEFAULT_CONFIG.initialLives,
    minOpeningBid: raw.minOpeningBid ?? DEFAULT_CONFIG.minOpeningBid,
    deck,
    extraRules,
    winCondition: resolveWinCondition(raw.winCondition),
  }

  const players: Player[] = ids.map((id, seatIndex) => ({
    id,
    seatIndex,
    lives: config.initialLives,
    alive: true,
  }))

  return emptyExtraFields({
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
  })
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
      return doPlaceBid(state, action.value, action.extra, rng)
    case 'SAME':
      return doSame(state)
    case 'CHANGE':
      return doChange(state)
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
// Extra-field helpers
// ---------------------------------------------------------------------------

function emptyExtraFields(
  base: Omit<
    GameState,
    | 'turnDirection'
    | 'lastAction'
    | 'bidUnderCurrent'
    | 'pendingChangeRebid'
    | 'extraActionUsedThisRound'
    | 'draw1UsedThisRound'
    | 'pendingLifeDouble'
  >,
): GameState {
  return {
    ...base,
    turnDirection: 1,
    lastAction: null,
    bidUnderCurrent: null,
    pendingChangeRebid: null,
    extraActionUsedThisRound: [],
    draw1UsedThisRound: false,
    pendingLifeDouble: false,
  }
}

function resetRoundExtras<T extends GameState>(state: T): T {
  return {
    ...state,
    turnDirection: 1 as TurnDirection,
    lastAction: null,
    bidUnderCurrent: null,
    pendingChangeRebid: null,
    extraActionUsedThisRound: [],
    draw1UsedThisRound: false,
    pendingLifeDouble: false,
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function doStartGame(state: GameState, rng: RandomSource): GameState {
  if (state.phase !== 'lobby') {
    throw new GameError('START_GAME only from lobby', 'INVALID_PHASE')
  }
  // Seat order is join-order in lobby; randomize before first deal so the host
  // (typically seat 0 / first joiner) is not always the opener.
  const players = reshuffleSeats(state.players, rng)
  const startSeat = randomInt(rng, 0, players.length - 1)
  const deck = shuffle(createDeck(state.config.deck), rng)
  const withDeck = resetRoundExtras({
    ...state,
    players,
    deck,
    discard: [],
    revision: state.revision + 1,
  })
  return dealAndEnterBidding(withDeck, rng, startSeat)
}

function doStartRound(state: GameState, rng: RandomSource): GameState {
  const err = describeIllegal(state, { type: 'START_ROUND' })
  if (err) throw new GameError(err, 'INVALID_ACTION')

  // Prefer the last challenge loser as opener (by id — seats change below).
  let starterId: PlayerId | null = null
  if (state.lastOutcome) {
    const loser = state.players.find((p) => p.id === state.lastOutcome!.loserId)
    if (loser?.alive) {
      starterId = loser.id
    }
  }

  // Reseat every round so turn order around the table changes.
  const players = reshuffleSeats(state.players, rng)

  let startSeat: number
  if (starterId != null) {
    startSeat = players.find((p) => p.id === starterId)!.seatIndex
  } else {
    // Loser already out (or no outcome): random living opener.
    const living = alivePlayers(players)
    startSeat = living[randomInt(rng, 0, living.length - 1)]!.seatIndex
  }

  // Move previous hands to discard before re-deal (no-op if already cleared)
  const prevCards = allHandCards(state.hands)
  const withDiscard = resetRoundExtras({
    ...state,
    players,
    discard: [...state.discard, ...prevCards],
    hands: {},
    // Keep lastOutcome until the next challenge overwrites it
    revision: state.revision + 1,
  })

  return dealAndEnterBidding(withDiscard, rng, startSeat)
}

function doPlaceBid(
  state: GameState,
  value: number,
  extra: BidExtraAction | undefined,
  rng: RandomSource,
): GameState {
  const err = describeIllegal(state, { type: 'PLACE_BID', value, extra })
  if (err) {
    throw new GameError(err, err.includes('integer') ? 'INVALID_BID' : 'INVALID_ACTION')
  }
  if (state.currentTurnPlayerId == null) {
    throw new GameError('No current turn', 'INVALID_ACTION')
  }

  const bidderId = state.currentTurnPlayerId
  const rebid = state.pendingChangeRebid
  const isForcedRebid =
    rebid != null && rebid.playerId === bidderId

  // --- Forced rebid after CHANGE -------------------------------------------
  if (isForcedRebid && rebid) {
    return {
      ...state,
      currentBid: value,
      currentBidderId: bidderId,
      // A stays under the new B (discarded old B is not kept as under)
      bidUnderCurrent: rebid.minExclusive,
      currentTurnPlayerId: rebid.resumeNextPlayerId,
      pendingChangeRebid: null,
      pendingLifeDouble: false,
      lastAction: 'bid',
      revision: state.revision + 1,
    }
  }

  // --- Normal bid (+ optional attach) --------------------------------------
  let turnDirection = state.turnDirection
  let deck = state.deck
  let discard = state.discard
  let hands = state.hands
  let extraActionUsedThisRound = state.extraActionUsedThisRound
  let draw1UsedThisRound = state.draw1UsedThisRound
  let pendingLifeDouble = false
  let nextTurn: PlayerId

  if (extra) {
    extraActionUsedThisRound = [...extraActionUsedThisRound, bidderId]

    switch (extra.type) {
      case 'reverse': {
        turnDirection = (turnDirection === 1 ? -1 : 1) as TurnDirection
        nextTurn = nextAlivePlayerId(state.players, bidderId, turnDirection)
        break
      }
      case 'shot': {
        nextTurn = extra.targetId
        break
      }
      case 'life_double': {
        pendingLifeDouble = true
        nextTurn = nextAlivePlayerId(state.players, bidderId, turnDirection)
        break
      }
      case 'draw1': {
        draw1UsedThisRound = true
        // Keep `?` in hand — opened at challenge (same as deal).
        const drawn = drawOneCard(deck.slice(), discard.slice(), rng)
        deck = drawn.deck
        discard = drawn.discard
        let card = drawn.card
        if (card.kind === 'zero_mix' && discard.length > 0) {
          deck = shuffle([...deck, ...discard], rng)
          discard = []
        }
        const prev = hands[extra.targetId] ?? []
        hands = {
          ...hands,
          [extra.targetId]: [...prev, card],
        }
        nextTurn = nextAlivePlayerId(state.players, bidderId, turnDirection)
        break
      }
      default: {
        const _e: never = extra
        throw new GameError(`Unknown extra: ${JSON.stringify(_e)}`, 'INVALID_ACTION')
      }
    }
  } else {
    nextTurn = nextAlivePlayerId(state.players, bidderId, turnDirection)
  }

  // bidUnderCurrent: previous currentBid becomes the floor under the new bid
  const bidUnderCurrent = state.currentBid

  return {
    ...state,
    deck,
    discard,
    hands,
    currentBid: value,
    currentBidderId: bidderId,
    currentTurnPlayerId: nextTurn,
    turnDirection,
    bidUnderCurrent,
    pendingChangeRebid: null,
    extraActionUsedThisRound,
    draw1UsedThisRound,
    pendingLifeDouble,
    lastAction: 'bid',
    revision: state.revision + 1,
  }
}

function doSame(state: GameState): GameState {
  const err = describeIllegal(state, { type: 'SAME' })
  if (err) throw new GameError(err, 'INVALID_ACTION')
  if (state.currentTurnPlayerId == null) {
    throw new GameError('No current turn', 'INVALID_ACTION')
  }

  const actor = state.currentTurnPlayerId
  const nextTurn = nextAlivePlayerId(
    state.players,
    actor,
    state.turnDirection,
  )

  return {
    ...state,
    // bid / bidder unchanged
    currentTurnPlayerId: nextTurn,
    extraActionUsedThisRound: [...state.extraActionUsedThisRound, actor],
    pendingLifeDouble: false,
    lastAction: 'same',
    revision: state.revision + 1,
  }
}

function doChange(state: GameState): GameState {
  const err = describeIllegal(state, { type: 'CHANGE' })
  if (err) throw new GameError(err, 'INVALID_ACTION')
  if (
    state.currentTurnPlayerId == null ||
    state.currentBidderId == null ||
    state.currentBid == null
  ) {
    throw new GameError('No current turn / bid', 'INVALID_ACTION')
  }

  const actor = state.currentTurnPlayerId
  const prevBidder = state.currentBidderId
  const forbiddenValue = state.currentBid
  const minExclusive = state.bidUnderCurrent

  // After forced rebid, turn returns to the CHANGE user (not skipped)
  const resumeNextPlayerId = actor

  return {
    ...state,
    currentTurnPlayerId: prevBidder,
    pendingChangeRebid: {
      playerId: prevBidder,
      forbiddenValue,
      minExclusive,
      resumeNextPlayerId,
    },
    extraActionUsedThisRound: [...state.extraActionUsedThisRound, actor],
    pendingLifeDouble: false,
    lastAction: 'change',
    revision: state.revision + 1,
  }
}

function doChallenge(state: GameState, rng: RandomSource): GameState {
  const err = describeIllegal(state, { type: 'CHALLENGE' })
  if (err) throw new GameError(err, 'INVALID_ACTION')

  const challengerId = state.currentTurnPlayerId!
  const bidderId = state.currentBidderId!
  const bid = state.currentBid!
  const lifeLoss = state.pendingLifeDouble ? 2 : 1

  // Open any `?` (redraw) still in hands before calculating the total.
  const opened = openRedrawsInHands(
    state.hands,
    state.deck,
    state.discard,
    state.players,
    rng,
  )
  const cards = allHandCards(opened.hands)
  let outcome = resolveChallenge({
    cards,
    bid,
    bidderId,
    challengerId,
    lifeLoss,
  })

  // Attach resolve metadata + optional calc step for result UI / dopamine open.
  if (opened.openLabels.length > 0) {
    outcome = {
      ...outcome,
      calculation: {
        ...outcome.calculation,
        steps: [
          {
            id: 'redraw_open',
            title: '？オープン',
            detail: opened.openLabels.join(' · '),
          },
          ...outcome.calculation.steps,
        ],
      },
    }
  }
  outcome = {
    ...outcome,
    resolvedHands: opened.hands,
    openedFromRedrawIds: opened.openedFromRedrawIds,
  }

  const players = applyLifeLoss(state.players, outcome.loserId, lifeLoss)
  const end = evaluateGameEnd(players, state.config.winCondition)

  // Spent hands → discard after reveal (redraw cards already in opened.discard)
  const discard = [...opened.discard, ...cards]

  if (end.gameOver) {
    return {
      ...state,
      phase: 'game_over',
      players,
      hands: {},
      deck: opened.deck,
      discard,
      lastOutcome: outcome,
      winnerId: end.winnerId,
      currentBid: null,
      currentBidderId: null,
      currentTurnPlayerId: null,
      pendingChangeRebid: null,
      pendingLifeDouble: false,
      lastAction: 'challenge',
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
    deck: opened.deck,
    discard,
    lastOutcome: outcome,
    currentBid: null,
    currentBidderId: null,
    currentTurnPlayerId: null,
    pendingChangeRebid: null,
    pendingLifeDouble: false,
    lastAction: 'challenge',
    revision: state.revision + 1,
  }
}

/**
 * Force-eliminate a player (mid-game leave / disconnect timeout forfeit).
 *
 * - Sets lives to 0 and alive=false
 * - Keeps this round's hand so a later challenge still counts their card
 *   (only when the match continues — last_standing with 2+ still alive)
 * - Advances the turn if it was theirs
 * - Ends the game per config.winCondition (first elim or last standing)
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
  const end = evaluateGameEnd(players, state.config.winCondition)

  if (end.gameOver) {
    // Hand cards discarded without reveal when game ends by forfeit mid-round
    const discarded = [...state.discard, ...allHandCards(state.hands)]
    return {
      ...state,
      phase: 'game_over',
      players,
      hands: {},
      discard: discarded,
      winnerId: end.winnerId,
      currentBid: null,
      currentBidderId: null,
      currentTurnPlayerId: null,
      pendingChangeRebid: null,
      revision: state.revision + 1,
    }
  }

  let currentTurnPlayerId = state.currentTurnPlayerId
  let pendingChangeRebid = state.pendingChangeRebid

  // Forced rebidder left → cancel rebid and resume to planned next
  if (pendingChangeRebid?.playerId === playerId) {
    const resume = pendingChangeRebid.resumeNextPlayerId
    pendingChangeRebid = null
    if (currentTurnPlayerId === playerId) {
      currentTurnPlayerId = players.find((p) => p.id === resume)?.alive
        ? resume
        : nextAlivePlayerId(players, playerId, state.turnDirection)
    }
  } else if (currentTurnPlayerId === playerId) {
    currentTurnPlayerId = nextAlivePlayerId(
      players,
      playerId,
      state.turnDirection,
    )
  }

  // Keep currentBid / currentBidderId even if the bidder left — others may still
  // challenge that number. Life loss on an already-dead bidder is a no-op.

  return {
    ...state,
    players,
    currentTurnPlayerId,
    pendingChangeRebid,
    revision: state.revision + 1,
  }
}

// ---------------------------------------------------------------------------
// Deal
// ---------------------------------------------------------------------------

/**
 * Deal one card to each living player, handling ZERO_MIX (and keeping REDRAW).
 *
 * - REDRAW (?): stays in hand as `?`. Opened at challenge resolve (result UI
 *   plays a dedicated open animation). Nested `?` drawn as the replacement
 *   are resolved immediately into a non-redraw face at open time.
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
  const hands: Record<PlayerId, Card[]> = {}

  // Deal in seat order among living
  const ordered = [...living].sort((a, b) => a.seatIndex - b.seatIndex)

  for (const player of ordered) {
    const drawn = drawOneCard(deck, discard, rng)
    deck = drawn.deck
    discard = drawn.discard
    let card = drawn.card

    // ZERO_MIX: reshuffle discard into deck after receiving the card
    if (card.kind === 'zero_mix' && discard.length > 0) {
      deck = shuffle([...deck, ...discard], rng)
      discard = []
    }

    hands[player.id] = [card]
  }

  // Prefer exact seat; else next higher seat; else lowest seat (wrap)
  const turnPlayer = pickStartPlayer(living, startSeat)

  return resetRoundExtras({
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
  })
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
 * Draw one card as-is (including `?` redraw). Used for deal / draw1.
 * If the draw pile is empty, discard is shuffled back in.
 * If still empty after that → DECK_EXHAUSTED.
 */
function drawOneCard(
  deck: Card[],
  discard: Card[],
  rng: RandomSource,
): { card: Card; deck: Card[]; discard: Card[] } {
  const filled = ensureDeckHasCards(deck, discard, rng)
  const d = filled.deck
  const disc = filled.discard

  if (d.length === 0) {
    throw new GameError(
      'Deck exhausted: no cards left to draw after reshuffling discard',
      'DECK_EXHAUSTED',
    )
  }

  const card = d[d.length - 1]!
  return { card, deck: d.slice(0, -1), discard: disc }
}

/**
 * Draw one non-redraw card. Nested `?` cards are discarded and replaced.
 * Used only when opening a `?` at challenge time.
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
      // Nested ?: discard and draw again (one open animation → final face).
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

/**
 * Replace every `?` in hands with a non-redraw draw (seat order, hand order).
 * Nested redraws are resolved immediately into the final face.
 */
function openRedrawsInHands(
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
  deck: readonly Card[],
  discard: readonly Card[],
  players: readonly Player[],
  rng: RandomSource,
): {
  hands: Record<PlayerId, Card[]>
  deck: Card[]
  discard: Card[]
  openedFromRedrawIds: string[]
  openLabels: string[]
} {
  let d = deck.slice()
  let disc = discard.slice()
  const openedFromRedrawIds: string[] = []
  const openLabels: string[] = []
  const newHands: Record<PlayerId, Card[]> = {}

  const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex)
  const seen = new Set<PlayerId>()

  for (const player of ordered) {
    seen.add(player.id)
    const hand = hands[player.id]
    if (!hand || hand.length === 0) continue

    const out: Card[] = []
    for (const card of hand) {
      if (card.kind !== 'redraw') {
        out.push(card)
        continue
      }

      disc = [...disc, card]
      const drawn = drawResolvingRedraw(d, disc, rng)
      d = drawn.deck
      disc = drawn.discard
      let replacement = drawn.card

      // ZERO_MIX drawn as the open result: reshuffle discard into deck
      if (replacement.kind === 'zero_mix' && disc.length > 0) {
        d = shuffle([...d, ...disc], rng)
        disc = []
      }

      out.push(replacement)
      openedFromRedrawIds.push(replacement.id)
      openLabels.push(`？→${cardLabel(replacement)}`)
    }
    if (out.length > 0) newHands[player.id] = out
  }

  // Hands for players not in `players` (should not happen) — copy as-is
  for (const [id, hand] of Object.entries(hands)) {
    if (seen.has(id)) continue
    if (hand.length > 0) newHands[id] = hand.slice()
  }

  return {
    hands: newHands,
    deck: d,
    discard: disc,
    openedFromRedrawIds,
    openLabels,
  }
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

/**
 * Reassign seatIndex 0..n-1 by shuffling player order.
 * Used at game start and at every new round (席替え).
 */
function reshuffleSeats(
  players: readonly Player[],
  rng: RandomSource,
): Player[] {
  return shuffle(players, rng).map((p, seatIndex) => ({
    ...p,
    seatIndex,
  }))
}

export function nextAlivePlayerId(
  players: readonly Player[],
  afterId: PlayerId,
  direction: TurnDirection = 1,
): PlayerId {
  const living = alivePlayers(players).sort((a, b) => a.seatIndex - b.seatIndex)
  if (living.length === 0) {
    throw new GameError('No living players', 'INVALID_ACTION')
  }
  const idx = living.findIndex((p) => p.id === afterId)
  if (idx < 0) {
    return living[0]!.id
  }
  const n = living.length
  const step = direction === 1 ? 1 : -1
  return living[(idx + step + n) % n]!.id
}
