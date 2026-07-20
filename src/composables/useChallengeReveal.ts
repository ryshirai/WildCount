import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import type { ResultViewModel } from '@/mappers/toResultView'
import type { RevealedCard } from '@/types/game'
import {
  cardRevealStaggerMs,
  classifyMargin,
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
}

/**
 * Post-challenge UI FSM: coyote cut-in → staggered card reveal → ResultView.
 * Behavior preserved from GameView (R3 structural extract).
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
  } = options

  const cutInVisible = ref(false)
  const cutInPlayed = ref(false)
  /** How many challenge cards have flipped open on the game screen */
  const revealedCount = ref(0)
  const cardsRevealDone = ref(false)

  const mockCutIn = ref<MockCutInPayload | null>(null)
  const mockRevealCards = ref<RevealedCard[] | null>(null)

  let cardTimers: ReturnType<typeof setTimeout>[] = []

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

  const coyoteBanner = computed<CoyoteBanner | null>(() => {
    // Live challenge after cut-in, or mock card-reveal preview
    if (cutInVisible.value) return null
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

  function resetPostChallengeUi() {
    clearCardTimers()
    cutInVisible.value = false
    cutInPlayed.value = false
    revealedCount.value = 0
    cardsRevealDone.value = false
    mockRevealCards.value = null
    mockCutIn.value = null
  }

  /** Fire cut-in only for a new challenge identity (not peer view broadcasts) */
  watch(
    () => {
      const r = pendingResult.value
      if (!r) return null
      return `${r.round}:${r.bidValue}:${r.challengerName}:${r.finalTotal}`
    },
    (key, prevKey) => {
      if (key && key !== prevKey) {
        cutInVisible.value = true
        cutInPlayed.value = true
        revealedCount.value = 0
        cardsRevealDone.value = false
      }
      if (!key) {
        resetPostChallengeUi()
      }
    },
    { immediate: true },
  )

  function onCutInDone() {
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
   * Uses mockResultCards when provided.
   */
  function startMockChallenge(payload: MockCutInPayload) {
    mockRevealCards.value = mockResultCards ? [...mockResultCards] : []
    revealedCount.value = 0
    cardsRevealDone.value = false
    mockCutIn.value = payload
  }

  onUnmounted(() => {
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
  }
}
