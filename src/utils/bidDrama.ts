/**
 * Gameplay dopamine D0 — pure classification for in-round bid drama.
 *
 * HEAT / RALLY / RAISE, shared drama event shapes, and stable event identity.
 * No Vue / engine / network deps — unit-test friendly.
 *
 * Does **not** mutate game rules or domain state. All outputs are display-only.
 *
 * ## Current FX fire points (inventory, D0)
 *
 * | Event | Where it fires | Trigger | Dedup today |
 * |-------|----------------|---------|-------------|
 * | Bid number pop / declare burst | `CurrentBidDisplay.vue` | `currentBid` watch | component-local prevBid only |
 * | BidDeclareCutIn (open/hard) | `useGameSession` → `playBidFx` | `room.currentBid` watch + `raiseIntensity` | Date.now key; gates vs coyote/extra |
 * | ExtraActionCutIn | `playExtraFx` (local action / online `lastActionFx`) | declare+extra / same / change | Date.now key; clears bid cut-in |
 * | CoyoteCutIn | `useChallengeReveal` | `pendingResult` / mock challenge | `cutInPlayed` flag |
 * | Card stagger reveal | `useChallengeReveal` + `RevealCardTile` | after coyote cut-in | timers; skip → final |
 * | ROUND N banner | `useGameSession` `round` watch | round increase | `prevRoundForBanner` |
 * | Self turn edge glow | `showTurnEdge` computed | isSelfTurn + no overlay | recomputed (no one-shot id) |
 * | Turn clock urgent | `TurnClockDisplay` + `isClockUrgent` | remaining ≤ 10s | CSS class only |
 * | Result total slam / confetti | `ResultView` + `resultDrama` | count-up done | view-local refs |
 * | Lobby copy sparkle | `LobbyView` + `FxSparkleBurst` | copied | unrelated to table drama |
 *
 * D1+ should route new HEAT/RALLY/RAISE through this module and fire via
 * `makeDramaEventId` + `DramaEventDeduper` so remount / reconnect do not replay.
 *
 * Spec: `docs/gameplay-dopamine-plan.md` §4.1–4.3, §7 D0.
 */

import type { RaiseIntensity } from '@/utils/resultDrama'

// ---------------------------------------------------------------------------
// Thresholds (display-only; tune from playtests)
// ---------------------------------------------------------------------------

/** bidCount in [1, HEAT_WARM_MAX] → warm */
export const HEAT_WARM_MAX = 2
/** bidCount in (HEAT_WARM_MAX, HEAT_HEATING_MAX] → heating */
export const HEAT_HEATING_MAX = 5
/** bidCount in (HEAT_HEATING_MAX, HEAT_DANGER_MAX] → danger; above → wild */
export const HEAT_DANGER_MAX = 8

/** RALLY badge starts at this consecutive bid count (×2, ×3, …). */
export const RALLY_DISPLAY_MIN = 2

/**
 * RAISE delta bands (after first bid) and open-bid absolute bands (same edges).
 * | 1..2 normal | 3..5 nice | 6..9 big | 10+ wild |
 */
export const RAISE_NICE_MIN = 3
export const RAISE_BIG_MIN = 6
export const RAISE_WILD_MIN = 10

// ---------------------------------------------------------------------------
// HEAT
// ---------------------------------------------------------------------------

/** Table heat stage from consecutive unchallenged bids this round. */
export type HeatLevel = 'none' | 'warm' | 'heating' | 'danger' | 'wild'

/**
 * Map consecutive bid count in the current round → HEAT stage.
 * @param bidCount number of confirmed bids this round (0 before first bid)
 */
export function heatLevel(bidCount: number): HeatLevel {
  const n = sanitizeCount(bidCount)
  if (n <= 0) return 'none'
  if (n <= HEAT_WARM_MAX) return 'warm'
  if (n <= HEAT_HEATING_MAX) return 'heating'
  if (n <= HEAT_DANGER_MAX) return 'danger'
  return 'wild'
}

// ---------------------------------------------------------------------------
// RALLY
// ---------------------------------------------------------------------------

/**
 * Consecutive bid count used for RALLY display (same as bid count in round).
 * UI shows `RALLY ×N` only when {@link shouldShowRally} is true.
 */
export function rallyCount(bidCount: number): number {
  return sanitizeCount(bidCount)
}

/** True from the 2nd consecutive bid onward. */
export function shouldShowRally(bidCount: number): boolean {
  return rallyCount(bidCount) >= RALLY_DISPLAY_MIN
}

// ---------------------------------------------------------------------------
// RAISE tier
// ---------------------------------------------------------------------------

/**
 * Strength of a bid declare for NICE / BIG / WILD labels.
 *
 * Opening bids use the same bands on **absolute value** (`delta == null`).
 * Legacy wave-3 {@link RaiseIntensity} (`open|soft|normal|hard`) stays in
 * `resultDrama.ts` for existing CSS/cut-in until D1 remaps presentation.
 * Prefer {@link classifyRaise} + {@link raiseIntensityFromTier} as the single path.
 */
export type RaiseTier = 'normal' | 'nice' | 'big' | 'wild'

export type RaiseClassification = {
  tier: RaiseTier
  /** next − previous when both numbers; null on opening bid this round */
  delta: number | null
  /**
   * Modifier: next ≥ previous × 2 (previous > 0).
   * Stacks with tier (e.g. big + double ring). Does not apply on open bid.
   */
  doubleRaise: boolean
}

/**
 * Classify a bid for RAISE labels.
 * @param previous previous currentBid (null = opening bid this round)
 * @param next new bid value
 */
export function classifyRaise(
  previous: number | null,
  next: number,
): RaiseClassification {
  if (previous == null) {
    return {
      tier: tierFromMagnitude(next),
      delta: null,
      doubleRaise: false,
    }
  }
  const delta = next - previous
  return {
    tier: tierFromMagnitude(delta),
    delta,
    doubleRaise: isDoubleRaise(previous, next),
  }
}

/** Convenience: tier only. */
export function raiseTier(previous: number | null, next: number): RaiseTier {
  return classifyRaise(previous, next).tier
}

/** Short on-table / cut-in label for RAISE tier (null = no special label). */
export function raiseTierLabel(
  classification: RaiseClassification | null | undefined,
): string | null {
  if (classification == null) return null
  // Opening bid: no tier label (cut-in uses 「宣言！」 separately)
  if (classification.delta == null) return null
  switch (classification.tier) {
    case 'nice':
      return 'いい上げ！'
    case 'big': {
      const n = classification.delta
      return n > 0 ? `大胆 +${n}` : '大胆ジャンプ'
    }
    case 'wild': {
      const n = classification.delta
      return n > 0 ? `大勝負 +${n}` : '大勝負'
    }
    default:
      return null
  }
}

/** Compact cut-in title (no +N; delta shown separately). */
export function raiseCutInTitle(
  classification: RaiseClassification | null | undefined,
): string {
  if (classification == null || classification.delta == null) return '宣言！'
  switch (classification.tier) {
    case 'nice':
      return 'いい上げ！'
    case 'big':
      return '大胆ジャンプ'
    case 'wild':
      return '大勝負'
    default:
      return '大幅アップ！'
  }
}

/**
 * HEAT stage label for UI chip (null when none).
 * Japanese UI copy — pure table-energy (bid-count only, not risk advice).
 */
export function heatStageLabel(heat: HeatLevel): string | null {
  switch (heat) {
    case 'warm':
      return '温まり中'
    case 'heating':
      return '盛り上がり'
    case 'danger':
      return '白熱'
    case 'wild':
      return '最高潮'
    default:
      return null
  }
}

/** True when next is at least double previous (previous must be > 0). */
export function isDoubleRaise(previous: number | null, next: number): boolean {
  if (previous == null || previous <= 0) return false
  return next >= previous * 2
}

/**
 * Bridge to existing wave-3 cut-in / CSS intensity without re-deriving deltas
 * in components. Opening bid → `open`; nice+ → `hard` (cut-in eligible).
 */
export function raiseIntensityFromTier(
  classification: RaiseClassification,
): RaiseIntensity {
  if (classification.delta == null) return 'open'
  switch (classification.tier) {
    case 'normal':
      return classification.delta <= 1 ? 'soft' : 'normal'
    case 'nice':
    case 'big':
    case 'wild':
      return 'hard'
    default:
      return 'normal'
  }
}

// ---------------------------------------------------------------------------
// Round snapshot from public inputs (local + online same)
// ---------------------------------------------------------------------------

/** Minimal bid-history shape (mirrors mappers / worker BidHistoryEntry). */
export type BidHistoryLike = {
  round: number
  value: number
  playerId?: string
}

/**
 * Count confirmed bids in a round from public history.
 * Prefer full session/worker bidHistory over seat chips (SAME / multi-hop).
 */
export function bidCountInRound(
  history: readonly BidHistoryLike[],
  round: number,
): number {
  if (!Number.isFinite(round)) return 0
  return history.filter((b) => b.round === round).length
}

/**
 * Previous bid value before the last entry in this round, or null if none / open.
 */
export function previousBidInRound(
  history: readonly BidHistoryLike[],
  round: number,
): number | null {
  const bids = history.filter((b) => b.round === round)
  if (bids.length < 2) return null
  return bids[bids.length - 2]!.value
}

/** Latest bid value in round, or null. */
export function latestBidInRound(
  history: readonly BidHistoryLike[],
  round: number,
): number | null {
  const bids = history.filter((b) => b.round === round)
  if (bids.length === 0) return null
  return bids[bids.length - 1]!.value
}

export type RoundBidDrama = {
  bidCount: number
  rally: number
  showRally: boolean
  heat: HeatLevel
  /** Classification of the latest bid; null if no bids yet */
  raise: RaiseClassification | null
}

/**
 * Same public history + round → same drama classification (local/online).
 * HEAT freezes at last bid count when COYOTE fires (caller stops advancing history).
 */
export function classifyRoundBidDrama(
  history: readonly BidHistoryLike[],
  round: number,
): RoundBidDrama {
  const bidCount = bidCountInRound(history, round)
  const latest = latestBidInRound(history, round)
  const previous = previousBidInRound(history, round)
  return {
    bidCount,
    rally: rallyCount(bidCount),
    showRally: shouldShowRally(bidCount),
    heat: heatLevel(bidCount),
    raise: latest == null ? null : classifyRaise(previous, latest),
  }
}

// ---------------------------------------------------------------------------
// Shared drama event types + identity
// ---------------------------------------------------------------------------

/**
 * Kinds of table/result presentation events.
 * Priority for concurrent display is defined in the plan §6 (not enforced here).
 */
export type DramaEventKind =
  | 'round_start'
  | 'turn_start'
  | 'timer_urgent'
  | 'bid_declare'
  | 'raise_cutin'
  | 'rally'
  | 'heat'
  | 'extra_action'
  | 'coyote_cutin'
  | 'card_reveal'
  | 'result_verdict'
  | 'confetti'

/** Stable string identity for dedup across remount / reconnect / double watch. */
export type DramaEventId = string

/** Display-only payload shared by local and online clients. */
export type DramaEvent = {
  id: DramaEventId
  kind: DramaEventKind
  /** Domain round (0 ok for lobby-only kinds) */
  round: number
  /** Consecutive bids this round when relevant */
  bidCount?: number
  heat?: HeatLevel
  rally?: number
  raise?: RaiseClassification
  /** Legacy intensity for existing cut-in components */
  intensity?: RaiseIntensity
  bidValue?: number
  actorId?: string
  actorName?: string
  targetId?: string
  targetName?: string
  extraKind?: string
  /** Absolute clock anchor when used for turn / timer identity */
  atMs?: number
}

/**
 * Build a deterministic event id from kind + public key parts.
 * Parts are sorted by key so object key order does not matter.
 *
 * @example
 * makeDramaEventId('bid_declare', { round: 3, seq: 5, value: 12 })
 * // → "bid_declare:round=3:seq=5:value=12"
 */
export function makeDramaEventId(
  kind: DramaEventKind,
  parts: Record<string, string | number | boolean | null | undefined> = {},
): DramaEventId {
  const segments = Object.keys(parts)
    .sort()
    .map((key) => {
      const raw = parts[key]
      if (raw == null) return `${key}=`
      if (typeof raw === 'boolean') return `${key}=${raw ? '1' : '0'}`
      return `${key}=${String(raw)}`
    })
  return segments.length === 0 ? kind : `${kind}:${segments.join(':')}`
}

/** Identity helpers for common events (public inputs only). */
export function bidDeclareEventId(opts: {
  round: number
  /** 1-based sequence within the round (= bidCount after this bid) */
  seq: number
  value: number
  playerId?: string
}): DramaEventId {
  return makeDramaEventId('bid_declare', {
    round: opts.round,
    seq: opts.seq,
    value: opts.value,
    playerId: opts.playerId,
  })
}

export function raiseCutInEventId(opts: {
  round: number
  seq: number
  value: number
  tier: RaiseTier
}): DramaEventId {
  return makeDramaEventId('raise_cutin', {
    round: opts.round,
    seq: opts.seq,
    value: opts.value,
    tier: opts.tier,
  })
}

export function coyoteCutInEventId(opts: {
  round: number
  bidValue: number
  challengerId?: string
}): DramaEventId {
  return makeDramaEventId('coyote_cutin', {
    round: opts.round,
    bid: opts.bidValue,
    challengerId: opts.challengerId,
  })
}

export function roundStartEventId(round: number): DramaEventId {
  return makeDramaEventId('round_start', { round })
}

export function turnStartEventId(opts: {
  round: number
  playerId: string
  /** Server turnStartedAt or stable turn index */
  turnKey: string | number
}): DramaEventId {
  return makeDramaEventId('turn_start', {
    round: opts.round,
    playerId: opts.playerId,
    turnKey: opts.turnKey,
  })
}

export function timerUrgentEventId(opts: {
  round: number
  playerId: string
  turnKey: string | number
}): DramaEventId {
  return makeDramaEventId('timer_urgent', {
    round: opts.round,
    playerId: opts.playerId,
    turnKey: opts.turnKey,
  })
}

/**
 * In-memory set of fired event ids.
 * Session-scoped; clear on leave / new match. Does not persist.
 */
export type DramaEventDeduper = {
  /** True if this id was already consumed. */
  has: (id: DramaEventId) => boolean
  /**
   * Mark id as seen. Returns true only on the first call for that id
   * (caller should fire FX only when true).
   */
  tryConsume: (id: DramaEventId) => boolean
  forget: (id: DramaEventId) => void
  clear: () => void
  size: () => number
}

export function createDramaEventDeduper(
  initial?: Iterable<DramaEventId>,
): DramaEventDeduper {
  const seen = new Set<DramaEventId>(initial)
  return {
    has: (id) => seen.has(id),
    tryConsume: (id) => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    },
    forget: (id) => {
      seen.delete(id)
    },
    clear: () => {
      seen.clear()
    },
    size: () => seen.size,
  }
}

/**
 * Build a bid_declare drama event from public history after a bid lands.
 * Returns null if history has no bids for the round.
 */
export function dramaEventForLatestBid(opts: {
  history: readonly BidHistoryLike[]
  round: number
  actorId?: string
  actorName?: string
}): DramaEvent | null {
  const { history, round, actorId, actorName } = opts
  const drama = classifyRoundBidDrama(history, round)
  if (drama.bidCount <= 0 || drama.raise == null) return null
  const value = latestBidInRound(history, round)
  if (value == null) return null
  const id = bidDeclareEventId({
    round,
    seq: drama.bidCount,
    value,
    playerId: actorId,
  })
  return {
    id,
    kind: 'bid_declare',
    round,
    bidCount: drama.bidCount,
    heat: drama.heat,
    rally: drama.rally,
    raise: drama.raise,
    intensity: raiseIntensityFromTier(drama.raise),
    bidValue: value,
    actorId,
    actorName,
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function sanitizeCount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

/**
 * Shared bands for raise delta and opening absolute value.
 * Non-positive magnitudes fall back to `normal` (invalid raise is not rewarded).
 */
function tierFromMagnitude(magnitude: number): RaiseTier {
  if (magnitude >= RAISE_WILD_MIN) return 'wild'
  if (magnitude >= RAISE_BIG_MIN) return 'big'
  if (magnitude >= RAISE_NICE_MIN) return 'nice'
  return 'normal'
}
