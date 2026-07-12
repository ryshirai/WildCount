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
