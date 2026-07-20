/**
 * Session-scoped COYOTE / result drama context (D3).
 *
 * Freezes public display-only flags at challenge time so ResultView and
 * remounts share the same LAST SECOND / MAX HEAT / sequence-played state.
 * Not part of the rules engine or wire protocol.
 */

import { createDramaEventDeduper, type DramaEventDeduper } from '@/utils/bidDrama'
import type { RareTag } from '@/utils/resultDrama'

export type CoyoteDramaContext = {
  /** Identity matching useChallengeReveal watch key */
  challengeKey: string
  round: number
  bidValue: number
  finalTotal: number
  /** Public consecutive bids when COYOTE fired */
  roundBidCount: number
  /** Last bid landed with ≤1s remaining (client clock) */
  lastSecondBid: boolean
  /** Coyote cut-in + card sequence already consumed for this challenge */
  coyoteSequencePlayed: boolean
  /** Result calc → slam sequence already consumed */
  resultSequencePlayed: boolean
}

let ctx: CoyoteDramaContext | null = null

/** Shared across Game remounts for coyote / result event ids. */
const sequenceDeduper: DramaEventDeduper = createDramaEventDeduper()

export function getCoyoteSequenceDeduper(): DramaEventDeduper {
  return sequenceDeduper
}

export function getCoyoteDramaContext(): CoyoteDramaContext | null {
  return ctx
}

export function clearCoyoteDramaContext(): void {
  ctx = null
}

/** Clear context + sequence ids (leave room / rematch / new match). */
export function resetCoyoteDramaSession(): void {
  ctx = null
  sequenceDeduper.clear()
}

/**
 * Freeze or refresh context when a challenge identity is first seen.
 * Same challengeKey keeps lastSecondBid / sequence flags (no downgrade).
 */
export function freezeCoyoteDramaContext(input: {
  challengeKey: string
  round: number
  bidValue: number
  finalTotal: number
  roundBidCount: number
  lastSecondBid: boolean
}): CoyoteDramaContext {
  if (ctx && ctx.challengeKey === input.challengeKey) {
    // Keep sequence flags; allow upgrading bid count if previously 0
    if (input.roundBidCount > ctx.roundBidCount) {
      ctx = { ...ctx, roundBidCount: input.roundBidCount }
    }
    if (input.lastSecondBid && !ctx.lastSecondBid) {
      ctx = { ...ctx, lastSecondBid: true }
    }
    return ctx
  }
  ctx = {
    challengeKey: input.challengeKey,
    round: input.round,
    bidValue: input.bidValue,
    finalTotal: input.finalTotal,
    roundBidCount: Math.max(0, Math.floor(input.roundBidCount)),
    lastSecondBid: input.lastSecondBid === true,
    coyoteSequencePlayed: false,
    resultSequencePlayed: false,
  }
  return ctx
}

export function markCoyoteSequencePlayed(challengeKey: string): void {
  if (ctx && ctx.challengeKey === challengeKey) {
    ctx = { ...ctx, coyoteSequencePlayed: true }
  }
}

export function markResultSequencePlayed(challengeKey: string): void {
  if (ctx && ctx.challengeKey === challengeKey) {
    ctx = { ...ctx, resultSequencePlayed: true }
  }
}

/** Build challenge key (shared by Game cut-in watch and Result sequence). */
export function coyoteChallengeKey(opts: {
  round: number
  bidValue: number
  challengerName: string
  finalTotal: number
}): string {
  return `${opts.round}:${opts.bidValue}:${opts.challengerName}:${opts.finalTotal}`
}

/** Rare-tag inputs from frozen context + result fields. */
export function dramaExtrasFromContext(): {
  lastSecondBid: boolean
  roundBidCount: number | null
  rareTagsHint: RareTag[]
} {
  if (!ctx) {
    return { lastSecondBid: false, roundBidCount: null, rareTagsHint: [] }
  }
  return {
    lastSecondBid: ctx.lastSecondBid,
    roundBidCount: ctx.roundBidCount,
    rareTagsHint: [],
  }
}
