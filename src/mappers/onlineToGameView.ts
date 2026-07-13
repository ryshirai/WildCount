import { avatarByIndex, avatarSrc } from '@/localGame/avatarCatalog'
import type { GameViewModel } from '@/mappers/toGameView'
import type { MaskedGamePayload, PlayerView } from '@/online/protocol'
import type { EventLogItem, PlayerSeat } from '@/types/game'

export function onlineProfilesFromView(view: PlayerView) {
  return view.players.map((p) => {
    const meta = avatarByIndex(p.avatarIndex)
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

  const legal = Array.isArray(game.legalMoves) ? game.legalMoves : []
  const bidMove = legal.find(
    (m): m is { type: 'PLACE_BID'; extrasAllowed?: boolean; forbiddenValue?: number } =>
      !!m &&
      typeof m === 'object' &&
      (m as { type?: string }).type === 'PLACE_BID',
  )
  const er = view.extraRules

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
    canSame: game.canSame === true,
    canChange: game.canChange === true,
    extrasAllowed: bidMove?.extrasAllowed === true,
    forbiddenBidValue: bidMove?.forbiddenValue ?? null,
    allowReverse: er?.reverse === true,
    allowShot: er?.shot === true,
    allowDraw1: er?.draw1 === true,
    allowLifeDouble: er?.lifeDouble === true,
    isGameOver: game.isGameOver,
  }
}

function seatsToUi(game: MaskedGamePayload): PlayerSeat[] {
  return game.seats.map((s) => {
    const meta = avatarByIndex(s.avatarIndex)
    return {
      id: s.id,
      // UI uses 1-based seat badges
      seatIndex: s.seatIndex + 1,
      name: s.displayName,
      avatar: meta.emoji,
      avatarSrc: avatarSrc(meta.id),
      avatarId: meta.id,
      bid: s.alive ? s.bid : null,
      hasDeclared: s.hasDeclared,
      isSelf: s.isSelf,
      isCurrentTurn: s.isCurrentTurn,
      lives: s.lives,
      handLabels: s.handHidden
        ? []
        : s.hands && s.hands.length > 0
          ? s.hands.map((h) => h.label)
          : s.hand
            ? [s.hand.label]
            : [],
      handLabel: s.handHidden
        ? null
        : s.hands && s.hands.length > 0
          ? s.hands.map((h) => h.label).join(' ')
          : s.hand
            ? s.hand.label
            : null,
      handCount:
        typeof s.handCount === 'number'
          ? s.handCount
          : s.hands?.length
            ? s.hands.length
            : s.hand
              ? 1
              : 0,
      handHidden: s.handHidden,
      connected: s.connected,
    }
  })
}
