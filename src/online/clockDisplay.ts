/**
 * Client-side helpers for room turn clock display.
 * Mirrors worker/turnClock consumption order: temp first, then bank.
 */

import type { WireClockSnapshot, WireTimeControl } from './protocol'

export function formatClockMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) {
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${s}`
}

export function formatTimeControlLabel(
  tc: WireTimeControl | null | undefined,
): string | null {
  if (tc == null) return null
  const main =
    tc.mainSeconds >= 60 && tc.mainSeconds % 60 === 0
      ? `${tc.mainSeconds / 60}分`
      : `${tc.mainSeconds}秒`
  return `${main} + ${tc.turnSeconds}秒`
}

export function remainingForPlayer(
  clock: WireClockSnapshot,
  playerId: string,
  now: number,
): { bankMs: number; tempMs: number; totalMs: number } {
  const bankStored = Math.max(0, clock.bankMsByPlayer[playerId] ?? 0)

  if (
    clock.currentTurnPlayerId !== playerId ||
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

/** Display string like "1:23 + 15" for the active turn player. */
export function formatActiveTurnClock(
  clock: WireClockSnapshot,
  now: number,
): string | null {
  if (!clock.currentTurnPlayerId || clock.turnStartedAt == null) return null
  const r = remainingForPlayer(clock, clock.currentTurnPlayerId, now)
  const bank = formatClockMs(r.bankMs)
  const temp = formatClockMs(r.tempMs)
  // Temp gone → bank only; bank gone → temp only; otherwise bank + temp
  if (r.tempMs <= 0) {
    return bank
  }
  if (r.bankMs <= 0) {
    return temp
  }
  return `${bank} + ${temp}`
}

export function isClockUrgent(
  clock: WireClockSnapshot,
  now: number,
  thresholdMs = 10_000,
): boolean {
  if (!clock.currentTurnPlayerId || clock.turnStartedAt == null) return false
  const r = remainingForPlayer(clock, clock.currentTurnPlayerId, now)
  return r.totalMs > 0 && r.totalMs <= thresholdMs
}
