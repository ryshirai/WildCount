import { describe, expect, it } from 'vitest'
import {
  HOST_DISCONNECT_GRACE_MS,
  IDLE_TTL_OPEN_MS,
  IDLE_TTL_PLAYING_MS,
} from './types'
import {
  allConnectedHaveResultAck,
  allPlayersReady,
  appendChatMessage,
  applyDueHostTransfer,
  applyResultDismiss,
  buildPlayerView,
  canHostStart,
  clearDisconnectDeadline,
  connectedPlayerCount,
  createEmptyRoom,
  findPlayerByToken,
  markPlayerDisconnected,
  nextAlarmAt,
  parseClientMessage,
  pickNextHost,
  removePlayerFromRoom,
  resetRoomForRematch,
  sanitizeChatText,
  sanitizeDisplayName,
  shouldPurgeRoom,
  type RoomPlayer,
  type RoomState,
} from './roomLogic'
import { CHAT_COOLDOWN_MS, MAX_CHAT_TEXT_LENGTH } from './types'
import type { PendingResultSnapshot } from './maskedView'

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
    expect(parseClientMessage({ type: 'chat', text: 'hi' })).toEqual({
      type: 'chat',
      text: 'hi',
    })
    expect(parseClientMessage({ type: 'chat' })).toMatchObject({
      error: expect.stringContaining('text'),
    })
    expect(parseClientMessage({ type: 'leave' })).toEqual({ type: 'leave' })
    expect(parseClientMessage({ type: 'nope' })).toMatchObject({
      error: expect.stringContaining('Unknown'),
    })
  })

  it('removes lobby seat and reassigns host on intentional leave', () => {
    const room = createEmptyRoom('LEFT01')
    room.hostId = 'h'
    room.players = [
      player({ id: 'h', joinedAt: 1, displayName: 'Host', resumeToken: 'th' }),
      player({ id: 'g', joinedAt: 2, displayName: 'Guest', resumeToken: 'tg' }),
    ]
    room.resumeTokens = { th: 'h', tg: 'g' }
    room.chatLastAt = { h: 1, g: 2 }

    const r = removePlayerFromRoom(room, 'h')
    expect(r.removed).toBe(true)
    expect(r.hostChanged).toBe(true)
    expect(r.newHostId).toBe('g')
    expect(room.hostId).toBe('g')
    expect(room.players.map((p) => p.id)).toEqual(['g'])
    expect(room.resumeTokens).toEqual({ tg: 'g' })
    expect(room.chatLastAt['h']).toBeUndefined()

    const last = removePlayerFromRoom(room, 'g')
    expect(last.removed).toBe(true)
    expect(room.players).toHaveLength(0)
    expect(room.hostId).toBeNull()
  })

  it('sanitizes and appends chat messages with rate limit', () => {
    expect(sanitizeChatText('  hello  ')).toBe('hello')
    expect(sanitizeChatText('')).toBeNull()
    expect(sanitizeChatText('a'.repeat(200))).toHaveLength(MAX_CHAT_TEXT_LENGTH)

    const room = createEmptyRoom('CHAT01')
    const p = player({ id: 'p1', joinedAt: 1, displayName: 'Alice' })
    room.players = [p]

    const r1 = appendChatMessage(room, p, '  やあ  ', 1000, 'c1')
    expect(r1.ok).toBe(true)
    if (r1.ok) {
      expect(r1.message.text).toBe('やあ')
      expect(r1.message.displayName).toBe('Alice')
    }
    expect(room.chatLog).toHaveLength(1)
    // revision must not change for chat
    expect(room.revision).toBe(0)

    const limited = appendChatMessage(room, p, 'too soon', 1000 + 100, 'c2')
    expect(limited.ok).toBe(false)
    if (!limited.ok) expect(limited.code).toBe('RATE_LIMITED')

    const r2 = appendChatMessage(
      room,
      p,
      'next',
      1000 + CHAT_COOLDOWN_MS,
      'c3',
    )
    expect(r2.ok).toBe(true)
    expect(room.chatLog).toHaveLength(2)
  })

  it('builds lobby view with host and canStart only when all ready', () => {
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
    // HOLD-1: guest not ready → canStart false
    expect(hostView.canStart).toBe(false)
    expect(hostView.players[0]!.isHost).toBe(true)
    expect(hostView.players[1]!.isHost).toBe(false)

    room.players[1]!.ready = true
    expect(buildPlayerView(room, 'p1').canStart).toBe(true)

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

  it('allPlayersReady / canHostStart (HOLD-1)', () => {
    const room = createEmptyRoom('ABC234')
    room.hostId = 'p1'
    room.players = [
      player({ id: 'p1', joinedAt: 1, ready: true }),
      player({ id: 'p2', joinedAt: 2, ready: true }),
    ]
    expect(allPlayersReady(room)).toBe(true)
    expect(canHostStart(room, 'p1')).toBe(true)
    expect(canHostStart(room, 'p2')).toBe(false)
    room.players[0]!.ready = false
    expect(allPlayersReady(room)).toBe(false)
    expect(canHostStart(room, 'p1')).toBe(false)
  })

  it('parses dismiss_result and rematch', () => {
    expect(parseClientMessage({ type: 'dismiss_result' })).toEqual({
      type: 'dismiss_result',
    })
    expect(parseClientMessage({ type: 'rematch' })).toEqual({ type: 'rematch' })
  })

  it('result dismiss ACK keeps pending for others (HOLD-2)', () => {
    const room = createEmptyRoom('ABC234')
    room.status = 'playing'
    room.hostId = 'p1'
    room.players = [
      player({ id: 'p1', joinedAt: 1 }),
      player({ id: 'p2', joinedAt: 2 }),
    ]
    const snap = {
      round: 1,
      outcome: {
        bid: 5,
        actualTotal: 3,
        calculation: {
          steps: [],
          finalTotal: 3,
          adjustedCards: [],
          doubleCount: 0,
          maxToZeroApplied: false,
          rawNumberSum: 3,
        },
        bidderWins: false,
        loserRole: 'bidder' as const,
        loserId: 'p1',
        bidderId: 'p1',
        challengerId: 'p2',
      },
      hands: {},
      winnerId: null,
      bidderId: 'p1',
      challengerId: 'p2',
      loserId: 'p1',
    } satisfies PendingResultSnapshot
    room.pendingResult = snap

    const d1 = applyResultDismiss(room, 'p1')
    expect(d1.changed).toBe(true)
    expect(d1.cleared).toBe(false)
    expect(room.pendingResult).not.toBeNull()
    // p1 no longer sees result; p2 still does
    expect(buildPlayerView(room, 'p1').pendingResult).toBeUndefined()
    expect(buildPlayerView(room, 'p1').phase).toBe('playing')
    expect(buildPlayerView(room, 'p2').pendingResult).toEqual(snap)
    expect(buildPlayerView(room, 'p2').phase).toBe('result')

    const d2 = applyResultDismiss(room, 'p2')
    expect(d2.cleared).toBe(true)
    expect(room.pendingResult).toBeNull()
    // Acks map is reset when the snapshot is fully cleared
    expect(room.resultAcks).toEqual({})
  })

  it('disconnected player does not block result clear (HOLD-2)', () => {
    const room = createEmptyRoom('ABC234')
    room.status = 'playing'
    room.players = [
      player({ id: 'p1', joinedAt: 1, connected: true }),
      player({ id: 'p2', joinedAt: 2, connected: false }),
    ]
    room.pendingResult = {
      round: 1,
      outcome: {
        bid: 1,
        actualTotal: 1,
        calculation: {
          steps: [],
          finalTotal: 1,
          adjustedCards: [],
          doubleCount: 0,
          maxToZeroApplied: false,
          rawNumberSum: 1,
        },
        bidderWins: true,
        loserRole: 'challenger',
        loserId: 'p2',
        bidderId: 'p1',
        challengerId: 'p2',
      },
      hands: {},
      winnerId: null,
      bidderId: 'p1',
      challengerId: 'p2',
      loserId: 'p2',
    }
    const d = applyResultDismiss(room, 'p1')
    expect(d.cleared).toBe(true)
    expect(room.pendingResult).toBeNull()
  })

  it('resetRoomForRematch returns to open lobby (HOLD-3)', () => {
    const room = createEmptyRoom('ABC234') as RoomState
    room.status = 'playing'
    room.hostId = 'p1'
    room.players = [
      player({ id: 'p1', joinedAt: 1, ready: true }),
      player({ id: 'p2', joinedAt: 2, ready: true }),
    ]
    room.game = { phase: 'game_over' } as RoomState['game']
    room.pendingResult = { round: 9 } as PendingResultSnapshot
    room.resultAcks = { p1: true }
    room.bidHistory = [{ playerId: 'p1', value: 3, round: 1 }]
    room.appliedActions = { a1: 1 }

    resetRoomForRematch(room)
    expect(room.status).toBe('open')
    expect(room.game).toBeNull()
    expect(room.pendingResult).toBeNull()
    expect(room.resultAcks).toEqual({})
    expect(room.bidHistory).toEqual([])
    expect(room.appliedActions).toEqual({})
    expect(room.players.every((p) => !p.ready)).toBe(true)
    expect(room.hostId).toBe('p1')
    expect(room.players).toHaveLength(2)
    expect(buildPlayerView(room, 'p1').phase).toBe('lobby')
    expect(buildPlayerView(room, 'p1').canStart).toBe(false) // ready cleared
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
