import { describe, expect, it } from 'vitest'
import {
  createInitialClock,
  isTurnTimedOut,
  remainingForPlayer,
  settleTurn,
  startTurn,
  turnDeadlineAt,
  type WireTimeControl,
} from './turnClock'
import {
  nextAlarmAt,
  parseWireTimeControl,
  createEmptyRoom,
  initClockForGame,
  syncClockAfterGameChange,
} from './roomLogic'
import { seedRandom, startGame } from '../src/domain/game'

const TC: WireTimeControl = { mainSeconds: 5, turnSeconds: 20 }

describe('turnClock', () => {
  it('consumes bank before temporary time', () => {
    const t0 = 1_000_000
    let clock = createInitialClock(['a', 'b'], TC, 'a', t0)
    // After 3s: bank 2s left, temp still full 20s
    let r = remainingForPlayer(clock, 'a', t0 + 3_000)
    expect(r.bankMs).toBe(2_000)
    expect(r.tempMs).toBe(20_000)
    expect(r.totalMs).toBe(22_000)

    // After 5s bank gone: temp starts
    r = remainingForPlayer(clock, 'a', t0 + 5_000)
    expect(r.bankMs).toBe(0)
    expect(r.tempMs).toBe(20_000)

    // After 5+7s: temp 13s
    r = remainingForPlayer(clock, 'a', t0 + 12_000)
    expect(r.bankMs).toBe(0)
    expect(r.tempMs).toBe(13_000)

    // Deadline = start + bank + temp
    expect(turnDeadlineAt(clock)).toBe(t0 + 5_000 + 20_000)
    expect(isTurnTimedOut(clock, t0 + 24_999)).toBe(false)
    expect(isTurnTimedOut(clock, t0 + 25_000)).toBe(true)
  })

  it('settles bank and discards unused temp between turns', () => {
    const t0 = 1_000_000
    let clock = createInitialClock(['a', 'b'], TC, 'a', t0)
    // a used 3s of bank
    clock = settleTurn(clock, t0 + 3_000)
    expect(clock.bankMs['a']).toBe(2_000)
    expect(clock.bankMs['b']).toBe(5_000)
    expect(clock.turnStartedAt).toBeNull()

    // b's turn gets full 20s temp; a bank preserved
    clock = startTurn(clock, 'b', TC.turnSeconds, t0 + 10_000)
    expect(clock.turnPlayerId).toBe('b')
    expect(clock.bankAtTurnStartMs).toBe(5_000)
    expect(clock.turnBonusMs).toBe(20_000)
    expect(clock.bankMs['a']).toBe(2_000)
  })

  it('parseWireTimeControl validates ranges', () => {
    expect(parseWireTimeControl(null)).toEqual({ timeControl: null })
    expect(parseWireTimeControl({ mainSeconds: 300, turnSeconds: 20 })).toEqual(
      {
        timeControl: { mainSeconds: 300, turnSeconds: 20 },
      },
    )
    expect(parseWireTimeControl({ mainSeconds: 5, turnSeconds: 2 })).toHaveProperty(
      'error',
    )
    expect(parseWireTimeControl({ mainSeconds: -1, turnSeconds: 20 })).toHaveProperty(
      'error',
    )
  })

  it('nextAlarmAt includes turn deadline', () => {
    const room = createEmptyRoom('ABC234')
    room.players = [
      {
        id: 'a',
        displayName: 'A',
        joinedAt: 1,
        ready: true,
        connected: true,
        resumeToken: 'ta',
        avatarIndex: 0,
      },
      {
        id: 'b',
        displayName: 'B',
        joinedAt: 2,
        ready: true,
        connected: true,
        resumeToken: 'tb',
        avatarIndex: 1,
      },
    ]
    room.hostId = 'a'
    room.timeControl = TC
    const t0 = 2_000_000
    room.game = startGame(
      { playerIds: ['a', 'b'], config: {} },
      seedRandom(1),
    )
    room.status = 'playing'
    initClockForGame(room, t0)
    const at = nextAlarmAt(room, t0)
    expect(at).toBe(t0 + 5_000 + 20_000)
  })

  it('syncClock pauses when pendingResult is set', () => {
    const room = createEmptyRoom('XYZ789')
    room.players = [
      {
        id: 'a',
        displayName: 'A',
        joinedAt: 1,
        ready: true,
        connected: true,
        resumeToken: 'ta',
        avatarIndex: 0,
      },
      {
        id: 'b',
        displayName: 'B',
        joinedAt: 2,
        ready: true,
        connected: true,
        resumeToken: 'tb',
        avatarIndex: 1,
      },
    ]
    room.timeControl = TC
    const t0 = 3_000_000
    room.game = startGame(
      { playerIds: ['a', 'b'], config: {} },
      seedRandom(2),
    )
    room.status = 'playing'
    initClockForGame(room, t0)
    const turnId = room.game.currentTurnPlayerId!
    // Minimal pending flag — only presence matters for pause
    room.pendingResult = { round: 1 } as never
    syncClockAfterGameChange(room, t0 + 1_000)
    expect(room.clock?.turnStartedAt).toBeNull()
    expect(room.clock?.bankMs[turnId]).toBe(4_000)
  })
})
