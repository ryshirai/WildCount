import { describe, expect, it } from 'vitest'
import {
  buildPlayerView,
  createEmptyRoom,
  parseClientMessage,
  sanitizeDisplayName,
} from './roomLogic'

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
})
