import {
  cardLabel,
  type Card,
  type ChallengeOutcome,
  type Player,
  type PlayerId,
} from '@/domain/game'
import type { ResultMock, RevealedCard } from '@/types/game'
import { getProfile, type PlayerProfile, SELF_ID } from '@/localGame/profiles'

export interface ToResultViewInput {
  outcome: ChallengeOutcome
  /** Hands at the moment of challenge (before engine clears / redeals). */
  hands: Readonly<Record<PlayerId, readonly Card[]>>
  /** Domain players after life loss (for display consistency). */
  players: readonly Player[]
  round: number
  roomCode?: string
  selfId?: PlayerId
  profiles?: readonly PlayerProfile[]
  /** Set when this challenge ended the game. */
  winnerId?: PlayerId | null
}

export interface ResultViewModel extends ResultMock {
  winnerId: PlayerId | null
  winnerName: string | null
  isGameOver: boolean
  loserId: PlayerId
}

/**
 * Map ChallengeOutcome + pre-challenge hands → UI ResultMock (+ game-over meta).
 */
export function toResultView(input: ToResultViewInput): ResultViewModel {
  const {
    outcome,
    hands,
    players,
    round,
    roomCode = 'LOCAL',
    selfId = SELF_ID,
    profiles,
    winnerId = null,
  } = input

  const bidder = getProfile(outcome.bidderId, profiles)
  const challenger = getProfile(outcome.challengerId, profiles)
  const loser = getProfile(outcome.loserId, profiles)
  const winnerProfile = winnerId ? getProfile(winnerId, profiles) : null

  // Reveal in seat order when possible (one entry per card; multi-card via draw1)
  const seatOrder = [...players].sort((a, b) => a.seatIndex - b.seatIndex)
  const orderedIds = seatOrder
    .map((p) => p.id)
    .filter((id) => (hands[id]?.length ?? 0) > 0)
  // Fallback: object key order
  const ids = orderedIds.length > 0 ? orderedIds : Object.keys(hands)

  const cards: RevealedCard[] = []
  for (const playerId of ids) {
    const hand = hands[playerId] ?? []
    const profile = getProfile(playerId, profiles)
    for (const card of hand) {
      cards.push({
        playerId,
        playerName: profile.name,
        avatar: profile.avatar,
        avatarSrc: profile.avatarSrc,
        kind: card.kind,
        value: card.value ?? null,
        label: cardLabel(card),
        isSelf: playerId === selfId,
      })
    }
  }

  const calcSteps = outcome.calculation.steps.map((s) => ({
    id: s.id,
    title: s.title,
    detail: s.detail,
    totalAfter: s.totalAfter,
  }))

  return {
    roomCode,
    round,
    bidValue: outcome.bid,
    bidderName: bidder.name,
    bidderAvatar: bidder.avatar,
    bidderAvatarSrc: bidder.avatarSrc,
    challengerName: challenger.name,
    challengerAvatar: challenger.avatar,
    challengerAvatarSrc: challenger.avatarSrc,
    cards,
    calcSteps,
    finalTotal: outcome.calculation.finalTotal,
    bidderWins: outcome.bidderWins,
    lifeLostName: loser.name,
    lifeLostAvatar: loser.avatar,
    lifeLostAvatarSrc: loser.avatarSrc,
    lifeLoss: outcome.lifeLoss ?? 1,
    winnerId: winnerId ?? null,
    winnerName: winnerProfile?.name ?? null,
    isGameOver: winnerId != null,
    loserId: outcome.loserId,
  }
}
