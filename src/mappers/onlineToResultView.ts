import { AVATAR_ASSETS, avatarSrc } from '@/localGame/avatarCatalog'
import type { ResultViewModel } from '@/mappers/toResultView'
import type {
  PendingResultSnapshot,
  PlayerView,
  WireCard,
} from '@/online/protocol'
import type { RevealedCard } from '@/types/game'

function profile(
  playerId: string,
  view: PlayerView,
): { name: string; avatar: string; avatarSrc?: string } {
  const p = view.players.find((x) => x.id === playerId)
  const i = (p?.avatarIndex ?? 0) % AVATAR_ASSETS.length
  const meta = AVATAR_ASSETS[i]!
  return {
    name: p?.displayName ?? playerId.slice(0, 8),
    avatar: meta.emoji,
    avatarSrc: avatarSrc(meta.id),
  }
}

/**
 * Map server pendingResult + lobby roster → ResultViewModel for ResultView.vue.
 */
export function onlineToResultView(
  view: PlayerView,
  snap: PendingResultSnapshot,
): ResultViewModel {
  const selfId = view.selfPlayerId
  const outcome = snap.outcome

  const bidder = profile(outcome.bidderId, view)
  const challenger = profile(outcome.challengerId, view)
  const loser = profile(outcome.loserId, view)
  const winner = snap.winnerId ? profile(snap.winnerId, view) : null

  // Seat order from game seats if present, else room players
  const orderIds =
    view.game?.seats.map((s) => s.id) ?? view.players.map((p) => p.id)
  const ids = orderIds.filter((id) => snap.hands[id] != null)
  const fallback = Object.keys(snap.hands)
  const revealIds = ids.length > 0 ? ids : fallback

  const cards: RevealedCard[] = []
  for (const playerId of revealIds) {
    const raw = snap.hands[playerId]
    const list: WireCard[] = Array.isArray(raw)
      ? raw
      : raw != null
        ? [raw as WireCard]
        : []
    const prof = profile(playerId, view)
    for (const hand of list) {
      cards.push({
        playerId,
        playerName: prof.name,
        avatar: prof.avatar,
        avatarSrc: prof.avatarSrc,
        kind: hand.kind,
        value: hand.value ?? null,
        label: hand.label,
        isSelf: playerId === selfId,
      })
    }
  }

  return {
    roomCode: view.roomCode,
    round: snap.round,
    bidValue: outcome.bid,
    bidderName: bidder.name,
    bidderAvatar: bidder.avatar,
    bidderAvatarSrc: bidder.avatarSrc,
    challengerName: challenger.name,
    challengerAvatar: challenger.avatar,
    challengerAvatarSrc: challenger.avatarSrc,
    cards,
    calcSteps: outcome.calculation.steps.map((s) => ({
      id: s.id,
      title: s.title,
      detail: s.detail,
      totalAfter: s.totalAfter,
    })),
    finalTotal: outcome.calculation.finalTotal,
    bidderWins: outcome.bidderWins,
    lifeLostName: loser.name,
    lifeLostAvatar: loser.avatar,
    lifeLostAvatarSrc: loser.avatarSrc,
    lifeLoss: outcome.lifeLoss ?? 1,
    winnerId: snap.winnerId,
    winnerName: winner?.name ?? null,
    isGameOver: snap.winnerId != null,
    loserId: outcome.loserId,
  }
}
