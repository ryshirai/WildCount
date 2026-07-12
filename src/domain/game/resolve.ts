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
 *   actualTotal >= bid  → bidder wins (tie goes to bidder) → challenger loses a life
 *   otherwise           → challenger wins                  → bidder loses a life
 */
export function resolveChallenge(args: {
  cards: readonly Card[]
  bid: number
  bidderId: PlayerId
  challengerId: PlayerId
}): ChallengeOutcome {
  const calculation: CalculationResult = calculateTotal(args.cards)
  const actualTotal = calculation.finalTotal
  const bidderWins = actualTotal >= args.bid
  const loserRole = bidderWins ? 'challenger' : 'bidder'
  const loserId = bidderWins ? args.challengerId : args.bidderId

  return {
    bid: args.bid,
    actualTotal,
    calculation,
    bidderWins,
    loserRole,
    loserId,
    bidderId: args.bidderId,
    challengerId: args.challengerId,
  }
}

/** Apply one life loss. lives floor at 0; alive becomes false at 0. */
export function applyLifeLoss(
  players: readonly Player[],
  loserId: PlayerId,
): Player[] {
  return players.map((p) => {
    if (p.id !== loserId) return p
    const lives = Math.max(0, p.lives - 1)
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
