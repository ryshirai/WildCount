import {
  getLegalMoves,
  type Card,
  type GameAction,
  type GameState,
  type PlayerId,
  type RandomSource,
} from '@/domain/game'

/**
 * Expected value for the bot's own hidden card (Indian poker).
 * Rough mid of STANDARD_DECK number mass; specials average near low.
 */
const OWN_CARD_ESTIMATE = 4

/**
 * Bot policy for local demo (Phase B6).
 *
 * Indian poker: sees every other player's card, not its own.
 * Uses a rough total estimate to:
 * - open / raise near that estimate (with noise)
 * - challenge more often when the current bid looks high vs estimate
 */
export function chooseBotAction(state: GameState, rng: RandomSource): GameAction {
  const botId = state.currentTurnPlayerId
  if (!botId) {
    throw new Error('Bot has no current turn player')
  }

  const moves = getLegalMoves(state)
  const bidMove = moves.find((m) => m.type === 'PLACE_BID')
  const canChallenge = moves.some((m) => m.type === 'CHALLENGE')

  if (!bidMove || bidMove.type !== 'PLACE_BID') {
    throw new Error('Bot has no legal PLACE_BID (unexpected)')
  }

  const estimate = estimateRoundTotal(state, botId)
  const minValue = bidMove.minValue

  if (!canChallenge) {
    // Opening bid: soft open under the estimate so others can build
    const soft = Math.max(1, Math.floor(estimate * (0.45 + rng.next() * 0.25)))
    const value = clampBid(soft, minValue, minValue + 8)
    return { type: 'PLACE_BID', value }
  }

  const bid = state.currentBid ?? minValue
  const overshoot = bid - estimate

  // Challenge probability rises as bid exceeds our estimate
  let challengeP = 0.08
  if (overshoot > 8) challengeP = 0.85
  else if (overshoot > 4) challengeP = 0.55
  else if (overshoot > 1) challengeP = 0.3
  else if (overshoot > -2) challengeP = 0.12
  else challengeP = 0.04

  // Very high absolute bids are almost always challenged
  if (bid >= Math.max(25, estimate + 12)) {
    challengeP = Math.max(challengeP, 0.9)
  }

  if (rng.next() < challengeP) {
    return { type: 'CHALLENGE' }
  }

  // Raise: step toward estimate, or small bluff above it
  const target =
    estimate + Math.floor(rng.next() * 3) - 1 + (rng.next() < 0.15 ? 3 : 0)
  const desired = Math.max(minValue, Math.min(target, minValue + 5))
  // If already past estimate, only raise a little (or we would have challenged)
  const value =
    bid >= estimate
      ? minValue + Math.floor(rng.next() * 2) // 0..1 extra
      : clampBid(desired, minValue, minValue + 5)

  return { type: 'PLACE_BID', value }
}

/**
 * Rough total the bot expects from the full round.
 * Visible cards (everyone except self) + OWN_CARD_ESTIMATE, with crude
 * handling of DOUBLE / MAX_TO_ZERO among visible cards.
 */
export function estimateRoundTotal(state: GameState, botId: PlayerId): number {
  let numberSum = 0
  let doubleCount = 0
  let hasMaxToZero = false
  let maxPositive = 0
  let positiveCount = 0

  for (const [pid, cards] of Object.entries(state.hands)) {
    if (pid === botId) continue
    for (const card of cards) {
      const contrib = inspectCard(card)
      numberSum += contrib.number
      doubleCount += contrib.double
      if (contrib.maxToZero) hasMaxToZero = true
      if (contrib.number > 0) {
        positiveCount += 1
        maxPositive = Math.max(maxPositive, contrib.number)
      }
    }
  }

  // Own card is hidden — use a mid-deck guess (can be special / negative in reality)
  numberSum += OWN_CARD_ESTIMATE
  if (OWN_CARD_ESTIMATE > 0) {
    positiveCount += 1
    maxPositive = Math.max(maxPositive, OWN_CARD_ESTIMATE)
  }

  // Crude MAX→0: if visible (or assumed own is max), knock off the max once
  if (hasMaxToZero && maxPositive > 0 && positiveCount > 0) {
    numberSum -= maxPositive
  }

  const mult = 2 ** Math.min(doubleCount, 3)
  const total = numberSum * mult

  // Floor at 0 for bidding heuristics (negative totals are rare / awkward to bid)
  return Math.max(0, Math.round(total))
}

function inspectCard(card: Card): {
  number: number
  double: number
  maxToZero: boolean
} {
  switch (card.kind) {
    case 'number':
      return { number: card.value ?? 0, double: 0, maxToZero: false }
    case 'zero_mix':
      return { number: 0, double: 0, maxToZero: false }
    case 'double':
      return { number: 0, double: 1, maxToZero: false }
    case 'half':
      return { number: 0, double: 0, maxToZero: false }
    case 'max_to_zero':
      return { number: 0, double: 0, maxToZero: true }
    case 'redraw':
      return { number: 0, double: 0, maxToZero: false }
    default:
      return { number: 0, double: 0, maxToZero: false }
  }
}

function clampBid(value: number, min: number, max: number): number {
  const v = Math.round(value)
  if (v < min) return min
  if (v > max) return max
  return v
}
