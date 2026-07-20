/**
 * Room turn clock: main bank + per-turn temporary time.
 *
 * Consumption order while a turn is active:
 * 1. Per-turn temporary time (毎ターンもらえる一時時間) decreases first
 * 2. Then main bank (持ち時間)
 *
 * Unused temporary time is discarded at end of turn; bank carries over.
 * Example "5 + 20" with main=300s, turn=20s: the 20s drain first, then bank.
 */

export interface WireTimeControl {
  /** Main bank seconds (持ち時間). 0 = no bank, only per-turn time. */
  mainSeconds: number
  /** Temporary seconds granted at the start of each turn. */
  turnSeconds: number
}

/** Live clock state stored on RoomState while a timed game is running. */
export interface RoomClock {
  /** Remaining main bank per player (ms). */
  bankMs: Record<string, number>
  /** Player currently on the clock, or null when paused / no turn. */
  turnPlayerId: string | null
  /** Epoch ms when the current turn clock started; null when paused. */
  turnStartedAt: number | null
  /** Bank snapshot at turn start (ms). */
  bankAtTurnStartMs: number
  /** Temporary budget for this turn (ms), full amount at start. */
  turnBonusMs: number
}

export const DEFAULT_TIME_CONTROL: WireTimeControl | null = null

/** Main bank: 0 … 60 min. */
export const MIN_MAIN_SECONDS = 0
export const MAX_MAIN_SECONDS = 60 * 60
/** Per-turn temporary: 5 … 5 min (when control is enabled). */
export const MIN_TURN_SECONDS = 5
export const MAX_TURN_SECONDS = 5 * 60

export function isTimeControlEnabled(
  tc: WireTimeControl | null | undefined,
): tc is WireTimeControl {
  return (
    tc != null &&
    typeof tc.mainSeconds === 'number' &&
    typeof tc.turnSeconds === 'number' &&
    tc.turnSeconds > 0
  )
}

export function createInitialClock(
  playerIds: readonly string[],
  tc: WireTimeControl,
  firstTurnPlayerId: string | null,
  now: number,
): RoomClock {
  const bankMs: Record<string, number> = {}
  const mainMs = Math.max(0, Math.floor(tc.mainSeconds * 1000))
  for (const id of playerIds) {
    bankMs[id] = mainMs
  }
  const clock: RoomClock = {
    bankMs,
    turnPlayerId: null,
    turnStartedAt: null,
    bankAtTurnStartMs: 0,
    turnBonusMs: 0,
  }
  if (firstTurnPlayerId) {
    return startTurn(clock, firstTurnPlayerId, tc.turnSeconds, now)
  }
  return clock
}

export function remainingForPlayer(
  clock: RoomClock,
  playerId: string,
  now: number,
): { bankMs: number; tempMs: number; totalMs: number } {
  const bankStored = Math.max(0, clock.bankMs[playerId] ?? 0)

  if (
    clock.turnPlayerId !== playerId ||
    clock.turnStartedAt == null ||
    now < clock.turnStartedAt
  ) {
    return { bankMs: bankStored, tempMs: 0, totalMs: bankStored }
  }

  const elapsed = Math.max(0, now - clock.turnStartedAt)
  const fromTemp = Math.min(elapsed, clock.turnBonusMs)
  const tempMs = Math.max(0, clock.turnBonusMs - fromTemp)
  const bankElapsed = Math.max(0, elapsed - fromTemp)
  const bankMs = Math.max(0, clock.bankAtTurnStartMs - bankElapsed)
  return { bankMs, tempMs, totalMs: bankMs + tempMs }
}

/** Absolute deadline when the current turn runs out of bank + temp. */
export function turnDeadlineAt(clock: RoomClock): number | null {
  if (clock.turnStartedAt == null || !clock.turnPlayerId) return null
  return clock.turnStartedAt + clock.bankAtTurnStartMs + clock.turnBonusMs
}

export function isTurnTimedOut(clock: RoomClock, now: number): boolean {
  const deadline = turnDeadlineAt(clock)
  return deadline != null && now >= deadline
}

/**
 * Freeze the active turn into bankMs and clear the running timer.
 * Call when the turn ends or the clock pauses (result screen).
 */
export function settleTurn(clock: RoomClock, now: number): RoomClock {
  if (clock.turnStartedAt == null || !clock.turnPlayerId) {
    return {
      ...clock,
      turnPlayerId: null,
      turnStartedAt: null,
      bankAtTurnStartMs: 0,
      turnBonusMs: 0,
    }
  }

  const { bankMs } = remainingForPlayer(clock, clock.turnPlayerId, now)
  return {
    bankMs: { ...clock.bankMs, [clock.turnPlayerId]: bankMs },
    turnPlayerId: null,
    turnStartedAt: null,
    bankAtTurnStartMs: 0,
    turnBonusMs: 0,
  }
}

/** Start (or restart) the temporary+bank clock for a player's turn. */
export function startTurn(
  clock: RoomClock,
  playerId: string,
  turnSeconds: number,
  now: number,
): RoomClock {
  const settled =
    clock.turnStartedAt != null ? settleTurn(clock, now) : { ...clock }
  const bankAtTurnStartMs = Math.max(0, settled.bankMs[playerId] ?? 0)
  const turnBonusMs = Math.max(0, Math.floor(turnSeconds * 1000))
  return {
    ...settled,
    bankMs: { ...settled.bankMs },
    turnPlayerId: playerId,
    turnStartedAt: now,
    bankAtTurnStartMs,
    turnBonusMs,
  }
}

/** Wire snapshot for clients (absolute times so they can animate locally). */
export interface WireClockSnapshot {
  /** Remaining bank ms per player (settled; active turn uses bankAtTurnStartMs). */
  bankMsByPlayer: Record<string, number>
  currentTurnPlayerId: string | null
  turnStartedAt: number | null
  bankAtTurnStartMs: number
  turnBonusMs: number
  /** Convenience: turnStartedAt + bank + temp, or null when paused. */
  deadlineAt: number | null
}

export function toWireClock(clock: RoomClock): WireClockSnapshot {
  return {
    bankMsByPlayer: { ...clock.bankMs },
    currentTurnPlayerId: clock.turnPlayerId,
    turnStartedAt: clock.turnStartedAt,
    bankAtTurnStartMs: clock.bankAtTurnStartMs,
    turnBonusMs: clock.turnBonusMs,
    deadlineAt: turnDeadlineAt(clock),
  }
}
