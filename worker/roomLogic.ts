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
  HOST_DISCONNECT_GRACE_MS,
  IDLE_TTL_OPEN_MS,
  IDLE_TTL_PLAYING_MS,
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
  /** playerId → epoch ms when host-transfer (or other) deadline fires */
  disconnectDeadlines: Record<string, number>
  status: RoomStatus
  /** domain GameState after start; null in lobby */
  game: GameState | null
  pendingResult: PendingResultSnapshot | null
  /**
   * playerId → true when they dismissed the current pendingResult.
   * Cleared when a new challenge snapshot is set or result is fully cleared.
   */
  resultAcks: Record<string, boolean>
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
    disconnectDeadlines: {},
    status: 'open',
    game: null,
    pendingResult: null,
    resultAcks: {},
    bidHistory: [],
    appliedActions: {},
  }
}

/** All seated players must be ready (including host). */
export function allPlayersReady(room: RoomState): boolean {
  if (room.players.length < MIN_PLAYERS_TO_START) return false
  return room.players.every((p) => p.ready)
}

/** Host can start: lobby, ≥2 players, everyone ready. */
export function canHostStart(room: RoomState, selfPlayerId: string | null): boolean {
  return (
    room.status === 'open' &&
    selfPlayerId != null &&
    selfPlayerId === room.hostId &&
    allPlayersReady(room)
  )
}

export function hasResultAck(room: RoomState, playerId: string | null): boolean {
  if (!playerId) return false
  return room.resultAcks?.[playerId] === true
}

/**
 * True when every currently connected player has dismissed the result.
 * Disconnected seats do not block clearing.
 */
export function allConnectedHaveResultAck(room: RoomState): boolean {
  const connected = room.players.filter((p) => p.connected)
  if (connected.length === 0) return true
  return connected.every((p) => room.resultAcks?.[p.id] === true)
}

/**
 * Record a result dismiss. Returns whether room.pendingResult was cleared.
 * No-op if there is no pending result (already cleared).
 */
export function applyResultDismiss(
  room: RoomState,
  playerId: string,
): { changed: boolean; cleared: boolean } {
  ensureLifecycleFields(room)
  if (!room.pendingResult) {
    return { changed: false, cleared: false }
  }
  if (room.resultAcks[playerId]) {
    return { changed: false, cleared: false }
  }
  room.resultAcks[playerId] = true
  if (allConnectedHaveResultAck(room)) {
    room.pendingResult = null
    room.resultAcks = {}
    return { changed: true, cleared: true }
  }
  return { changed: true, cleared: false }
}

/**
 * Reset playing room to lobby for rematch. Keeps players / host / tokens.
 * Caller bumps revision / lastActivityAt / save.
 */
export function resetRoomForRematch(room: RoomState): void {
  room.status = 'open'
  room.game = null
  room.pendingResult = null
  room.resultAcks = {}
  room.bidHistory = []
  room.appliedActions = {}
  for (const p of room.players) {
    p.ready = false
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
    case 'dismiss_result':
      return { type: 'dismiss_result' }
    case 'rematch':
      return { type: 'rematch' }
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
  const roomPending = room.pendingResult ?? null
  // Per-player: hide result after this client dismissed (server still holds for others)
  const showPending =
    roomPending != null && !hasResultAck(room, selfPlayerId)
  const pendingResult = showPending ? roomPending : null

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
    canStart: canHostStart(room, selfPlayerId),
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

// ---------------------------------------------------------------------------
// Lifecycle: host transfer + idle purge (phase1 §7.5–7.6)
// ---------------------------------------------------------------------------

export function ensureLifecycleFields(room: RoomState): void {
  if (!room.disconnectDeadlines) room.disconnectDeadlines = {}
  if (!room.bidHistory) room.bidHistory = []
  if (!room.appliedActions) room.appliedActions = {}
  if (room.pendingResult === undefined) room.pendingResult = null
  if (!room.resultAcks) room.resultAcks = {}
}

export function connectedPlayerCount(room: RoomState): number {
  return room.players.filter((p) => p.connected).length
}

/** Clear a player's disconnect deadline (e.g. on resume). */
export function clearDisconnectDeadline(room: RoomState, playerId: string): void {
  ensureLifecycleFields(room)
  delete room.disconnectDeadlines[playerId]
}

/**
 * Mark player disconnected. If they are host, start 60s transfer grace.
 * Caller bumps revision / lastActivityAt / save / alarm.
 */
export function markPlayerDisconnected(
  room: RoomState,
  playerId: string,
  now = Date.now(),
): void {
  ensureLifecycleFields(room)
  const player = room.players.find((p) => p.id === playerId)
  if (player) player.connected = false

  if (room.hostId === playerId) {
    room.disconnectDeadlines[playerId] = now + HOST_DISCONNECT_GRACE_MS
  }
}

/** Oldest connected participant by joinedAt (then id). */
export function pickNextHost(room: RoomState): RoomPlayer | null {
  const candidates = room.players
    .filter((p) => p.connected)
    .slice()
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
  return candidates[0] ?? null
}

export interface HostTransferResult {
  /** True when hostId or deadlines changed in a way that needs broadcast/save. */
  changed: boolean
  previousHostId: string | null
  newHostId: string | null
  /** Host grace expired but no connected successor. */
  emptied: boolean
}

/**
 * If host disconnect grace has elapsed and host is still offline,
 * transfer to oldest connected player, or clear host when empty.
 */
export function applyDueHostTransfer(
  room: RoomState,
  now = Date.now(),
): HostTransferResult {
  ensureLifecycleFields(room)
  const hostId = room.hostId
  if (!hostId) {
    return { changed: false, previousHostId: null, newHostId: null, emptied: false }
  }

  const deadline = room.disconnectDeadlines[hostId]
  if (deadline == null || now < deadline) {
    return { changed: false, previousHostId: null, newHostId: null, emptied: false }
  }

  delete room.disconnectDeadlines[hostId]

  const host = room.players.find((p) => p.id === hostId)
  if (host?.connected) {
    // Reconnected without clearing deadline — nothing to transfer
    return { changed: true, previousHostId: hostId, newHostId: hostId, emptied: false }
  }

  const next = pickNextHost(room)
  if (next) {
    room.hostId = next.id
    room.revision += 1
    return {
      changed: true,
      previousHostId: hostId,
      newHostId: next.id,
      emptied: false,
    }
  }

  room.hostId = null
  room.revision += 1
  return {
    changed: true,
    previousHostId: hostId,
    newHostId: null,
    emptied: true,
  }
}

/** Idle TTL for status when connection count is 0. closed → purge immediately. */
export function idleTtlMs(status: RoomStatus): number {
  if (status === 'closed') return 0
  if (status === 'playing') return IDLE_TTL_PLAYING_MS
  return IDLE_TTL_OPEN_MS
}

/**
 * True when room storage should be deleted (0 connections past idle TTL, or closed).
 */
export function shouldPurgeRoom(
  room: RoomState,
  now = Date.now(),
): boolean {
  if (room.status === 'closed') return true
  if (connectedPlayerCount(room) > 0) return false
  return now - room.lastActivityAt >= idleTtlMs(room.status)
}

/**
 * Next DO alarm time, or null if none needed.
 * Considers host-transfer deadlines and idle purge when empty.
 */
export function nextAlarmAt(room: RoomState, now = Date.now()): number | null {
  ensureLifecycleFields(room)
  const candidates: number[] = []

  for (const t of Object.values(room.disconnectDeadlines)) {
    if (typeof t === 'number' && Number.isFinite(t)) candidates.push(t)
  }

  if (connectedPlayerCount(room) === 0) {
    if (room.status === 'closed') {
      candidates.push(now)
    } else {
      candidates.push(room.lastActivityAt + idleTtlMs(room.status))
    }
  }

  if (candidates.length === 0) return null
  return Math.min(...candidates)
}
