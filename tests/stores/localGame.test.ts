import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLocalGameStore } from '../../src/stores/localGame'
import { SELF_ID } from '../../src/localGame/profiles'
import { getLegalMoves } from '../../src/domain/game'

/** Instant pacing for unit tests */
const FAST = { botDelayMs: 0 } as const

describe('localGame store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('startLocalGame deals and exposes a game view', async () => {
    const store = useLocalGameStore()
    await store.startLocalGame({ seed: 11, ...FAST })
    expect(store.hasSession).toBe(true)
    expect(store.state?.phase).toBe('bidding')
    expect(store.gameView?.players).toHaveLength(4)
    const self = store.gameView?.players.find((p) => p.isSelf)
    expect(self?.handHidden).toBe(true)
    const others = store.gameView?.players.filter((p) => !p.isSelf) ?? []
    expect(others.every((p) => !p.handHidden && p.handLabel)).toBe(true)
    expect(store.botsRunning).toBe(false)
  })

  it('placeBid then bots may produce a pending result via challenge chain', async () => {
    const store = useLocalGameStore()
    await store.startLocalGame({ seed: 3, ...FAST })

    if (store.pendingResult) {
      expect(store.pendingResult.calcSteps.length).toBeGreaterThan(0)
      expect(store.pendingResult.finalTotal).toBeTypeOf('number')
      return
    }

    for (let i = 0; i < 40; i++) {
      if (store.pendingResult || store.isGameOver) break
      const s = store.state!
      if (s.currentTurnPlayerId !== SELF_ID) {
        await store.runBots()
        continue
      }
      const moves = getLegalMoves(s)
      const canCh = moves.some((m) => m.type === 'CHALLENGE')
      if (canCh && s.currentBid != null && s.currentBid > 50) {
        const r = await store.challenge()
        expect(r.hasResult).toBe(true)
        break
      }
      const bidMove = moves.find((m) => m.type === 'PLACE_BID')
      if (!bidMove || bidMove.type !== 'PLACE_BID') break
      await store.placeBid(bidMove.minValue)
    }

    if (store.pendingResult) {
      expect(store.pendingResult.cards.length).toBeGreaterThanOrEqual(2)
      expect(store.pendingResult.calcSteps.length).toBeGreaterThan(0)
      expect(
        store.state?.phase === 'bidding' || store.state?.phase === 'game_over',
      ).toBe(true)
    }
  })

  it('challenge from self captures calculation in pendingResult', async () => {
    const store = useLocalGameStore()
    await store.startLocalGame({ seed: 21, ...FAST })

    for (let guard = 0; guard < 20; guard++) {
      if (store.pendingResult) break
      const s = store.state!
      if (s.phase !== 'bidding') break

      if (s.currentTurnPlayerId !== SELF_ID) {
        await store.runBots()
        if (store.pendingResult) break
        continue
      }

      if (s.currentBid != null) {
        const r = await store.challenge()
        expect(r.hasResult).toBe(true)
        expect(store.pendingResult).toBeTruthy()
        expect(store.pendingResult!.finalTotal).toBe(
          store.state!.lastOutcome!.calculation.finalTotal,
        )
        expect(store.pendingResult!.bidValue).toBe(store.state!.lastOutcome!.bid)
        return
      }

      await store.placeBid(1)
    }

    expect(store.hasSession).toBe(true)
  })
})
