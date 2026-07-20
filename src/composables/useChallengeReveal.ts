import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { playSfx, silenceSfx } from '@/audio'
import { playHaptic } from '@/haptics'
import type { ResultViewModel } from '@/mappers/toResultView'
import type { RevealedCard } from '@/types/game'
import { coyoteCutInEventId } from '@/utils/bidDrama'
import {
  coyoteChallengeKey,
  freezeCoyoteDramaContext,
  getCoyoteSequenceDeduper,
  markCoyoteSequencePlayed,
} from '@/utils/coyoteDramaContext'
import {
  cardRevealStaggerMs,
  classifyMargin,
  COYOTE_SILENCE_MS,
} from '@/utils/resultDrama'

const CARD_STAGGER_MS_DEFAULT = 100
const CARD_START_MS = 120
/** Extra delay before flipping the local player's card (Indian poker beat). */
const SELF_CARD_EXTRA_MS = 80

export interface CoyoteBanner {
  challengerName: string
  challengerAvatar: string
  challengerAvatarSrc?: string
  bidderName: string
  bidderAvatar: string
  bidderAvatarSrc?: string
  bid: number
  isMock: boolean
}

export interface MockCutInPayload {
  challengerName: string
  challengerAvatar: string
  challengerAvatarSrc?: string
  bidderName: string
  bidValue: number
}

export interface UseChallengeRevealOptions {
  pendingResult: ComputedRef<ResultViewModel | null>
  useMock: ComputedRef<boolean>
  isOnline: ComputedRef<boolean>
  roomCode: ComputedRef<string | null>
  router: Router
  /** Mock result cards + banner (DEV only path) */
  mockResultCards?: readonly RevealedCard[]
  mockResultMeta?: {
    challengerName: string
    challengerAvatar: string
    challengerAvatarSrc?: string
    bidderName: string
    bidderAvatar: string
    bidderAvatarSrc?: string
    bidValue: number
  }
  /**
   * Public consecutive bids when COYOTE fires (HEAT freeze).
   * Prefer live gameView.roundBidCount.
   */
  roundBidCount?: ComputedRef<number>
  /** Client flag: last bid landed with ≤1s remaining. */
  lastSecondBid?: ComputedRef<boolean>
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function isTabHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

/**
 * Post-challenge UI FSM (D3): silence → coyote cut-in → staggered cards → Result.
 * Same challenge identity plays once (dedupe); skip / hidden / remount converge.
 */
export function useChallengeReveal(options: UseChallengeRevealOptions) {
  const {
    pendingResult,
    useMock,
    isOnline,
    roomCode,
    router,
    mockResultCards,
    mockResultMeta,
    roundBidCount,
    lastSecondBid,
  } = options

  /** Module-level: survives GameView remount / reconnect within session */
  const deduper = getCoyoteSequenceDeduper()

  const cutInVisible = ref(false)
  const cutInPlayed = ref(false)
  /** How many challenge cards have flipped open on the game screen */
  const revealedCount = ref(0)
  const cardsRevealDone = ref(false)

  const mockCutIn = ref<MockCutInPayload | null>(null)
  const mockRevealCards = ref<RevealedCard[] | null>(null)

  let cardTimers: ReturnType<typeof setTimeout>[] = []
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  const cutInPayload = computed(() => {
    if (mockCutIn.value) return mockCutIn.value
    const r = pendingResult.value
    if (!r || !cutInVisible.value) return null
    return {
      challengerName: r.challengerName,
      challengerAvatar: r.challengerAvatar,
      challengerAvatarSrc: r.challengerAvatarSrc,
      bidderName: r.bidderName,
      bidValue: r.bidValue,
    }
  })

  /** Cards to flip on the game screen (live challenge or mock preview) */
  const revealCards = computed<RevealedCard[]>(() => {
    if (mockRevealCards.value) return mockRevealCards.value
    return pendingResult.value?.cards ?? []
  })

  /**
   * Banner + reveal panel stay mounted for the whole challenge sequence,
   * including under CoyoteCutIn. Returning null while cutInVisible used to
   * flip the layout back to the live table (hands already cleared → empty
   * board flash behind the cut-in).
   */
  const coyoteBanner = computed<CoyoteBanner | null>(() => {
    // Mock card-reveal preview (DEV)
    if (mockRevealCards.value && mockResultMeta) {
      const m = mockResultMeta
      return {
        challengerName: m.challengerName,
        challengerAvatar: m.challengerAvatar,
        challengerAvatarSrc: m.challengerAvatarSrc,
        bidderName: m.bidderName,
        bidderAvatar: m.bidderAvatar,
        bidderAvatarSrc: m.bidderAvatarSrc,
        bid: m.bidValue,
        isMock: true as const,
      }
    }
    if (useMock.value || !pendingResult.value) return null
    const r = pendingResult.value
    return {
      challengerName: r.challengerName,
      challengerAvatar: r.challengerAvatar,
      challengerAvatarSrc: r.challengerAvatarSrc,
      bidderName: r.bidderName,
      bidderAvatar: r.bidderAvatar,
      bidderAvatarSrc: r.bidderAvatarSrc,
      bid: r.bidValue,
      isMock: false as const,
    }
  })

  function clearSilenceTimer() {
    if (silenceTimer != null) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  function clearCardTimers() {
    for (const t of cardTimers) clearTimeout(t)
    cardTimers = []
  }

  function staggerForPending(): number {
    const r = pendingResult.value
    if (!r) return CARD_STAGGER_MS_DEFAULT
    return cardRevealStaggerMs(classifyMargin(r.finalTotal, r.bidValue))
  }

  /**
   * Reveal order: non-self first (seat order), then self last for the
   * forehead-card payoff. `revealedCount` still means "first N in revealCards
   * array order" for the panel — so we keep array order but delay self index.
   */
  function startCardReveal(cards: readonly RevealedCard[]) {
    clearCardTimers()
    revealedCount.value = 0
    cardsRevealDone.value = false
    const n = cards.length
    if (n === 0) {
      cardsRevealDone.value = true
      return
    }
    // Reduced motion / hidden: jump to final flips
    if (prefersReducedMotion() || isTabHidden()) {
      revealedCount.value = n
      cardsRevealDone.value = true
      return
    }
    const stagger = staggerForPending()
    // Cumulative delays: self cards get a short extra beat (forehead payoff).
    let elapsed = CARD_START_MS
    for (let i = 0; i < n; i++) {
      const card = cards[i]!
      if (card.isSelf) elapsed += SELF_CARD_EXTRA_MS
      const at = elapsed
      elapsed += stagger
      const idx = i + 1
      const t = setTimeout(() => {
        // Panel uses i < revealedCount — keep index order
        if (revealedCount.value < idx) {
          revealedCount.value = idx
        }
        if (idx >= n) cardsRevealDone.value = true
      }, at)
      cardTimers.push(t)
    }
  }

  function skipCardReveal() {
    clearCardTimers()
    revealedCount.value = revealCards.value.length
    cardsRevealDone.value = true
  }

  /** Safe final table state (reconnect / remount / already-played sequence). */
  function snapToCardsRevealed() {
    clearSilenceTimer()
    clearCardTimers()
    cutInVisible.value = false
    cutInPlayed.value = true
    mockCutIn.value = null
    revealedCount.value = revealCards.value.length
    cardsRevealDone.value = true
  }

  function resetPostChallengeUi() {
    clearSilenceTimer()
    clearCardTimers()
    cutInVisible.value = false
    cutInPlayed.value = false
    revealedCount.value = 0
    cardsRevealDone.value = false
    mockRevealCards.value = null
    mockCutIn.value = null
  }

  function freezeFromPending(r: ResultViewModel) {
    const key = coyoteChallengeKey({
      round: r.round,
      bidValue: r.bidValue,
      challengerName: r.challengerName,
      finalTotal: r.finalTotal,
    })
    freezeCoyoteDramaContext({
      challengeKey: key,
      round: r.round,
      bidValue: r.bidValue,
      finalTotal: r.finalTotal,
      roundBidCount: roundBidCount?.value ?? 0,
      lastSecondBid: lastSecondBid?.value === true,
    })
    return key
  }

  function showCutInAndPlaySfx() {
    cutInVisible.value = true
    if (!isTabHidden()) {
      playSfx('coyote')
      // D4: strong-gap-strong on COYOTE cut-in
      playHaptic('coyote')
    }
  }

  /**
   * Start silence → cut-in for a new challenge identity.
   * Returns false if this identity was already consumed (caller should snap).
   */
  function beginCoyoteSequence(opts: {
    eventId: string
    challengeKey: string
  }): boolean {
    if (!deduper.tryConsume(opts.eventId)) {
      markCoyoteSequencePlayed(opts.challengeKey)
      return false
    }
    markCoyoteSequencePlayed(opts.challengeKey)
    cutInPlayed.value = true
    revealedCount.value = 0
    cardsRevealDone.value = false

    // Tab hidden: no cut-in animation; converge to cards done
    if (isTabHidden()) {
      cutInVisible.value = false
      skipCardReveal()
      return true
    }

    // Reduced motion: skip silence delay, still show short cut-in
    if (prefersReducedMotion()) {
      silenceSfx(0)
      showCutInAndPlaySfx()
      return true
    }

    // Plan §4.7: stop lower layers ~250ms then CoyoteCutIn
    silenceSfx(COYOTE_SILENCE_MS)
    clearSilenceTimer()
    silenceTimer = setTimeout(() => {
      silenceTimer = null
      showCutInAndPlaySfx()
    }, COYOTE_SILENCE_MS)
    return true
  }

  /** Fire cut-in only for a new challenge identity (not peer view broadcasts) */
  watch(
    () => {
      const r = pendingResult.value
      if (!r) return null
      return coyoteChallengeKey({
        round: r.round,
        bidValue: r.bidValue,
        challengerName: r.challengerName,
        finalTotal: r.finalTotal,
      })
    },
    (key, prevKey) => {
      if (key && key !== prevKey) {
        const r = pendingResult.value
        if (!r) return
        freezeFromPending(r)
        const eventId = coyoteCutInEventId({
          round: r.round,
          bidValue: r.bidValue,
          challengerId: r.challengerName,
        })
        const started = beginCoyoteSequence({ eventId, challengeKey: key })
        if (!started) {
          // Already played this challenge (remount / reconnect)
          snapToCardsRevealed()
        }
      }
      if (!key) {
        resetPostChallengeUi()
      }
    },
    { immediate: true },
  )

  // D2: card flip ticks as reveal advances
  watch(revealedCount, (n, prev) => {
    if (typeof prev !== 'number' || n <= prev) return
    if (isTabHidden()) return
    playSfx('card_flip')
  })

  function onCutInDone() {
    clearSilenceTimer()
    cutInVisible.value = false
    mockCutIn.value = null
    // After impact: flip cards on the game table, then offer “結果を見る”
    if (pendingResult.value) {
      startCardReveal(pendingResult.value.cards)
    } else if (mockRevealCards.value) {
      startCardReveal(mockRevealCards.value)
    }
  }

  function openResult() {
    if (!cardsRevealDone.value) skipCardReveal()
    if (coyoteBanner.value?.isMock) {
      void router.push({ name: 'result', query: { mock: '1' } })
      return
    }
    const code = roomCode.value
    void router.push({
      name: 'result',
      query: isOnline.value
        ? { online: '1', ...(code ? { code } : {}) }
        : undefined,
    })
  }

  /**
   * DEV mock: start cut-in → card flip → 結果を見る without a real engine.
   * Uses mockResultCards when provided. Re-previews always allowed.
   */
  function startMockChallenge(payload: MockCutInPayload) {
    clearSilenceTimer()
    clearCardTimers()
    mockRevealCards.value = mockResultCards ? [...mockResultCards] : []
    revealedCount.value = 0
    cardsRevealDone.value = false
    cutInVisible.value = false
    cutInPlayed.value = true
    mockCutIn.value = payload

    const challengeKey = `mock:${payload.challengerName}:${payload.bidValue}`
    const eventId = coyoteCutInEventId({
      round: 0,
      bidValue: payload.bidValue,
      challengerId: `mock:${payload.challengerName}`,
    })
    freezeCoyoteDramaContext({
      challengeKey,
      round: 0,
      bidValue: payload.bidValue,
      finalTotal: 0,
      roundBidCount: roundBidCount?.value ?? 0,
      lastSecondBid: lastSecondBid?.value === true,
    })
    // Allow re-trigger from DEV mock button
    deduper.forget(eventId)
    deduper.tryConsume(eventId)
    markCoyoteSequencePlayed(challengeKey)

    if (isTabHidden()) {
      snapToCardsRevealed()
      return
    }
    if (prefersReducedMotion()) {
      silenceSfx(0)
      showCutInAndPlaySfx()
      return
    }
    silenceSfx(COYOTE_SILENCE_MS)
    silenceTimer = setTimeout(() => {
      silenceTimer = null
      showCutInAndPlaySfx()
    }, COYOTE_SILENCE_MS)
  }

  onUnmounted(() => {
    clearSilenceTimer()
    clearCardTimers()
  })

  return {
    cutInVisible: cutInVisible as Ref<boolean>,
    cutInPlayed: cutInPlayed as Ref<boolean>,
    revealedCount: revealedCount as Ref<number>,
    cardsRevealDone: cardsRevealDone as Ref<boolean>,
    mockCutIn,
    mockRevealCards,
    cutInPayload,
    revealCards,
    coyoteBanner,
    skipCardReveal,
    onCutInDone,
    openResult,
    startMockChallenge,
    resetPostChallengeUi,
    clearCardTimers,
    snapToCardsRevealed,
  }
}
