/** UI mock types — will align with domain engine later */

export type PlayerId = string

export interface PlayerSeat {
  id: PlayerId
  seatIndex: number
  name: string
  /** Emoji / short icon for avatar placeholder */
  avatar: string
  /** Declared bid this round; null if not yet declared or is self hidden */
  bid: number | null
  /** Whether this seat has already declared */
  hasDeclared: boolean
  /** Is the local player */
  isSelf: boolean
  /** Is currently their turn */
  isCurrentTurn: boolean
  /** Remaining lives (0 = eliminated) */
  lives: number
}

export interface EventLogItem {
  id: string
  avatar: string
  name: string
  message: string
  timeLabel: string
}

export interface GameRoomMock {
  roomCode: string
  playerCount: number
  round: number
  currentBid: number
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
  isHost: boolean
  isSelf: boolean
  isReady: boolean
}

export interface LobbyMock {
  roomCode: string
  maxPlayers: number
  /** Local player is the host (controls start) */
  isHost: boolean
  players: LobbyPlayer[]
}

/** Card face shown on reveal */
export type CardKind = 'number' | 'double' | 'max_to_zero' | 'redraw' | 'zero_mix'

export interface RevealedCard {
  playerId: PlayerId
  playerName: string
  avatar: string
  kind: CardKind
  /** Numeric value when kind is number or zero_mix; null for pure specials */
  value: number | null
  /** Label for display e.g. "+5", "×2", "MAX→0" */
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
  challengerName: string
  challengerAvatar: string
  cards: RevealedCard[]
  calcSteps: CalcStep[]
  finalTotal: number
  /** true if bidder wins (actualTotal >= bid) */
  bidderWins: boolean
  lifeLostName: string
  lifeLostAvatar: string
}
