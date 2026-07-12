import { calculateTotal } from './calculate'
import type {
  CalculationResult,
  Card,
  ChallengeOutcome,
  Player,
  PlayerId,
} from './types'

/**
 * Challenge resolution per docs/game-rules.md:
 *   actualTotal >= bid  → bidder wins (tie goes to bidder) → challenger loses lives
 *   otherwise           → challenger wins                  → bidder loses lives
 *
 * lifeLoss defaults to 1; life-double attach can set 2.
 */
export function resolveChallenge(args: {
  cards: readonly Card[]
  bid: number
  bidderId: PlayerId
  challengerId: PlayerId
  lifeLoss?: number
}): ChallengeOutcome {
  const calculation: CalculationResult = calculateTotal(args.cards)
  const actualTotal = calculation.finalTotal
  const bidderWins = actualTotal >= args.bid
  const loserRole = bidderWins ? 'challenger' : 'bidder'
  const loserId = bidderWins ? args.challengerId : args.bidderId
  const lifeLoss = args.lifeLoss ?? 1

  return {
    bid: args.bid,
    actualTotal,
    calculation,
    bidderWins,
    loserRole,
    loserId,
    bidderId: args.bidderId,
    challengerId: args.challengerId,
    lifeLoss,
  }
}

/** Apply life loss. lives floor at 0; alive becomes false at 0. */
export function applyLifeLoss(
  players: readonly Player[],
  loserId: PlayerId,
  amount = 1,
): Player[] {
  const n = Math.max(0, Math.floor(amount))
  return players.map((p) => {
    if (p.id !== loserId) return p
    const lives = Math.max(0, p.lives - n)
    return { ...p, lives, alive: lives > 0 }
  })
}

export function alivePlayers(players: readonly Player[]): Player[] {
  return players.filter((p) => p.alive)
}

/** Sole survivor, or null if 0 or 2+ alive. */
export function soleSurvivor(players: readonly Player[]): Player | null {
  const alive = alivePlayers(players)
  return alive.length === 1 ? alive[0]! : null
}

/** Flatten all hand cards for total calculation / discard. */
export function allHandCards(
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
): Card[] {
  const out: Card[] = []
  for (const cards of Object.values(hands)) {
    for (const c of cards) out.push(c)
  }
  return out
}
