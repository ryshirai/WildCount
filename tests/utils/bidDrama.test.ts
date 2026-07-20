import { describe, expect, it } from 'vitest'
import {
  bidCountInRound,
  bidDeclareEventId,
  classifyRaise,
  classifyRoundBidDrama,
  coyoteCutInEventId,
  createDramaEventDeduper,
  dramaEventForLatestBid,
  heatLevel,
  HEAT_DANGER_MAX,
  HEAT_HEATING_MAX,
  HEAT_WARM_MAX,
  isDoubleRaise,
  latestBidInRound,
  makeDramaEventId,
  previousBidInRound,
  raiseCutInEventId,
  raiseIntensityFromTier,
  raiseTierLabel,
  raiseCutInTitle,
  heatStageLabel,
  raiseTier,
  rallyCount,
  RAISE_BIG_MIN,
  RAISE_NICE_MIN,
  RAISE_WILD_MIN,
  RALLY_DISPLAY_MIN,
  roundStartEventId,
  shouldShowRally,
  timerUrgentEventId,
  turnStartEventId,
  type BidHistoryLike,
} from '../../src/utils/bidDrama'

describe('heatLevel', () => {
  it('none at 0 or invalid', () => {
    expect(heatLevel(0)).toBe('none')
    expect(heatLevel(-1)).toBe('none')
    expect(heatLevel(Number.NaN)).toBe('none')
  })

  it('warm on 1..HEAT_WARM_MAX', () => {
    expect(heatLevel(1)).toBe('warm')
    expect(heatLevel(HEAT_WARM_MAX)).toBe('warm')
  })

  it('heating just above warm through HEAT_HEATING_MAX', () => {
    expect(heatLevel(HEAT_WARM_MAX + 1)).toBe('heating')
    expect(heatLevel(HEAT_HEATING_MAX)).toBe('heating')
  })

  it('danger just above heating through HEAT_DANGER_MAX', () => {
    expect(heatLevel(HEAT_HEATING_MAX + 1)).toBe('danger')
    expect(heatLevel(HEAT_DANGER_MAX)).toBe('danger')
  })

  it('wild above HEAT_DANGER_MAX', () => {
    expect(heatLevel(HEAT_DANGER_MAX + 1)).toBe('wild')
    expect(heatLevel(20)).toBe('wild')
  })

  it('floors fractional counts', () => {
    expect(heatLevel(2.9)).toBe('warm')
    expect(heatLevel(5.1)).toBe('heating')
  })
})

describe('rallyCount / shouldShowRally', () => {
  it('tracks bid count and hides on first bid', () => {
    expect(rallyCount(0)).toBe(0)
    expect(shouldShowRally(0)).toBe(false)
    expect(rallyCount(1)).toBe(1)
    expect(shouldShowRally(1)).toBe(false)
  })

  it('shows from RALLY_DISPLAY_MIN', () => {
    expect(RALLY_DISPLAY_MIN).toBe(2)
    expect(shouldShowRally(RALLY_DISPLAY_MIN)).toBe(true)
    expect(rallyCount(5)).toBe(5)
    expect(shouldShowRally(5)).toBe(true)
  })
})

describe('classifyRaise / raiseTier', () => {
  it('opening bid uses absolute value bands', () => {
    expect(raiseTier(null, 1)).toBe('normal')
    expect(raiseTier(null, 2)).toBe('normal')
    expect(raiseTier(null, RAISE_NICE_MIN)).toBe('nice')
    expect(raiseTier(null, RAISE_BIG_MIN - 1)).toBe('nice')
    expect(raiseTier(null, RAISE_BIG_MIN)).toBe('big')
    expect(raiseTier(null, RAISE_WILD_MIN - 1)).toBe('big')
    expect(raiseTier(null, RAISE_WILD_MIN)).toBe('wild')
    expect(classifyRaise(null, 8)).toEqual({
      tier: 'big',
      delta: null,
      doubleRaise: false,
    })
  })

  it('raise delta normal / nice / big / wild boundaries', () => {
    // +1..+2 normal
    expect(raiseTier(5, 6)).toBe('normal')
    expect(raiseTier(5, 7)).toBe('normal')
    // +3..+5 nice
    expect(raiseTier(5, 5 + RAISE_NICE_MIN)).toBe('nice')
    expect(raiseTier(5, 5 + RAISE_BIG_MIN - 1)).toBe('nice')
    // +6..+9 big
    expect(raiseTier(5, 5 + RAISE_BIG_MIN)).toBe('big')
    expect(raiseTier(5, 5 + RAISE_WILD_MIN - 1)).toBe('big')
    // +10+ wild
    expect(raiseTier(5, 5 + RAISE_WILD_MIN)).toBe('wild')
    expect(raiseTier(1, 100)).toBe('wild')
  })

  it('reports delta and doubleRaise modifier', () => {
    expect(classifyRaise(5, 8)).toEqual({
      tier: 'nice',
      delta: 3,
      doubleRaise: false,
    })
    // 5 → 10 is ×2 and +5 nice
    expect(classifyRaise(5, 10)).toEqual({
      tier: 'nice',
      delta: 5,
      doubleRaise: true,
    })
    // 4 → 12 is ×3 and +8 big
    expect(classifyRaise(4, 12)).toEqual({
      tier: 'big',
      delta: 8,
      doubleRaise: true,
    })
  })

  it('doubleRaise false when previous is 0 / null / not doubled', () => {
    expect(isDoubleRaise(null, 10)).toBe(false)
    expect(isDoubleRaise(0, 10)).toBe(false)
    expect(isDoubleRaise(5, 9)).toBe(false)
    expect(isDoubleRaise(5, 10)).toBe(true)
  })

  it('maps to legacy intensity without dual ad-hoc rules', () => {
    expect(raiseIntensityFromTier(classifyRaise(null, 3))).toBe('open')
    expect(raiseIntensityFromTier(classifyRaise(5, 6))).toBe('soft')
    expect(raiseIntensityFromTier(classifyRaise(5, 7))).toBe('normal')
    expect(raiseIntensityFromTier(classifyRaise(5, 8))).toBe('hard')
    expect(raiseIntensityFromTier(classifyRaise(5, 20))).toBe('hard')
  })

  it('raiseTierLabel / raiseCutInTitle for D1 UI', () => {
    expect(raiseTierLabel(classifyRaise(null, 12))).toBeNull()
    expect(raiseTierLabel(classifyRaise(5, 6))).toBeNull()
    expect(raiseTierLabel(classifyRaise(5, 8))).toBe('NICE RAISE')
    expect(raiseTierLabel(classifyRaise(5, 12))).toBe('BIG JUMP +7')
    expect(raiseTierLabel(classifyRaise(5, 20))).toBe('WILD CALL +15')
    expect(raiseCutInTitle(classifyRaise(null, 3))).toBe('宣言！')
    expect(raiseCutInTitle(classifyRaise(5, 8))).toBe('NICE RAISE')
    expect(raiseCutInTitle(classifyRaise(5, 12))).toBe('BIG JUMP')
    expect(raiseCutInTitle(classifyRaise(5, 20))).toBe('WILD CALL')
  })
})

describe('heatStageLabel', () => {
  it('labels each heat stage', () => {
    expect(heatStageLabel('none')).toBeNull()
    expect(heatStageLabel('warm')).toBe('WARM UP')
    expect(heatStageLabel('heating')).toBe('HEATING')
    expect(heatStageLabel('danger')).toBe('BLAZING')
    expect(heatStageLabel('wild')).toBe('OVERDRIVE')
  })
})

describe('history helpers + classifyRoundBidDrama', () => {
  const history: BidHistoryLike[] = [
    { round: 1, value: 2, playerId: 'a' },
    { round: 1, value: 5, playerId: 'b' },
    { round: 1, value: 12, playerId: 'c' },
    { round: 2, value: 1, playerId: 'a' },
  ]

  it('counts and peeks per round', () => {
    expect(bidCountInRound(history, 1)).toBe(3)
    expect(bidCountInRound(history, 2)).toBe(1)
    expect(bidCountInRound(history, 3)).toBe(0)
    expect(latestBidInRound(history, 1)).toBe(12)
    expect(previousBidInRound(history, 1)).toBe(5)
    expect(previousBidInRound(history, 2)).toBeNull()
  })

  it('same history yields same heat / rally / raise', () => {
    const d1 = classifyRoundBidDrama(history, 1)
    const d1b = classifyRoundBidDrama([...history], 1)
    expect(d1).toEqual(d1b)
    expect(d1.bidCount).toBe(3)
    expect(d1.heat).toBe('heating')
    expect(d1.showRally).toBe(true)
    expect(d1.rally).toBe(3)
    expect(d1.raise).toEqual({
      tier: 'big',
      delta: 7,
      doubleRaise: true,
    })
  })

  it('resets classification on a new round', () => {
    const d2 = classifyRoundBidDrama(history, 2)
    expect(d2.bidCount).toBe(1)
    expect(d2.heat).toBe('warm')
    expect(d2.showRally).toBe(false)
    expect(d2.raise).toEqual({
      tier: 'normal',
      delta: null,
      doubleRaise: false,
    })
  })

  it('empty round is idle', () => {
    expect(classifyRoundBidDrama([], 1)).toEqual({
      bidCount: 0,
      rally: 0,
      showRally: false,
      heat: 'none',
      raise: null,
    })
  })
})

describe('event identity', () => {
  it('is stable regardless of part key order', () => {
    const a = makeDramaEventId('bid_declare', { round: 3, seq: 5, value: 12 })
    const b = makeDramaEventId('bid_declare', { value: 12, seq: 5, round: 3 })
    expect(a).toBe(b)
    expect(a).toBe('bid_declare:round=3:seq=5:value=12')
  })

  it('helpers produce deterministic public ids', () => {
    expect(
      bidDeclareEventId({ round: 1, seq: 2, value: 8, playerId: 'p1' }),
    ).toBe('bid_declare:playerId=p1:round=1:seq=2:value=8')
    expect(
      raiseCutInEventId({ round: 1, seq: 2, value: 8, tier: 'nice' }),
    ).toBe('raise_cutin:round=1:seq=2:tier=nice:value=8')
    expect(coyoteCutInEventId({ round: 2, bidValue: 18, challengerId: 'c' })).toBe(
      'coyote_cutin:bid=18:challengerId=c:round=2',
    )
    expect(roundStartEventId(4)).toBe('round_start:round=4')
    expect(
      turnStartEventId({ round: 1, playerId: 'a', turnKey: 1000 }),
    ).toBe('turn_start:playerId=a:round=1:turnKey=1000')
    expect(
      timerUrgentEventId({ round: 1, playerId: 'a', turnKey: 1000 }),
    ).toBe('timer_urgent:playerId=a:round=1:turnKey=1000')
  })

  it('deduper allows first fire only', () => {
    const d = createDramaEventDeduper()
    const id = bidDeclareEventId({ round: 1, seq: 1, value: 3 })
    expect(d.tryConsume(id)).toBe(true)
    expect(d.tryConsume(id)).toBe(false)
    expect(d.has(id)).toBe(true)
    expect(d.size()).toBe(1)
    d.forget(id)
    expect(d.tryConsume(id)).toBe(true)
    d.clear()
    expect(d.size()).toBe(0)
    expect(d.tryConsume(id)).toBe(true)
  })

  it('dramaEventForLatestBid ties classification to identity', () => {
    const history: BidHistoryLike[] = [
      { round: 1, value: 2, playerId: 'a' },
      { round: 1, value: 14, playerId: 'b' },
    ]
    const ev = dramaEventForLatestBid({
      history,
      round: 1,
      actorId: 'b',
      actorName: 'Wolf',
    })
    expect(ev).not.toBeNull()
    expect(ev!.id).toBe(
      bidDeclareEventId({ round: 1, seq: 2, value: 14, playerId: 'b' }),
    )
    expect(ev!.heat).toBe('warm')
    expect(ev!.raise?.tier).toBe('wild')
    expect(ev!.raise?.delta).toBe(12)
    expect(ev!.intensity).toBe('hard')
    expect(ev!.rally).toBe(2)

    const again = dramaEventForLatestBid({
      history,
      round: 1,
      actorId: 'b',
    })
    expect(again!.id).toBe(ev!.id)

    const dedupe = createDramaEventDeduper()
    expect(dedupe.tryConsume(ev!.id)).toBe(true)
    expect(dedupe.tryConsume(again!.id)).toBe(false)
  })
})
