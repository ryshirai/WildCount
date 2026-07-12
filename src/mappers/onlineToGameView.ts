import { AVATAR_ASSETS, avatarSrc } from '@/localGame/avatarCatalog'
import type { GameViewModel } from '@/mappers/toGameView'
import type { MaskedGamePayload, PlayerView } from '@/online/protocol'
import type { EventLogItem, PlayerSeat } from '@/types/game'

export function onlineProfilesFromView(view: PlayerView) {
  return view.players.map((p) => {
    const i = (p.avatarIndex ?? 0) % AVATAR_ASSETS.length
    const meta = AVATAR_ASSETS[i]!
    return {
      id: p.id,
      name: p.displayName,
      avatar: meta.emoji,
      avatarSrc: avatarSrc(meta.id),
    }
  })
}

/**
 * Map server PlayerView (masked game) → UI GameViewModel for GameView.vue.
 */
export function onlineToGameView(
  view: PlayerView,
  eventLog: readonly EventLogItem[] = [],
): GameViewModel | null {
  const game = view.game
  if (!game) return null

  return {
    roomCode: view.roomCode,
    playerCount: view.playerCount,
    round: game.round,
    currentBid: game.currentBid,
    turnsUntilSelf: game.turnsUntilSelf,
    players: seatsToUi(game),
    eventLog: [...eventLog],
    draftBid: game.minBid,
    connectionStatus: 'good',
    phase: game.phase as GameViewModel['phase'],
    winnerId: game.winnerId,
    isSelfTurn: game.isMyTurn,
    minBid: game.minBid,
    canDeclare: game.canDeclare,
    canChallenge: game.canChallenge,
    isGameOver: game.isGameOver,
  }
}

function seatsToUi(game: MaskedGamePayload): PlayerSeat[] {
  return game.seats.map((s) => {
    const i = s.avatarIndex % AVATAR_ASSETS.length
    const meta = AVATAR_ASSETS[i]!
    return {
      id: s.id,
      // UI uses 1-based seat badges
      seatIndex: s.seatIndex + 1,
      name: s.displayName,
      avatar: meta.emoji,
      avatarSrc: avatarSrc(meta.id),
      bid: s.alive ? s.bid : null,
      hasDeclared: s.hasDeclared,
      isSelf: s.isSelf,
      isCurrentTurn: s.isCurrentTurn,
      lives: s.lives,
      handLabel: s.handHidden
        ? null
        : s.hand
          ? s.hand.label
          : s.alive
            ? null
            : null,
      handHidden: s.handHidden,
    }
  })
}
