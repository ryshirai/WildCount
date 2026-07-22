import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { mockGameRoom } from '@/data/mockGame'
import { mockResult } from '@/data/mockResult'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'
import type { ClientBidExtra } from '@/online/protocol'

/** Mirrors ExtraActionCutIn.vue — kept here so composables typecheck without .vue exports */
export type ExtraFxKind =
  | 'reverse'
  | 'shot'
  | 'draw1'
  | 'life_double'
  | 'same'
  | 'change'
import type { StampId } from '@/online/stamps'
import { allowLocalPlay, allowUiMock } from '@/config/runtime'
import { STANDARD_DECK, type DeckComposition } from '@/domain/game'
import { avatarByIndex, avatarSrc } from '@/localGame/avatarCatalog'
import type { WireDeckComposition } from '@/online/protocol'
import type { GameRoomMock } from '@/types/game'
import {
  useChallengeReveal,
  type UseChallengeRevealOptions,
} from '@/composables/useChallengeReveal'
import {
  LAST_SECOND_MS,
  shouldShowBidCutIn,
  type RaiseIntensity,
} from '@/utils/resultDrama'
import { playSfx } from '@/audio'
import { playHaptic } from '@/haptics'
import {
  classifyRaise,
  createDramaEventDeduper,
  heatLevel,
  heatStageLabel,
  raiseCutInEventId,
  raiseCutInTitle,
  raiseIntensityFromTier,
  shouldShowRally,
  turnStartEventId,
  type HeatLevel,
  type RaiseClassification,
  type RaiseTier,
} from '@/utils/bidDrama'
import { remainingForPlayer } from '@/online/clockDisplay'
import { resetCoyoteDramaSession } from '@/utils/coyoteDramaContext'

export type ExtraFxState = {
  key: string
  kind: ExtraFxKind
  actorName?: string
  targetName?: string
  bidValue?: number | null
} | null

export type BidFxState = {
  key: string
  intensity: RaiseIntensity
  tier: RaiseTier
  doubleRaise: boolean
  bidValue: number
  delta: number | null
  actorName: string
  /** Cut-in title (NICE RAISE / BIG JUMP / …) */
  title: string
} | null

/** Live table drama for HEAT / RALLY chrome (display-only). */
export type TableDramaState = {
  bidCount: number
  heat: HeatLevel
  heatLabel: string | null
  rally: number
  showRally: boolean
  lastBidderId: string | null
  currentTurnPlayerId: string | null
}

/**
 * Game screen session: online / local / mock resolution, actions, leave, toast.
 * Composes challenge-reveal FSM. Behavior preserved from GameView (R3 extract).
 */
export function useGameSession() {
  const router = useRouter()
  const route = useRoute()
  const store = useLocalGameStore()
  const onlineGame = useOnlineGameStore()
  const {
    gameView: localGameView,
    pendingResult: localPendingResult,
    hasSession,
    botsRunning: localBotsRunning,
    statusMessage: localStatusMessage,
    awaitingResultView: localAwaitingResult,
  } = storeToRefs(store)

  /** Fixed mock only in DEV builds */
  const useMock = computed(() => allowUiMock && route.query.mock === '1')
  /** Online multiplayer session (Worker / DO). */
  const isOnline = computed(
    () =>
      onlineGame.isOnlineSession ||
      route.query.online === '1' ||
      onlineGame.view != null,
  )

  const gameView = computed(() =>
    isOnline.value ? onlineGame.gameView : localGameView.value,
  )
  const pendingResult = computed(() =>
    isOnline.value ? onlineGame.pendingResult : localPendingResult.value,
  )
  const awaitingResultView = computed(() =>
    isOnline.value ? onlineGame.awaitingResultView : localAwaitingResult.value,
  )
  const botsRunning = computed(() =>
    isOnline.value ? false : localBotsRunning.value,
  )
  const statusMessage = computed(() => {
    if (isOnline.value) {
      // lastEvent is short-lived (auto-cleared in store); prefer turn / connection otherwise
      if (onlineGame.lastEvent) return onlineGame.lastEvent
      if (onlineGame.gameView?.isSelfTurn) return 'あなたの手番です'
      if (onlineGame.connection === 'closed' || onlineGame.connection === 'error') {
        return onlineGame.lastError ?? '接続が不安定です'
      }
      return null
    }
    return localStatusMessage.value
  })

  const toast = ref<string | null>(null)
  const helpOpen = ref(false)
  const deckInfoOpen = ref(false)
  /** Wave-2: ROUND N slam when round number increases */
  const roundBannerVisible = ref(false)
  const roundBannerNum = ref(1)
  let prevRoundForBanner: number | null = null
  /** Mobile overlay: null = play table (no drawer) */
  const mobileTab = ref<'chat' | 'log' | null>(null)
  /** Mobile quick stamp sheet (no full chat) */
  const stampSheetOpen = ref(false)
  /** Desktop right rail: event log or chat */
  const desktopSideTab = ref<'log' | 'chat'>('log')
  const draftBid = ref(0)
  const acting = ref(false)

  function openHelp() {
    helpOpen.value = true
  }

  function openDeckInfo() {
    deckInfoOpen.value = true
  }

  /** Room recipe deck (totals only — not remaining draw pile). */
  const roomDeck = computed((): WireDeckComposition | DeckComposition => {
    if (isOnline.value && onlineGame.view?.deck) {
      return onlineGame.view.deck
    }
    const local = store.state?.config.deck
    if (local) return local
    return STANDARD_DECK
  })

  function toggleMobileChat() {
    stampSheetOpen.value = false
    mobileTab.value = mobileTab.value === 'chat' ? null : 'chat'
  }

  function toggleMobileLog() {
    stampSheetOpen.value = false
    mobileTab.value = mobileTab.value === 'log' ? null : 'log'
  }

  function closeMobileDrawer() {
    mobileTab.value = null
  }

  function showToast(msg: string) {
    toast.value = msg
  }

  function dismissToast() {
    toast.value = null
  }

  function onSendChat(text: string) {
    if (!isOnline.value) {
      showToast('オンライン対戦のときだけ使えます')
      return
    }
    onlineGame.sendChat(text)
  }

  function onSendReaction(stampId: StampId) {
    if (!isOnline.value) {
      showToast('オンライン対戦のときだけ使えます')
      return
    }
    onlineGame.sendReaction(stampId)
    stampSheetOpen.value = false
  }

  function openStampSheet() {
    if (!isOnline.value) {
      showToast('オンライン対戦のときだけ使えます')
      return
    }
    // Prefer stamps over full-screen chat on small screens
    mobileTab.value = null
    stampSheetOpen.value = true
  }

  function chatAvatarForPlayer(playerId: string) {
    const fromView = onlineGame.view?.players.find((p) => p.id === playerId)
    if (fromView) {
      const meta = avatarByIndex(fromView.avatarIndex)
      return {
        avatar: meta.emoji,
        avatarSrc: avatarSrc(meta.id),
        avatarId: meta.id,
      }
    }
    // Masked game seats carry avatarIndex during play (lobby players[] may lag)
    const fromSeat = onlineGame.view?.game?.seats.find((s) => s.id === playerId)
    if (fromSeat) {
      const meta = avatarByIndex(fromSeat.avatarIndex)
      return {
        avatar: meta.emoji,
        avatarSrc: avatarSrc(meta.id),
        avatarId: meta.id,
      }
    }
    const fromGame = room.value?.players.find((p) => p.id === playerId)
    if (fromGame) {
      return {
        avatar: fromGame.avatar,
        avatarSrc: fromGame.avatarSrc,
        avatarId: fromGame.avatarId,
      }
    }
    return { avatar: '👤' }
  }

  /**
   * Own character for stamp picker previews (same idea as lobby avatarDraft).
   * Prefer live game seat → lobby member → persisted client preference.
   */
  const selfStampAvatarId = computed(() => {
    const pid = onlineGame.playerId ?? onlineGame.view?.selfPlayerId
    const gameSelf =
      onlineGame.view?.game?.seats.find((s) => s.isSelf) ??
      onlineGame.view?.game?.seats.find((s) => s.id === pid)
    if (gameSelf) return avatarByIndex(gameSelf.avatarIndex).id
    const me = onlineGame.view?.players.find((p) => p.id === pid)
    if (me) return avatarByIndex(me.avatarIndex).id
    return avatarByIndex(onlineGame.avatarIndex).id
  })

  /** 特殊能力 / セイム / チェンジ impact banner */
  const extraFx = ref<ExtraFxState>(null)
  /** Wave-3 / D1: open / hard raise cut-in (NICE / BIG / WILD) */
  const bidFx = ref<BidFxState>(null)
  let prevBidForFx: number | null | undefined = undefined
  /** D1: stable event identity across remount / reconnect */
  const dramaDeduper = createDramaEventDeduper()
  /** Last bid that landed a cut-in this round (for seq identity) */
  let lastBidFxRound: number | null = null
  /**
   * D3: last successful bid landed with ≤ LAST_SECOND_MS on the active clock.
   * Client-only; frozen into coyote drama context at challenge.
   */
  const lastSecondBid = ref(false)
  /** Rolling sample of remaining ms per player (turn may advance in same WS tick as bid). */
  const lastKnownRemainingMs = new Map<string, number>()
  let clockSampleTimer: ReturnType<typeof setInterval> | null = null

  function sampleTurnClockRemaining() {
    const clock = onlineGame.view?.clock
    if (!clock?.currentTurnPlayerId || clock.turnStartedAt == null) return
    const rem = remainingForPlayer(
      clock,
      clock.currentTurnPlayerId,
      Date.now(),
    )
    lastKnownRemainingMs.set(clock.currentTurnPlayerId, rem.totalMs)
  }

  function stopClockSampling() {
    if (clockSampleTimer != null) {
      clearInterval(clockSampleTimer)
      clockSampleTimer = null
    }
  }

  function startClockSampling() {
    stopClockSampling()
    sampleTurnClockRemaining()
    clockSampleTimer = setInterval(sampleTurnClockRemaining, 200)
  }

  const roomCode = computed(() => onlineGame.roomCode)

  const roundBidCountForReveal = computed(
    () => gameView.value?.roundBidCount ?? 0,
  )

  const reveal = useChallengeReveal({
    pendingResult,
    useMock,
    isOnline,
    roomCode,
    router,
    mockResultCards: mockResult.cards,
    mockResultMeta: {
      challengerName: mockResult.challengerName,
      challengerAvatar: mockResult.challengerAvatar,
      challengerAvatarSrc: mockResult.challengerAvatarSrc,
      bidderName: mockResult.bidderName,
      bidderAvatar: mockResult.bidderAvatar,
      bidderAvatarSrc: mockResult.bidderAvatarSrc,
      bidValue: mockResult.bidValue,
    },
    roundBidCount: roundBidCountForReveal,
    lastSecondBid: computed(() => lastSecondBid.value),
    // Coyote sequence uses module-level deduper (survives GameView remount)
  } satisfies UseChallengeRevealOptions)

  function playExtraFx(payload: {
    kind: ExtraFxKind
    actorName?: string
    targetName?: string
    bidValue?: number | null
  }) {
    // Don't stack over coyote cut-in
    if (reveal.cutInVisible.value) return
    // Coyote / extra takes priority over bid cut-in
    bidFx.value = null
    extraFx.value = {
      key: `${Date.now()}-${payload.kind}`,
      ...payload,
    }
    // D2: special-ability sting (public FX only)
    playSfx('extra')
  }

  function onExtraFxDone() {
    extraFx.value = null
  }

  function playBidFx(payload: {
    intensity: RaiseIntensity
    tier: RaiseTier
    doubleRaise: boolean
    bidValue: number
    delta: number | null
    actorName?: string
    title: string
    eventId: string
  }) {
    if (!shouldShowBidCutIn(payload.intensity)) return
    // Don't stack over coyote / extra / result reveal
    if (reveal.cutInVisible.value) return
    if (extraFx.value) return
    if (pendingResult.value) return
    if (reveal.coyoteBanner.value) return
    if (!dramaDeduper.tryConsume(payload.eventId)) return
    bidFx.value = {
      key: payload.eventId,
      intensity: payload.intensity,
      tier: payload.tier,
      doubleRaise: payload.doubleRaise,
      bidValue: payload.bidValue,
      delta: payload.delta,
      actorName: payload.actorName ?? '',
      title: payload.title,
    }
  }

  function onBidFxDone() {
    bidFx.value = null
  }

  function findLastBidderName(bid: number): string {
    const gv = gameView.value
    if (!gv) return ''
    // Prefer server lastBidderId when present
    if (gv.lastBidderId) {
      const byId = gv.players.find((p) => p.id === gv.lastBidderId)
      if (byId) return byId.name
    }
    const match = gv.players.find((p) => p.bid === bid && p.hasDeclared)
    return match?.name ?? ''
  }

  /** Table HEAT / RALLY from public roundBidCount (local + online). */
  const tableDrama = computed((): TableDramaState => {
    const gv = gameView.value
    const bidCount = gv?.roundBidCount ?? 0
    const heat = heatLevel(bidCount)
    return {
      bidCount,
      heat,
      heatLabel: heatStageLabel(heat),
      rally: bidCount,
      showRally: shouldShowRally(bidCount),
      lastBidderId: gv?.lastBidderId ?? null,
      currentTurnPlayerId: gv?.currentTurnPlayerId ?? null,
    }
  })

  function resolveTargetName(targetId?: string): string | undefined {
    if (!targetId) return undefined
    return gameView.value?.players.find((p) => p.id === targetId)?.name
  }

  function skillLabel(extra?: ClientBidExtra): string {
    if (!extra) return ''
    if (extra.type === 'reverse') return 'リバース'
    if (extra.type === 'shot') return 'ショット'
    if (extra.type === 'draw1') return 'ドロー'
    if (extra.type === 'life_double') return 'ダブル'
    return ''
  }

  const room = computed<GameRoomMock | null>(() => {
    if (useMock.value) return mockGameRoom
    return gameView.value
  })

  const busy = computed(
    () => !useMock.value && (botsRunning.value || acting.value || awaitingResultView.value),
  )

  const canDeclare = computed(() => {
    if (useMock.value) return true
    if (busy.value || isGameOver.value) return false
    return gameView.value?.canDeclare ?? false
  })

  const canChallenge = computed(() => {
    if (useMock.value) return true
    if (busy.value || isGameOver.value) return false
    return gameView.value?.canChallenge ?? false
  })

  const canSame = computed(() => {
    if (useMock.value) return false
    if (busy.value || isGameOver.value) return false
    return gameView.value?.canSame ?? false
  })

  const canChange = computed(() => {
    if (useMock.value) return false
    if (busy.value || isGameOver.value) return false
    return gameView.value?.canChange ?? false
  })

  const extrasAllowed = computed(() => {
    if (useMock.value) return false
    if (busy.value || isGameOver.value) return false
    return gameView.value?.extrasAllowed ?? false
  })

  const forbiddenBidValue = computed(
    () => gameView.value?.forbiddenBidValue ?? null,
  )

  const bidTargetOptions = computed(() => {
    const players = gameView.value?.players ?? []
    return players
      .filter((p) => !p.isSelf && p.lives > 0)
      .map((p) => ({ id: p.id, name: p.name }))
  })

  const minBid = computed(() => {
    if (useMock.value) return mockGameRoom.draftBid
    return gameView.value?.minBid ?? 1
  })

  const isGameOver = computed(() => {
    if (useMock.value) return false
    if (isOnline.value) return onlineGame.isGameOver
    return gameView.value?.isGameOver ?? false
  })

  /**
   * Game ended without a challenge result (leave / disconnect forfeit / sole survivor).
   * Not the coyote card-reveal path — no ResultView.
   */
  const showForfeitEnd = computed(
    () => isGameOver.value && !awaitingResultView.value,
  )

  const forfeitWinner = computed(() => {
    const id = gameView.value?.winnerId
    if (!id || !room.value) return null
    const p = room.value.players.find((x) => x.id === id)
    if (!p) return null
    return { id: p.id, name: p.name, isSelf: p.isSelf }
  })

  const forfeitEndTitle = computed(() => {
    const w = forfeitWinner.value
    if (w?.isSelf) return 'あなたの勝利'
    if (w) return `${w.name} の勝利`
    return 'ゲーム終了'
  })

  const forfeitEndDetail = computed(() => {
    const w = forfeitWinner.value
    if (w?.isSelf) {
      return 'ほかの人が退出・切断したため、あなたが生き残りました'
    }
    if (w) {
      return '退出や切断で対戦が終わりました（コヨーテ結果の画面はありません）'
    }
    return '退出や切断で対戦が終わりました'
  })

  const waitingForResultPeers = computed(() => {
    if (useMock.value || awaitingResultView.value) return false
    // After dismiss: engine stays at round_end until all connected peers close result
    return gameView.value?.phase === 'round_end'
  })

  /**
   * Status strip under the game header.
   * Natural Japanese: whose turn / how soon you act — not machine-like counters.
   */
  const paceHint = computed(() => {
    if (useMock.value) return null
    if (showForfeitEnd.value) {
      return forfeitEndTitle.value
    }
    if (awaitingResultView.value) {
      if (reveal.cutInVisible.value)
        return statusMessage.value ?? 'コヨーテの判定中です'
      if (!reveal.cardsRevealDone.value) return 'コヨーテの判定中です'
      return '合計と勝敗を確認しましょう'
    }
    if (waitingForResultPeers.value) {
      return 'ほかの人が結果を見終わるまでお待ちください'
    }
    // Transient events (coyote shout, bot "考え中") win over the steady turn line
    if (statusMessage.value) return statusMessage.value
    if (botsRunning.value) return 'ボットが考えています…'

    const turnPlayer = room.value?.players.find(
      (p) => p.isCurrentTurn && p.lives > 0,
    )
    if (gameView.value?.isSelfTurn || turnPlayer?.isSelf) {
      return 'あなたの手番です'
    }
    if (turnPlayer) {
      const n = gameView.value?.turnsUntilSelf
      if (n != null && n > 1) {
        return `あと${n}人であなたの手番です`
      }
      if (n === 1) {
        return '次はあなたの手番です'
      }
      return `${turnPlayer.name}の宣言を待っています`
    }
    return null
  })
  /** Live turn clock from server (online timed rooms only). */
  const turnClock = computed(() =>
    isOnline.value ? (onlineGame.view?.clock ?? null) : null,
  )

  watch(
    minBid,
    (v) => {
      if (draftBid.value < v) draftBid.value = v
    },
    { immediate: true },
  )

  watch(
    () => gameView.value?.draftBid,
    (v) => {
      if (v != null && !useMock.value) draftBid.value = v
    },
  )

  onMounted(() => {
    void bootstrap()
  })

  onUnmounted(() => {
    stopClockSampling()
  })

  async function bootstrap() {
    // Production: reject UI mock query
    if (!allowUiMock && route.query.mock === '1') {
      void router.replace({ name: 'home' })
      return
    }
    if (useMock.value) {
      draftBid.value = mockGameRoom.draftBid
      return
    }
    // Online: server is source of truth — do not start local bots
    if (isOnline.value || route.query.online === '1') {
      const qCode =
        typeof route.query.code === 'string' ? route.query.code : undefined
      if (onlineGame.connection !== 'open' || !onlineGame.view) {
        await onlineGame.ensureSession({ code: qCode })
      }
      // Mid-game reload while still in lobby phase → send to lobby
      if (
        onlineGame.view &&
        onlineGame.view.phase === 'lobby' &&
        onlineGame.view.status === 'open'
      ) {
        const code = onlineGame.roomCode ?? qCode
        void router.replace({
          name: 'lobby',
          query: { online: '1', ...(code ? { code } : {}) },
        })
        return
      }
      if (gameView.value) draftBid.value = gameView.value.draftBid
      return
    }
    // Production: no offline / local game surface
    if (!allowLocalPlay) {
      void router.replace({ name: 'home' })
      return
    }
    // Challenge already pending — stay here for cut-in / card reveal
    if (pendingResult.value) {
      if (gameView.value) draftBid.value = gameView.value.draftBid
      return
    }
    if (!hasSession.value) {
      await store.startLocalGame()
    } else {
      await store.resumeAfterResult()
    }
    if (gameView.value) {
      draftBid.value = gameView.value.draftBid
    }
  }

  watch(
    () => onlineGame.lastError,
    (msg) => {
      if (msg && isOnline.value) showToast(msg)
    },
  )

  // Online: server event.fx → impact banner (all clients including actor)
  watch(
    () => onlineGame.lastActionFx,
    (fx) => {
      if (!isOnline.value || !fx) return
      playExtraFx({
        kind: fx.kind,
        actorName: fx.actorName,
        targetName: fx.targetName,
        bidValue: fx.bidValue ?? null,
      })
    },
  )

  // D1: open / hard raise → BidDeclareCutIn via classifyRaise + identity dedupe
  // D3: track LAST SECOND when a bid lands with ≤1s on the turn clock
  watch(
    () =>
      [
        room.value?.currentBid,
        room.value?.round,
        gameView.value?.roundBidCount,
        gameView.value?.lastBidderId,
      ] as const,
    ([next, round, bidCount, lastBidderId]) => {
      if (prevBidForFx === undefined) {
        prevBidForFx = next ?? null
        lastBidFxRound = round ?? null
        return
      }
      // New round: reset previous anchor without firing cut-in
      if (round != null && lastBidFxRound != null && round !== lastBidFxRound) {
        prevBidForFx = next ?? null
        lastBidFxRound = round
        lastSecondBid.value = false
        // Allow cut-in ids for the new round (keep old ids so remount mid-round is safe)
        return
      }
      lastBidFxRound = round ?? lastBidFxRound
      const prev = prevBidForFx
      prevBidForFx = next ?? null
      if (next == null || next === prev) return
      if (typeof next !== 'number') return

      // LAST SECOND: use last sampled remaining for the bidder (turn may already advance)
      const actorId =
        typeof lastBidderId === 'string' && lastBidderId
          ? lastBidderId
          : onlineGame.view?.clock?.currentTurnPlayerId
      if (actorId && lastKnownRemainingMs.has(actorId)) {
        const ms = lastKnownRemainingMs.get(actorId)!
        lastSecondBid.value = ms > 0 && ms <= LAST_SECOND_MS
      } else {
        // Fallback: sample active turn now (best-effort if actor still current)
        sampleTurnClockRemaining()
        const clock = onlineGame.view?.clock
        if (clock?.currentTurnPlayerId) {
          const rem = remainingForPlayer(
            clock,
            clock.currentTurnPlayerId,
            Date.now(),
          )
          lastSecondBid.value =
            rem.totalMs > 0 && rem.totalMs <= LAST_SECOND_MS
        } else {
          lastSecondBid.value = false
        }
      }

      const previous = typeof prev === 'number' ? prev : null
      const raise: RaiseClassification = classifyRaise(previous, next)
      const intensity = raiseIntensityFromTier(raise)
      if (!shouldShowBidCutIn(intensity)) return
      const seq =
        typeof bidCount === 'number' && bidCount > 0
          ? bidCount
          : Math.max(1, (typeof previous === 'number' ? 2 : 1))
      const r = round ?? 0
      const eventId = raiseCutInEventId({
        round: r,
        seq,
        value: next,
        tier: raise.tier,
      })
      const title = raiseCutInTitle(raise)
      playBidFx({
        intensity,
        tier: raise.tier,
        doubleRaise: raise.doubleRaise,
        bidValue: next,
        delta: raise.delta,
        actorName: findLastBidderName(next),
        title,
        eventId,
      })
      void lastBidderId
    },
  )

  // Clear drama dedupe when switching rooms (leave / rematch lobby / new match)
  watch(
    () => room.value?.roomCode ?? null,
    (code, prevCode) => {
      if (code === prevCode) return
      resetCoyoteDramaSession()
      lastSecondBid.value = false
      lastKnownRemainingMs.clear()
      dramaDeduper.clear()
      prevBidForFx = undefined
      lastBidFxRound = null
    },
  )

  // D3: sample turn remaining while an online timed clock is live
  watch(
    () =>
      [
        isOnline.value,
        onlineGame.view?.clock?.currentTurnPlayerId ?? null,
        onlineGame.view?.clock?.turnStartedAt ?? null,
        pendingResult.value != null,
      ] as const,
    ([online, turnPlayer, startedAt, inResult]) => {
      if (online && turnPlayer && startedAt != null && !inResult) {
        startClockSampling()
      } else {
        stopClockSampling()
      }
    },
    { immediate: true },
  )

  // Drop bid cut-in immediately when coyote starts
  watch(
    () => reveal.cutInVisible.value,
    (vis) => {
      if (vis) bidFx.value = null
    },
  )

  /** Round-start slam: fire when round increases (skip mid-challenge / coyote UI) */
  watch(
    () => room.value?.round,
    (round) => {
      if (round == null || !Number.isFinite(round)) return
      // Don't stack over coyote cut-in / card reveal
      if (pendingResult.value || reveal.cutInVisible.value || reveal.coyoteBanner.value) {
        prevRoundForBanner = round
        return
      }
      if (prevRoundForBanner == null) {
        prevRoundForBanner = round
        // Opening splash for the current round once table is live
        if (!awaitingResultView.value) {
          roundBannerNum.value = round
          roundBannerVisible.value = true
        }
        return
      }
      if (round > prevRoundForBanner) {
        roundBannerNum.value = round
        roundBannerVisible.value = true
      }
      prevRoundForBanner = round
    },
  )

  function onRoundBannerDone() {
    roundBannerVisible.value = false
  }

  const showTurnEdge = computed(
    () =>
      !!gameView.value?.isSelfTurn &&
      !awaitingResultView.value &&
      !botsRunning.value &&
      !reveal.cutInVisible.value &&
      !reveal.coyoteBanner.value &&
      !roundBannerVisible.value &&
      !bidFx.value,
  )

  // D2: own-turn notice (once per turn identity; no backlog on tab return)
  watch(
    () =>
      [
        gameView.value?.isSelfTurn,
        gameView.value?.round,
        gameView.value?.currentTurnPlayerId,
        gameView.value?.roundBidCount,
        gameView.value?.currentBid,
        turnClock.value?.turnStartedAt,
        awaitingResultView.value,
        pendingResult.value != null,
      ] as const,
    ([
      isSelf,
      round,
      playerId,
      bidCount,
      currentBid,
      turnStartedAt,
      awaiting,
      hasPending,
    ]) => {
      if (!isSelf || awaiting || hasPending) return
      if (reveal.cutInVisible.value || reveal.coyoteBanner.value) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      const pid = playerId ?? 'self'
      const r = round ?? 0
      // Prefer server clock anchor; else public bid progress so re-turns re-fire
      const turnKey =
        typeof turnStartedAt === 'number' && Number.isFinite(turnStartedAt)
          ? turnStartedAt
          : `b${bidCount ?? 0}:c${currentBid ?? 'x'}`
      const eventId = turnStartEventId({
        round: r,
        playerId: pid,
        turnKey,
      })
      if (!dramaDeduper.tryConsume(eventId)) return
      // Noticeable “your turn” chime (unlocked path; policy respects mute/volume)
      playSfx('turn_self', { gain: 1 })
      // D4: short pulse on own turn only (public turn state)
      playHaptic('turn_self')
    },
  )

  // Only the player who pressed rematch auto-navigates (peers use banner)
  watch(
    () => onlineGame.rematchNavigateToken,
    (token, prev) => {
      if (!isOnline.value) return
      if (token === 0 || token === prev) return
      const code = onlineGame.roomCode
      void router.replace({
        name: 'lobby',
        query: { online: '1', ...(code ? { code } : {}) },
      })
    },
  )

  async function manualReconnect() {
    try {
      await onlineGame.reconnect()
      showToast('再接続しました')
      if (gameView.value) draftBid.value = gameView.value.draftBid
    } catch (e) {
      showToast(e instanceof Error ? e.message : '再接続に失敗しました')
    }
  }

  /** Confirm before ending the session (forfeit online / drop local / host dissolve). */
  const leaveConfirmOpen = ref(false)

  const canHostEndRoom = computed(
    () => isOnline.value && onlineGame.isHost,
  )

  function requestLeaveGame() {
    leaveConfirmOpen.value = true
  }

  function cancelLeaveGame() {
    leaveConfirmOpen.value = false
  }

  function confirmLeaveGame() {
    leaveConfirmOpen.value = false
    if (isOnline.value) {
      onlineGame.leave()
    } else if (!useMock.value) {
      store.resetSession()
    }
    void router.push({ name: 'home' })
  }

  /** Host: dissolve room for everyone (server room_closed → all clients home). */
  function confirmEndRoom() {
    leaveConfirmOpen.value = false
    if (!isOnline.value || !onlineGame.isHost) return
    onlineGame.endRoom()
    void router.push({ name: 'home' })
  }

  /** After forfeit / disconnect win — rematch (online) or local restart. */
  async function playAgainFromForfeit() {
    if (useMock.value) return
    if (isOnline.value) {
      onlineGame.requestRematch()
      return
    }
    await store.restartLastGame()
    draftBid.value = gameView.value?.draftBid ?? minBid.value
  }

  function goToLobbyAfterRematch() {
    if (!isOnline.value) return
    onlineGame.acceptLobbyReturn()
    const code = onlineGame.roomCode
    void router.replace({
      name: 'lobby',
      query: { online: '1', ...(code ? { code } : {}) },
    })
  }

  // Server dissolved room (host end / idle purge) while still on game screen
  watch(
    () => onlineGame.lastErrorCode,
    (code) => {
      if (code === 'ROOM_CLOSED') {
        leaveConfirmOpen.value = false
        void router.replace({ name: 'home' })
      }
    },
  )

  const showOnlineDisconnect = computed(
    () =>
      isOnline.value &&
      !onlineGame.isRoomClosed &&
      (onlineGame.connection === 'closed' ||
        onlineGame.connection === 'error' ||
        onlineGame.reconnecting),
  )

  async function onDeclare(value: number, extra?: ClientBidExtra) {
    if (useMock.value) {
      const skill = skillLabel(extra)
      showToast(skill ? `（モック）宣言: ${value} + ${skill}` : `（モック）宣言: ${value}`)
      if (extra) {
        playExtraFx({
          kind: extra.type,
          actorName: 'あなた',
          targetName:
            extra.type === 'shot' || extra.type === 'draw1'
              ? resolveTargetName(extra.targetId)
              : undefined,
          bidValue: value,
        })
      }
      return
    }
    if (isGameOver.value) {
      showToast('ゲームは終了しています')
      return
    }
    if (busy.value) return
    acting.value = true
    try {
      if (isOnline.value) {
        onlineGame.placeBid(value, extra)
        // Server event drives FX for all clients; local optimistic only if no WS event
      } else {
        await store.placeBid(value, extra)
        if (gameView.value) draftBid.value = gameView.value.draftBid
        if (extra) {
          playExtraFx({
            kind: extra.type,
            actorName: 'あなた',
            targetName:
              extra.type === 'shot' || extra.type === 'draw1'
                ? resolveTargetName(extra.targetId)
                : undefined,
            bidValue: value,
          })
        }
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '宣言に失敗しました')
    } finally {
      acting.value = false
    }
  }

  async function onSame() {
    if (useMock.value) {
      showToast('（モック）セイム')
      playExtraFx({
        kind: 'same',
        actorName: 'あなた',
        bidValue: gameView.value?.currentBid ?? draftBid.value,
      })
      return
    }
    if (isGameOver.value || busy.value) return
    acting.value = true
    try {
      const bidSnap = gameView.value?.currentBid ?? null
      if (isOnline.value) {
        onlineGame.playSame()
      } else {
        await store.playSame()
        if (gameView.value) draftBid.value = gameView.value.draftBid
        playExtraFx({ kind: 'same', actorName: 'あなた', bidValue: bidSnap })
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'セイムに失敗しました')
    } finally {
      acting.value = false
    }
  }

  async function onChange() {
    if (useMock.value) {
      showToast('（モック）チェンジ')
      playExtraFx({ kind: 'change', actorName: 'あなた' })
      return
    }
    if (isGameOver.value || busy.value) return
    acting.value = true
    try {
      if (isOnline.value) {
        onlineGame.playChange()
      } else {
        await store.playChange()
        if (gameView.value) draftBid.value = gameView.value.draftBid
        playExtraFx({ kind: 'change', actorName: 'あなた' })
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'チェンジに失敗しました')
    } finally {
      acting.value = false
    }
  }

  async function onChallenge() {
    if (useMock.value) {
      // Preview: cut-in → card flip → 結果を見る
      reveal.startMockChallenge({
        challengerName: mockResult.challengerName,
        challengerAvatar: mockResult.challengerAvatar,
        challengerAvatarSrc: mockResult.challengerAvatarSrc,
        bidderName: mockResult.bidderName,
        bidValue: mockResult.bidValue,
      })
      return
    }
    if (isGameOver.value) {
      showToast('ゲームは終了しています')
      return
    }
    if (busy.value) return
    acting.value = true
    try {
      if (isOnline.value) {
        onlineGame.challenge()
      } else {
        await store.challenge()
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'チャレンジに失敗しました')
    } finally {
      acting.value = false
    }
  }

  // reactive() so template `s.foo` auto-unwraps nested refs / computeds
  return reactive({
    // stores (for template fields still needed)
    onlineGame,
    allowUiMock,

    // mode
    useMock,
    isOnline,
    gameView,
    pendingResult,
    awaitingResultView,
    botsRunning,
    statusMessage,
    room,
    busy,
    isGameOver,

    // UI chrome
    toast,
    showToast,
    dismissToast,
    helpOpen,
    deckInfoOpen,
    openHelp,
    openDeckInfo,
    roomDeck,
    mobileTab,
    stampSheetOpen,
    desktopSideTab,
    draftBid,
    acting,

    // chat / stamps
    toggleMobileChat,
    toggleMobileLog,
    closeMobileDrawer,
    onSendChat,
    onSendReaction,
    openStampSheet,
    chatAvatarForPlayer,
    selfStampAvatarId,

    // bid flags
    canDeclare,
    canChallenge,
    canSame,
    canChange,
    extrasAllowed,
    forbiddenBidValue,
    bidTargetOptions,
    minBid,

    // forfeit / peers / pace
    showForfeitEnd,
    forfeitEndTitle,
    forfeitEndDetail,
    waitingForResultPeers,
    paceHint,
    turnClock,

    // disconnect / leave
    showOnlineDisconnect,
    manualReconnect,
    leaveConfirmOpen,
    canHostEndRoom,
    requestLeaveGame,
    cancelLeaveGame,
    confirmLeaveGame,
    confirmEndRoom,
    playAgainFromForfeit,
    goToLobbyAfterRematch,

    // actions
    onDeclare,
    onSame,
    onChange,
    onChallenge,

    // FX / banners
    extraFx,
    onExtraFxDone,
    bidFx,
    onBidFxDone,
    tableDrama,
    roundBannerVisible,
    roundBannerNum,
    onRoundBannerDone,
    showTurnEdge,

    // challenge reveal
    reveal,
    cutInVisible: reveal.cutInVisible,
    cutInPayload: reveal.cutInPayload,
    coyoteBanner: reveal.coyoteBanner,
    revealCards: reveal.revealCards,
    revealedCount: reveal.revealedCount,
    cardsRevealDone: reveal.cardsRevealDone,
    skipCardReveal: reveal.skipCardReveal,
    onCutInDone: reveal.onCutInDone,
    openResult: reveal.openResult,
  })
}

/** Convenience type for layout prop typing */
export type GameSession = ReturnType<typeof useGameSession>
