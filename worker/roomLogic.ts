/**
 * Pure room helpers (testable without Durable Object runtime).
 */

import type { GameState } from '../src/domain/game'
import {
  buildMaskedGame,
  viewPhase,
  type BidHistoryEntry,
  type PendingResultSnapshot,
} from './maskedView'
import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  type ClientMessage,
  type PlayerView,
  type PlayerViewMember,
} from './types'

export type RoomStatus = 'open' | 'playing' | 'closed'

export interface RoomPlayer {
  id: string
  displayName: string
  joinedAt: number
  ready: boolean
  connected: boolean
  resumeToken: string
  /** 0-based index into avatar catalog (client maps to assets). */
  avatarIndex: number
}

export interface RoomState {
  roomCode: string
  createdAt: number
  lastActivityAt: number
  hostId: string | null
  revision: number
  players: RoomPlayer[]
  /** resumeToken → playerId */
  resumeTokens: Record<string, string>
  status: RoomStatus
  /** domain GameState after start; null in lobby */
  game: GameState | null
  pendingResult: PendingResultSnapshot | null
  bidHistory: BidHistoryEntry[]
  /** actionId → room revision when applied (idempotency) */
  appliedActions: Record<string, number>
}

export interface WsAttachment {
  playerId?: string
}

export function createEmptyRoom(roomCode: string, now = Date.now()): RoomState {
  return {
    roomCode,
    createdAt: now,
    lastActivityAt: now,
    hostId: null,
    revision: 0,
    players: [],
    resumeTokens: {},
    status: 'open',
    game: null,
    pendingResult: null,
    bidHistory: [],
    appliedActions: {},
  }
}

export function sanitizeDisplayName(raw: unknown): string {
  if (typeof raw !== 'string') return 'プレイヤー'
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 12)
  return trimmed.length > 0 ? trimmed : 'プレイヤー'
}

export function parseClientMessage(raw: unknown): ClientMessage | { error: string } {
  if (!raw || typeof raw !== 'object' || !('type' in raw)) {
    return { error: 'Message must be an object with type' }
  }
  const msg = raw as Record<string, unknown>
  const type = msg.type

  switch (type) {
    case 'ping':
      return { type: 'ping' }
    case 'join': {
      const displayName = sanitizeDisplayName(msg.displayName)
      const resumeToken =
        typeof msg.resumeToken === 'string' && msg.resumeToken.length > 0
          ? msg.resumeToken
          : undefined
      return { type: 'join', displayName, resumeToken }
    }
    case 'ready': {
      if (typeof msg.ready !== 'boolean') {
        return { error: 'ready must be boolean' }
      }
      return { type: 'ready', ready: msg.ready }
    }
    case 'start':
      return { type: 'start' }
    case 'resume': {
      if (typeof msg.resumeToken !== 'string' || !msg.resumeToken) {
        return { error: 'resumeToken required' }
      }
      return { type: 'resume', resumeToken: msg.resumeToken }
    }
    case 'action': {
      if (typeof msg.actionId !== 'string' || typeof msg.expectedRevision !== 'number') {
        return { error: 'action requires actionId and expectedRevision' }
      }
      const action = msg.action
      if (!action || typeof action !== 'object' || !('type' in action)) {
        return { error: 'action.action required' }
      }
      const a = action as { type: string; value?: number }
      if (a.type === 'PLACE_BID' && typeof a.value === 'number' && Number.isFinite(a.value)) {
        return {
          type: 'action',
          actionId: msg.actionId,
          expectedRevision: msg.expectedRevision,
          action: { type: 'PLACE_BID', value: a.value },
        }
      }
      if (a.type === 'CHALLENGE') {
        return {
          type: 'action',
          actionId: msg.actionId,
          expectedRevision: msg.expectedRevision,
          action: { type: 'CHALLENGE' },
        }
      }
      return { error: 'Invalid action payload' }
    }
    default:
      return { error: `Unknown message type: ${String(type)}` }
  }
}

export function buildPlayerView(
  room: RoomState,
  selfPlayerId: string | null,
): PlayerView {
  // Migrate older DO snapshots missing new fields
  const bidHistory = room.bidHistory ?? []
  const pendingResult = room.pendingResult ?? null

  const players: PlayerViewMember[] = room.players.map((p, i) => ({
    id: p.id,
    displayName: p.displayName,
    ready: p.ready,
    connected: p.connected,
    isHost: p.id === room.hostId,
    seatIndex: i,
    avatarIndex: p.avatarIndex,
  }))

  const phase = viewPhase(room.status, pendingResult, room.game)

  return {
    phase,
    roomCode: room.roomCode,
    hostId: room.hostId,
    players,
    selfPlayerId,
    status: room.status,
    canStart:
      room.status === 'open' &&
      selfPlayerId != null &&
      selfPlayerId === room.hostId &&
      room.players.length >= MIN_PLAYERS_TO_START,
    playerCount: room.players.length,
    maxPlayers: MAX_PLAYERS,
    game: room.game
      ? buildMaskedGame(
          room.game,
          selfPlayerId,
          room.players,
          bidHistory,
          room.hostId,
        )
      : undefined,
    pendingResult: pendingResult ?? undefined,
  }
}

export function findPlayerByToken(
  room: RoomState,
  token: string,
): RoomPlayer | undefined {
  const id = room.resumeTokens[token]
  if (!id) return undefined
  return room.players.find((p) => p.id === id)
}

export function nextAvatarIndex(room: RoomState): number {
  return room.players.length % 10
}

/** Cap appliedActions map size. */
export function rememberAction(
  applied: Record<string, number>,
  actionId: string,
  revision: number,
): Record<string, number> {
  const next = { ...applied, [actionId]: revision }
  const keys = Object.keys(next)
  if (keys.length <= 64) return next
  const trimmed = keys.slice(-48)
  const out: Record<string, number> = {}
  for (const k of trimmed) out[k] = next[k]!
  return out
}
