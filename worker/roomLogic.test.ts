import { describe, expect, it } from 'vitest'
import {
  HOST_DISCONNECT_GRACE_MS,
  IDLE_TTL_OPEN_MS,
  IDLE_TTL_PLAYING_MS,
} from './types'
import {
  applyDueHostTransfer,
  buildPlayerView,
  clearDisconnectDeadline,
  connectedPlayerCount,
  createEmptyRoom,
  findPlayerByToken,
  markPlayerDisconnected,
  nextAlarmAt,
  parseClientMessage,
  pickNextHost,
  sanitizeDisplayName,
  shouldPurgeRoom,
  type RoomPlayer,
} from './roomLogic'

function player(
  partial: Partial<RoomPlayer> & Pick<RoomPlayer, 'id' | 'joinedAt'>,
): RoomPlayer {
  return {
    displayName: partial.displayName ?? partial.id,
    ready: false,
    connected: true,
    resumeToken: `tok-${partial.id}`,
    avatarIndex: 0,
    ...partial,
  }
}

describe('roomLogic', () => {
  it('sanitizes display names', () => {
    expect(sanitizeDisplayName('  あ  ')).toBe('あ')
    expect(sanitizeDisplayName('')).toBe('プレイヤー')
    expect(sanitizeDisplayName('x'.repeat(20))).toHaveLength(12)
    expect(sanitizeDisplayName(null)).toBe('プレイヤー')
  })

  it('parses join / ready / start', () => {
    expect(parseClientMessage({ type: 'join', displayName: 'A' })).toEqual({
      type: 'join',
      displayName: 'A',
      resumeToken: undefined,
    })
    expect(parseClientMessage({ type: 'ready', ready: true })).toEqual({
      type: 'ready',
      ready: true,
    })
    expect(parseClientMessage({ type: 'start' })).toEqual({ type: 'start' })
    expect(parseClientMessage({ type: 'nope' })).toMatchObject({
      error: expect.stringContaining('Unknown'),
    })
  })

  it('builds lobby view with host and canStart', () => {
    const room = createEmptyRoom('ABC234')
    room.hostId = 'p1'
    room.players = [
      {
        id: 'p1',
        displayName: 'Host',
        joinedAt: 1,
        ready: true,
        connected: true,
        resumeToken: 't1',
        avatarIndex: 0,
      },
      {
        id: 'p2',
        displayName: 'Guest',
        joinedAt: 2,
        ready: false,
        connected: true,
        resumeToken: 't2',
        avatarIndex: 1,
      },
    ]
    room.revision = 2

    const hostView = buildPlayerView(room, 'p1')
    expect(hostView.phase).toBe('lobby')
    expect(hostView.canStart).toBe(true)
    expect(hostView.players[0]!.isHost).toBe(true)
    expect(hostView.players[1]!.isHost).toBe(false)

    const guestView = buildPlayerView(room, 'p2')
    expect(guestView.canStart).toBe(false)
    expect(guestView.selfPlayerId).toBe('p2')
  })

  it('canStart false when fewer than 2 players', () => {
    const room = createEmptyRoom('ABC234')
    room.hostId = 'p1'
    room.players = [
      {
        id: 'p1',
        displayName: 'Solo',
        joinedAt: 1,
        ready: true,
        connected: true,
        resumeToken: 't1',
        avatarIndex: 0,
      },
    ]
    expect(buildPlayerView(room, 'p1').canStart).toBe(false)
  })

  it('finds player by resume token', () => {
    const room = createEmptyRoom('ABC234')
    room.players = [
      {
        id: 'p1',
        displayName: 'Host',
        joinedAt: 1,
        ready: false,
        connected: false,
        resumeToken: 'tok-aaa',
        avatarIndex: 0,
      },
    ]
    room.resumeTokens['tok-aaa'] = 'p1'
    expect(findPlayerByToken(room, 'tok-aaa')?.id).toBe('p1')
    expect(findPlayerByToken(room, 'missing')).toBeUndefined()
  })

  it('parses resume message', () => {
    expect(parseClientMessage({ type: 'resume', resumeToken: 't' })).toEqual({
      type: 'resume',
      resumeToken: 't',
    })
    expect(parseClientMessage({ type: 'resume' })).toMatchObject({
      error: expect.stringContaining('resumeToken'),
    })
  })
})

describe('lifecycle: host transfer + idle purge', () => {
  it('marks host disconnect with 60s grace deadline', () => {
    const room = createEmptyRoom('ABC234', 1_000)
    room.hostId = 'h'
    room.players = [
      player({ id: 'h', joinedAt: 1 }),
      player({ id: 'g', joinedAt: 2 }),
    ]
    const now = 10_000
    markPlayerDisconnected(room, 'h', now)
    expect(room.players[0]!.connected).toBe(false)
    expect(room.disconnectDeadlines['h']).toBe(now + HOST_DISCONNECT_GRACE_MS)
  })

  it('non-host disconnect does not set transfer deadline', () => {
    const room = createEmptyRoom('ABC234')
    room.hostId = 'h'
    room.players = [
      player({ id: 'h', joinedAt: 1 }),
      player({ id: 'g', joinedAt: 2 }),
    ]
    markPlayerDisconnected(room, 'g', 50_000)
    expect(room.players[1]!.connected).toBe(false)
    expect(room.disconnectDeadlines['g']).toBeUndefined()
    expect(Object.keys(room.disconnectDeadlines)).toHaveLength(0)
  })

  it('clears deadline on resume helper', () => {
    const room = createEmptyRoom('ABC234')
    room.disconnectDeadlines['h'] = 99
    clearDisconnectDeadline(room, 'h')
    expect(room.disconnectDeadlines['h']).toBeUndefined()
  })

  it('picks oldest connected player as next host', () => {
    const room = createEmptyRoom('ABC234')
    room.players = [
      player({ id: 'h', joinedAt: 1, connected: false }),
      player({ id: 'late', joinedAt: 30 }),
      player({ id: 'early', joinedAt: 10 }),
    ]
    expect(pickNextHost(room)?.id).toBe('early')
  })

  it('transfers host after grace when host still offline', () => {
    const now = 100_000
    const room = createEmptyRoom('ABC234', now - 10_000)
    room.hostId = 'h'
    room.revision = 5
    room.players = [
      player({ id: 'h', joinedAt: 1, connected: false }),
      player({ id: 'g', joinedAt: 2, connected: true }),
    ]
    room.disconnectDeadlines['h'] = now - 1

    const result = applyDueHostTransfer(room, now)
    expect(result.changed).toBe(true)
    expect(result.previousHostId).toBe('h')
    expect(result.newHostId).toBe('g')
    expect(result.emptied).toBe(false)
    expect(room.hostId).toBe('g')
    expect(room.revision).toBe(6)
    expect(room.disconnectDeadlines['h']).toBeUndefined()
  })

  it('does not transfer before grace expires', () => {
    const now = 100_000
    const room = createEmptyRoom('ABC234')
    room.hostId = 'h'
    room.revision = 3
    room.players = [
      player({ id: 'h', joinedAt: 1, connected: false }),
      player({ id: 'g', joinedAt: 2 }),
    ]
    room.disconnectDeadlines['h'] = now + 30_000

    const result = applyDueHostTransfer(room, now)
    expect(result.changed).toBe(false)
    expect(room.hostId).toBe('h')
    expect(room.revision).toBe(3)
  })

  it('clears host when grace expires and nobody is connected', () => {
    const now = 100_000
    const room = createEmptyRoom('ABC234')
    room.hostId = 'h'
    room.revision = 2
    room.players = [
      player({ id: 'h', joinedAt: 1, connected: false }),
      player({ id: 'g', joinedAt: 2, connected: false }),
    ]
    room.disconnectDeadlines['h'] = now - 1

    const result = applyDueHostTransfer(room, now)
    expect(result.emptied).toBe(true)
    expect(result.newHostId).toBeNull()
    expect(room.hostId).toBeNull()
    expect(room.revision).toBe(3)
  })

  it('shouldPurgeRoom: open idle 10m with 0 connected', () => {
    const t0 = 1_000_000
    const room = createEmptyRoom('ABC234', t0)
    room.status = 'open'
    room.lastActivityAt = t0
    room.players = [player({ id: 'h', joinedAt: 1, connected: false })]
    expect(shouldPurgeRoom(room, t0 + IDLE_TTL_OPEN_MS - 1)).toBe(false)
    expect(shouldPurgeRoom(room, t0 + IDLE_TTL_OPEN_MS)).toBe(true)
  })

  it('shouldPurgeRoom: playing idle 30m', () => {
    const t0 = 1_000_000
    const room = createEmptyRoom('ABC234', t0)
    room.status = 'playing'
    room.lastActivityAt = t0
    room.players = [player({ id: 'h', joinedAt: 1, connected: false })]
    expect(shouldPurgeRoom(room, t0 + IDLE_TTL_PLAYING_MS - 1)).toBe(false)
    expect(shouldPurgeRoom(room, t0 + IDLE_TTL_PLAYING_MS)).toBe(true)
  })

  it('shouldPurgeRoom: never while someone is connected', () => {
    const t0 = 1_000_000
    const room = createEmptyRoom('ABC234', t0)
    room.status = 'open'
    room.lastActivityAt = t0
    room.players = [player({ id: 'h', joinedAt: 1, connected: true })]
    expect(shouldPurgeRoom(room, t0 + IDLE_TTL_OPEN_MS * 10)).toBe(false)
  })

  it('shouldPurgeRoom: closed immediately', () => {
    const room = createEmptyRoom('ABC234')
    room.status = 'closed'
    expect(shouldPurgeRoom(room, Date.now())).toBe(true)
  })

  it('nextAlarmAt prefers earliest host deadline or idle purge', () => {
    const now = 50_000
    const room = createEmptyRoom('ABC234', now)
    room.hostId = 'h'
    room.players = [
      player({ id: 'h', joinedAt: 1, connected: false }),
      player({ id: 'g', joinedAt: 2, connected: true }),
    ]
    room.disconnectDeadlines['h'] = now + 60_000
    expect(nextAlarmAt(room, now)).toBe(now + 60_000)

    // empty room → idle open TTL from lastActivityAt
    room.players.forEach((p) => {
      p.connected = false
    })
    room.lastActivityAt = now
    room.disconnectDeadlines = {}
    expect(nextAlarmAt(room, now)).toBe(now + IDLE_TTL_OPEN_MS)
    expect(connectedPlayerCount(room)).toBe(0)
  })

  it('nextAlarmAt null when all connected and no deadlines', () => {
    const room = createEmptyRoom('ABC234')
    room.players = [player({ id: 'h', joinedAt: 1, connected: true })]
    expect(nextAlarmAt(room, Date.now())).toBeNull()
  })
})
