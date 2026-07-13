import type { AvatarAssetId } from '@/localGame/avatarCatalog'

/** UI mock types — will align with domain engine later */

export type PlayerId = string

export interface PlayerSeat {
  id: PlayerId
  seatIndex: number
  name: string
  /** Emoji / short icon fallback */
  avatar: string
  /** Portrait image URL when available */
  avatarSrc?: string
  /** Catalog asset id (for character-skinned stamps) */
  avatarId?: AvatarAssetId
  /** Declared bid this round; null if not yet declared */
  bid: number | null
  /** Whether this seat has already declared */
  hasDeclared: boolean
  /** Is the local player */
  isSelf: boolean
  /** Is currently their turn */
  isCurrentTurn: boolean
  /** Remaining lives (0 = eliminated) */
  lives: number
  /**
   * Hand card face labels (e.g. ["+5"], ["+5", "×2"] when draw1 multi-card).
   * Indian poker: others' cards are visible; self is always `handHidden`
   * (labels may still be filled for local adapters — UI must not show them).
   * Empty when no hand (eliminated / not dealt).
   */
  handLabels: string[]
  /**
   * Convenience single string (labels joined by space). Prefer `handLabels`
   * when rendering so multi-card hands become multiple tiles.
   * null when no hand.
   */
  handLabel: string | null
  /** Card count in hand (needed for multi mystery tiles when handHidden). */
  handCount: number
  /** true → show as ? (own forehead card; local player must not see it) */
  handHidden: boolean
  /** Online: WebSocket connected. Local always true / undefined. */
  connected?: boolean
}

export interface EventLogItem {
  id: string
  avatar: string
  avatarSrc?: string
  name: string
  message: string
  timeLabel: string
  /**
   * `separator` = round / phase divider (e.g. 第2ラウンド開始).
   * Default `entry` = player action line rendered as 「{name}が{message}」.
   */
  kind?: 'entry' | 'separator'
}

export interface GameRoomMock {
  roomCode: string
  playerCount: number
  round: number
  /** Current bid; null when no one has declared this round */
  currentBid: number | null
  /** How many seats until local player's turn */
  turnsUntilSelf: number
  players: PlayerSeat[]
  eventLog: EventLogItem[]
  /** Local player's proposed next bid */
  draftBid: number
  connectionStatus: 'good' | 'reconnect' | 'offline'
}

/** Lobby participant (pre-game) */
export interface LobbyPlayer {
  id: PlayerId
  name: string
  avatar: string
  avatarSrc?: string
  isHost: boolean
  isSelf: boolean
  isReady: boolean
  /** Online only: false when WS disconnected */
  connected?: boolean
}

export interface LobbyMock {
  roomCode: string
  maxPlayers: number
  /** Local player is the host (controls start) */
  isHost: boolean
  players: LobbyPlayer[]
}

/** Card face shown on reveal */
export type CardKind =
  | 'number'
  | 'double'
  | 'half'
  | 'max_to_zero'
  | 'redraw'
  | 'zero_mix'

export interface RevealedCard {
  playerId: PlayerId
  playerName: string
  avatar: string
  avatarSrc?: string
  kind: CardKind
  /** Numeric value when kind is number or zero_mix; null for pure specials */
  value: number | null
  /** Label for display e.g. "+5", "×2", "M→0" */
  label: string
  isSelf: boolean
}

export interface CalcStep {
  id: string
  title: string
  detail: string
  /** Intermediate total after this step, if applicable */
  totalAfter?: number
}

export interface ResultMock {
  roomCode: string
  round: number
  /** Last bid before challenge */
  bidValue: number
  bidderName: string
  bidderAvatar: string
  bidderAvatarSrc?: string
  challengerName: string
  challengerAvatar: string
  challengerAvatarSrc?: string
  cards: RevealedCard[]
  calcSteps: CalcStep[]
  finalTotal: number
  /** true if bidder wins (actualTotal >= bid) */
  bidderWins: boolean
  lifeLostName: string
  lifeLostAvatar: string
  lifeLostAvatarSrc?: string
  /**
   * Lives lost by the loser this challenge.
   * 1 default; 2 when life-double (特殊能力ダブル) was pending.
   */
  lifeLoss?: number
}
