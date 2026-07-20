import { describe, expect, it } from 'vitest'
import {
  createInitialClock,
  isTurnTimedOut,
  remainingForPlayer,
  resetMainBanks,
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
import { applyAction, seedRandom, startGame } from '../src/domain/game'

const TC: WireTimeControl = { mainSeconds: 5, turnSeconds: 20 }

describe('turnClock', () => {
  it('consumes temporary time before bank', () => {
    const t0 = 1_000_000
    let clock = createInitialClock(['a', 'b'], TC, 'a', t0)
    // After 3s: temp 17s left, bank still full 5s
    let r = remainingForPlayer(clock, 'a', t0 + 3_000)
    expect(r.bankMs).toBe(5_000)
    expect(r.tempMs).toBe(17_000)
    expect(r.totalMs).toBe(22_000)

    // After 20s temp gone: bank still full
    r = remainingForPlayer(clock, 'a', t0 + 20_000)
    expect(r.bankMs).toBe(5_000)
    expect(r.tempMs).toBe(0)

    // After 20+3s: bank 2s
    r = remainingForPlayer(clock, 'a', t0 + 23_000)
    expect(r.bankMs).toBe(2_000)
    expect(r.tempMs).toBe(0)

    // Deadline = start + temp + bank
    expect(turnDeadlineAt(clock)).toBe(t0 + 20_000 + 5_000)
    expect(isTurnTimedOut(clock, t0 + 24_999)).toBe(false)
    expect(isTurnTimedOut(clock, t0 + 25_000)).toBe(true)
  })

  it('settles bank and discards unused temp between turns', () => {
    const t0 = 1_000_000
    let clock = createInitialClock(['a', 'b'], TC, 'a', t0)
    // a used 3s of temp only — bank untouched
    clock = settleTurn(clock, t0 + 3_000)
    expect(clock.bankMs['a']).toBe(5_000)
    expect(clock.bankMs['b']).toBe(5_000)
    expect(clock.turnStartedAt).toBeNull()

    // b's turn gets full 20s temp; a bank preserved
    clock = startTurn(clock, 'b', TC.turnSeconds, t0 + 10_000)
    expect(clock.turnPlayerId).toBe('b')
    expect(clock.bankAtTurnStartMs).toBe(5_000)
    expect(clock.turnBonusMs).toBe(20_000)
    expect(clock.bankMs['a']).toBe(5_000)
  })

  it('settles bank after temp is exhausted', () => {
    const t0 = 1_000_000
    let clock = createInitialClock(['a', 'b'], TC, 'a', t0)
    // a used full 20s temp + 3s bank
    clock = settleTurn(clock, t0 + 23_000)
    expect(clock.bankMs['a']).toBe(2_000)
    expect(clock.bankMs['b']).toBe(5_000)
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
    // 1s came from temp; bank still full
    expect(room.clock?.bankMs[turnId]).toBe(5_000)
  })

  it('resetMainBanks restores full main for all players', () => {
    const t0 = 1_000_000
    let clock = createInitialClock(['a', 'b'], TC, 'a', t0, 1)
    clock = settleTurn(clock, t0 + 23_000) // a: temp gone + 3s bank
    expect(clock.bankMs['a']).toBe(2_000)
    clock = resetMainBanks(clock, TC.mainSeconds, ['a', 'b'], 2, t0 + 30_000)
    expect(clock.forRound).toBe(2)
    expect(clock.bankMs['a']).toBe(5_000)
    expect(clock.bankMs['b']).toBe(5_000)
    expect(clock.turnStartedAt).toBeNull()
  })

  it('syncClock resets banks when game.round advances', () => {
    const room = createEmptyRoom('RND001')
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
    const t0 = 4_000_000
    const rng = seedRandom(42)
    room.game = startGame({ playerIds: ['a', 'b'], config: {} }, rng)
    room.status = 'playing'
    initClockForGame(room, t0)
    expect(room.clock?.forRound).toBe(room.game.round)
    expect(room.game.round).toBe(1)

    // Drain some bank on the current turn
    const turnId = room.game.currentTurnPlayerId!
    room.clock = settleTurn(room.clock!, t0 + 23_000)
    expect(room.clock.bankMs[turnId]).toBe(2_000)

    // Simulate end of round → START_ROUND (next round)
    const challengerId = turnId === 'a' ? 'b' : 'a'
    room.game = {
      ...room.game,
      phase: 'round_end',
      currentTurnPlayerId: null,
      lastOutcome: {
        bid: 99,
        actualTotal: 1,
        calculation: {
          total: 1,
          steps: [],
          handsSnapshot: {},
        },
        bidderWins: false,
        loserRole: 'bidder',
        loserId: turnId,
        bidderId: turnId,
        challengerId,
        lifeLoss: 1,
      },
    }
    room.pendingResult = null
    room.game = applyAction(room.game, { type: 'START_ROUND' }, rng)
    expect(room.game.round).toBe(2)

    syncClockAfterGameChange(room, t0 + 60_000)
    expect(room.clock?.forRound).toBe(2)
    expect(room.clock?.bankMs['a']).toBe(5_000)
    expect(room.clock?.bankMs['b']).toBe(5_000)
    // New turn should be running with full bank + temp
    expect(room.clock?.turnStartedAt).toBe(t0 + 60_000)
    expect(room.clock?.bankAtTurnStartMs).toBe(5_000)
    expect(room.clock?.turnBonusMs).toBe(20_000)
  })
})
