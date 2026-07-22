<script setup lang="ts">
/**
 * Result screen after Coyote challenge.
 * Hierarchy: verdict → bid vs total → life loss → cards → formula → actions.
 * Drama (D3 rare tags, confetti, once-only sequence) kept; calc steps are secondary.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { playSfx } from '@/audio'
import { playHaptic } from '@/haptics'
import { mockResult } from '@/data/mockResult'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'
import AppHeader from '@/components/common/AppHeader.vue'
import FxConfetti from '@/components/common/FxConfetti.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'
import RevealCardTile from '@/components/game/RevealCardTile.vue'
import { allowLocalPlay, allowUiMock } from '@/config/runtime'
import type { ResultMock } from '@/types/game'
import {
  coyoteChallengeKey,
  getCoyoteDramaContext,
  getCoyoteSequenceDeduper,
  markResultSequencePlayed,
} from '@/utils/coyoteDramaContext'
import {
  buildSimpleCalcSummary,
  cardRevealStaggerMs,
  classifyMargin,
  classifyRareTags,
  comparisonOperator,
  comparisonReasonFor,
  confettiDensityFor,
  isExtremeNumber,
  livesBeforeLoss,
  marginChipLabel,
  preSlamHoldMs,
  rareTagLabel,
  resultSequenceEventId,
  verdictTitleFor,
  type MarginTier,
  type RareTag,
} from '@/utils/resultDrama'

const router = useRouter()
const route = useRoute()
const store = useLocalGameStore()
const onlineGame = useOnlineGameStore()
const { resultView, isGameOver } = storeToRefs(store)

const useMock = computed(() => allowUiMock && route.query.mock === '1')
const isOnline = computed(
  () =>
    onlineGame.isOnlineSession ||
    route.query.online === '1' ||
    onlineGame.view != null,
)

const activeResult = computed(() =>
  isOnline.value ? onlineGame.pendingResult : resultView.value,
)

const result = computed<ResultMock | null>(() => {
  if (useMock.value) return mockResult
  return activeResult.value
})

const localMeta = computed(() => {
  if (useMock.value || !activeResult.value) {
    return { isGameOver: false, winnerName: null as string | null }
  }
  const r = activeResult.value
  return {
    isGameOver: r.isGameOver || (!isOnline.value && isGameOver.value),
    winnerName: r.winnerName,
  }
})

const marginTier = computed<MarginTier>(() => {
  if (!result.value) return 'clear'
  return classifyMargin(result.value.finalTotal, result.value.bidValue)
})

const dramaChip = computed(() => marginChipLabel(marginTier.value))

const lifeLossAmount = computed(() => {
  const n = result.value?.lifeLoss
  return typeof n === 'number' && n > 0 ? n : 1
})

const eliminated = computed(
  () =>
    result.value?.eliminated === true ||
    (typeof result.value?.livesAfter === 'number' &&
      result.value.livesAfter <= 0),
)

const selfIsLoser = computed(() => result.value?.selfIsLoser === true)

const livesAfter = computed(() => {
  const n = result.value?.livesAfter
  return typeof n === 'number' && Number.isFinite(n) ? n : null
})

const livesBefore = computed(() =>
  livesBeforeLoss(livesAfter.value, lifeLossAmount.value),
)

const rareTags = computed<RareTag[]>(() => {
  const r = result.value
  if (!r) return []
  const ctx = getCoyoteDramaContext()
  const key = coyoteChallengeKey({
    round: r.round,
    bidValue: r.bidValue,
    challengerName: r.challengerName,
    finalTotal: r.finalTotal,
  })
  const match = ctx && ctx.challengeKey === key
  return classifyRareTags({
    finalTotal: r.finalTotal,
    bidValue: r.bidValue,
    cards: r.cards,
    livesAfter: r.livesAfter,
    eliminated: eliminated.value,
    lastSecondBid: match ? ctx.lastSecondBid : false,
    roundBidCount: match
      ? ctx.roundBidCount
      : (isOnline.value ? onlineGame.gameView?.roundBidCount : undefined) ??
        null,
  })
})

const showJapaneseDramaChip = computed(() => {
  if (!dramaChip.value) return false
  if (rareTags.value.includes('perfect') || rareTags.value.includes('clutch')) {
    return false
  }
  return true
})

const hasWildReversal = computed(() => rareTags.value.includes('wild_reversal'))
const hasMaxHeat = computed(() => rareTags.value.includes('max_heat'))
const hasSurvived = computed(() => rareTags.value.includes('survived'))
const hasLastSecond = computed(() => rareTags.value.includes('last_second'))

const verdictTitle = computed(() => {
  if (!result.value) return ''
  return verdictTitleFor({
    tier: marginTier.value,
    bidderWins: result.value.bidderWins,
    isGameOver: localMeta.value.isGameOver,
  })
})

const compareOp = computed(() =>
  result.value ? comparisonOperator(result.value.bidderWins) : '>',
)

const comparisonReason = computed(() => {
  if (!result.value) return ''
  return comparisonReasonFor({
    bidderWins: result.value.bidderWins,
    finalTotal: result.value.finalTotal,
    bidValue: result.value.bidValue,
  })
})

const lifeLossReason = computed(() => {
  const r = result.value
  if (!r) return ''
  const who = selfIsLoser.value
    ? 'あなた'
    : r.lifeLostName || (r.bidderWins ? 'チャレンジャー' : '宣言者')
  if (eliminated.value) {
    return `${who}が脱落しました`
  }
  if (lifeLossAmount.value > 1) {
    return `${who}がライフを${lifeLossAmount.value}失います（ダブル）`
  }
  return `${who}がライフを1失います`
})

const calcSummary = computed(() => {
  if (!result.value) {
    return { terms: [] as string[], baseSum: null as number | null, specials: [] }
  }
  return buildSimpleCalcSummary(result.value.calcSteps)
})

/** Collapsed card list: specials / self / extreme / redraw first */
const CARD_COLLAPSE_AT = 6
const showAllCards = ref(false)
const showCalcDetails = ref(false)

const rankedCardIndexes = computed(() => {
  const r = result.value
  if (!r) return [] as number[]
  const scored = r.cards.map((card, index) => {
    let score = 0
    if (card.openedFromRedraw) score += 40
    if (card.isSelf) score += 30
    if (
      card.kind === 'double' ||
      card.kind === 'max_to_zero' ||
      card.kind === 'half' ||
      card.kind === 'redraw' ||
      card.kind === 'zero_mix'
    ) {
      score += 25
    }
    if (card.kind === 'number' && isExtremeNumber(card.value)) score += 15
    return { index, score, order: index }
  })
  scored.sort((a, b) => b.score - a.score || a.order - b.order)
  return scored.map((s) => s.index)
})

const visibleCardEntries = computed(() => {
  const r = result.value
  if (!r) return [] as Array<{ card: ResultMock['cards'][number]; index: number }>
  const indexes =
    showAllCards.value || rankedCardIndexes.value.length <= CARD_COLLAPSE_AT
      ? r.cards.map((_, i) => i)
      : rankedCardIndexes.value.slice(0, CARD_COLLAPSE_AT)
  // Preserve seat order among visible set
  const set = new Set(indexes)
  return r.cards
    .map((card, index) => ({ card, index }))
    .filter(({ index }) => set.has(index))
})

const hiddenCardCount = computed(() => {
  const r = result.value
  if (!r || showAllCards.value) return 0
  return Math.max(0, r.cards.length - CARD_COLLAPSE_AT)
})

// --- Sequence state ---------------------------------------------------------

/** Bid number visible in comparison */
const showBidReveal = ref(false)
/** Operator between bid and total */
const showOpReveal = ref(false)
/** Animated final total (count-up) */
const displayTotal = ref<number | null>(null)
const calcDone = ref(false)
const showConfetti = ref(false)
const totalRevealDone = ref(false)
const showVignette = ref(false)
const holdingBeforeSlam = ref(false)

/**
 * `?` open sequence keys (openedFromRedraw faces).
 */
const openFaceKeys = ref<Set<string>>(new Set())
const zoomingKey = ref<string | null>(null)
const redrawOpensDone = ref(true)
/** How many non-mystery cards have staggered in */
const cardsRevealedCount = ref(0)

let stepTimers: ReturnType<typeof setTimeout>[] = []
let holdTimer: ReturnType<typeof setTimeout> | null = null
let openTimers: ReturnType<typeof setTimeout>[] = []
let countRaf = 0
const resultDeduper = getCoyoteSequenceDeduper()

const REDRAW_OPEN_START_MS = 280
const REDRAW_OPEN_TOTAL_MS = 1600
const REDRAW_OPEN_FACE_MS = Math.round(REDRAW_OPEN_TOTAL_MS * 0.24)
const REDRAW_OPEN_STAGGER_MS = REDRAW_OPEN_TOTAL_MS + 100
const REDRAW_OPEN_HOLD_MS = 200
const BID_REVEAL_MS = 180
const OP_REVEAL_MS = 320
const COUNT_UP_MS_BASE = 620
const COUNT_UP_MS_SLOW = 820
const CARD_STAGGER_START_MS = 80

function cardKey(card: ResultMock['cards'][number], index: number): string {
  return `${card.playerId}:${index}`
}

const redrawOpenCards = computed(() => {
  const r = result.value
  if (!r) return [] as Array<{ card: ResultMock['cards'][number]; index: number }>
  return r.cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.openedFromRedraw === true)
})

const hasRedrawOpens = computed(() => redrawOpenCards.value.length > 0)

function isFaceOpen(card: ResultMock['cards'][number], index: number): boolean {
  if (!card.openedFromRedraw) return true
  return openFaceKeys.value.has(cardKey(card, index))
}

function isZooming(card: ResultMock['cards'][number], index: number): boolean {
  return zoomingKey.value === cardKey(card, index)
}

const showRedrawScrim = computed(() => zoomingKey.value != null)

const countUpMs = computed(() =>
  marginTier.value === 'exact' || marginTier.value === 'clutch'
    ? COUNT_UP_MS_SLOW
    : COUNT_UP_MS_BASE,
)

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function isTabHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function clearHoldTimer() {
  if (holdTimer != null) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
  holdingBeforeSlam.value = false
}

function clearOpenTimers() {
  for (const t of openTimers) clearTimeout(t)
  openTimers = []
  zoomingKey.value = null
}

function clearStepTimers() {
  for (const t of stepTimers) clearTimeout(t)
  stepTimers = []
  clearHoldTimer()
  clearOpenTimers()
  if (countRaf) {
    cancelAnimationFrame(countRaf)
    countRaf = 0
  }
}

function snapAllRedrawFacesOpen() {
  const keys = new Set<string>()
  for (const { card, index } of redrawOpenCards.value) {
    keys.add(cardKey(card, index))
  }
  openFaceKeys.value = keys
  zoomingKey.value = null
  redrawOpensDone.value = true
}

function playVerdictSfx() {
  if (isTabHidden()) return
  playSfx('result_slam')
  const lose = selfIsLoser.value
  if (lose) {
    playHaptic('life_loss')
  }
  window.setTimeout(() => {
    playSfx(lose ? 'result_lose' : 'result_win')
  }, 120)
}

function snapToFinalVerdict(playSfxOnReveal = false) {
  clearStepTimers()
  snapAllRedrawFacesOpen()
  const r = result.value
  if (!r) return
  showBidReveal.value = true
  showOpReveal.value = true
  calcDone.value = true
  displayTotal.value = r.finalTotal
  totalRevealDone.value = true
  showConfetti.value = true
  showVignette.value = true
  holdingBeforeSlam.value = false
  cardsRevealedCount.value = r.cards.length
  showAllCards.value = r.cards.length > CARD_COLLAPSE_AT
  if (playSfxOnReveal) playVerdictSfx()
}

function animateTotalTo(target: number) {
  if (countRaf) cancelAnimationFrame(countRaf)
  totalRevealDone.value = false
  if (prefersReducedMotion()) {
    displayTotal.value = target
    totalRevealDone.value = true
    showConfetti.value = true
    showVignette.value = true
    playVerdictSfx()
    scheduleCardStagger()
    return
  }

  const start = performance.now()
  const from = 0
  const span = target - from
  const duration = countUpMs.value

  function frame(now: number) {
    const t = Math.min(1, (now - start) / duration)
    const eased = 1 - (1 - t) ** 3
    displayTotal.value = Math.round(from + span * eased)
    if (t < 1) {
      countRaf = requestAnimationFrame(frame)
    } else {
      displayTotal.value = target
      totalRevealDone.value = true
      showConfetti.value = true
      showVignette.value = true
      countRaf = 0
      playVerdictSfx()
      scheduleCardStagger()
    }
  }
  countRaf = requestAnimationFrame(frame)
}

function scheduleCardStagger() {
  const r = result.value
  if (!r) return
  if (prefersReducedMotion() || isTabHidden()) {
    cardsRevealedCount.value = r.cards.length
    return
  }
  const stagger = cardRevealStaggerMs(marginTier.value)
  cardsRevealedCount.value = 0
  for (let i = 0; i < r.cards.length; i++) {
    const t = setTimeout(() => {
      cardsRevealedCount.value = i + 1
    }, CARD_STAGGER_START_MS + i * stagger)
    stepTimers.push(t)
  }
}

function onComparisonReady() {
  calcDone.value = true
  const r = result.value
  if (!r) return

  if (isTabHidden() || prefersReducedMotion()) {
    animateTotalTo(r.finalTotal)
    return
  }

  clearHoldTimer()
  holdingBeforeSlam.value = true
  const holdMs = preSlamHoldMs(marginTier.value)
  holdTimer = setTimeout(() => {
    holdTimer = null
    holdingBeforeSlam.value = false
    animateTotalTo(r.finalTotal)
  }, holdMs)
}

/** Bid → operator → hold → total count-up */
function runComparisonSequence() {
  clearHoldTimer()
  showBidReveal.value = false
  showOpReveal.value = false
  calcDone.value = false
  showConfetti.value = false
  showVignette.value = false
  totalRevealDone.value = false
  displayTotal.value = null
  holdingBeforeSlam.value = false
  cardsRevealedCount.value = 0

  const r = result.value
  if (!r) return

  if (prefersReducedMotion() || isTabHidden()) {
    showBidReveal.value = true
    showOpReveal.value = true
    onComparisonReady()
    return
  }

  const tBid = setTimeout(() => {
    showBidReveal.value = true
  }, BID_REVEAL_MS)
  stepTimers.push(tBid)

  const tOp = setTimeout(() => {
    showOpReveal.value = true
  }, OP_REVEAL_MS)
  stepTimers.push(tOp)

  const tGo = setTimeout(() => {
    onComparisonReady()
  }, OP_REVEAL_MS + 200)
  stepTimers.push(tGo)
}

function runRedrawOpenSequence(then: () => void) {
  clearOpenTimers()
  openFaceKeys.value = new Set()
  zoomingKey.value = null
  redrawOpensDone.value = false

  const targets = redrawOpenCards.value
  if (targets.length === 0) {
    redrawOpensDone.value = true
    then()
    return
  }

  if (prefersReducedMotion() || isTabHidden()) {
    snapAllRedrawFacesOpen()
    then()
    return
  }

  let elapsed = REDRAW_OPEN_START_MS
  for (const { card, index } of targets) {
    const key = cardKey(card, index)
    const atZoom = elapsed
    const tZoom = setTimeout(() => {
      zoomingKey.value = key
      if (!isTabHidden()) {
        playSfx('card_flip')
        playHaptic('wild_call')
      }
      const tFace = setTimeout(() => {
        const next = new Set(openFaceKeys.value)
        next.add(key)
        openFaceKeys.value = next
      }, REDRAW_OPEN_FACE_MS)
      openTimers.push(tFace)

      const tEnd = setTimeout(() => {
        if (zoomingKey.value === key) zoomingKey.value = null
      }, REDRAW_OPEN_TOTAL_MS)
      openTimers.push(tEnd)
    }, atZoom)
    openTimers.push(tZoom)
    elapsed += REDRAW_OPEN_STAGGER_MS
  }

  const doneAt =
    elapsed - REDRAW_OPEN_STAGGER_MS + REDRAW_OPEN_TOTAL_MS + REDRAW_OPEN_HOLD_MS
  const tDone = setTimeout(() => {
    snapAllRedrawFacesOpen()
    then()
  }, doneAt)
  openTimers.push(tDone)
}

function runCalcSequence() {
  clearStepTimers()
  showBidReveal.value = false
  showOpReveal.value = false
  calcDone.value = false
  showConfetti.value = false
  showVignette.value = false
  totalRevealDone.value = false
  displayTotal.value = null
  holdingBeforeSlam.value = false
  openFaceKeys.value = new Set()
  zoomingKey.value = null
  redrawOpensDone.value = !hasRedrawOpens.value
  cardsRevealedCount.value = 0
  showAllCards.value = false
  showCalcDetails.value = false

  const r = result.value
  if (!r) return

  const challengeKey = coyoteChallengeKey({
    round: r.round,
    bidValue: r.bidValue,
    challengerName: r.challengerName,
    finalTotal: r.finalTotal,
  })
  const seqId = resultSequenceEventId({
    round: r.round,
    bidValue: r.bidValue,
    finalTotal: r.finalTotal,
    challengerName: r.challengerName,
    lifeLostName: r.lifeLostName,
  })

  if (!resultDeduper.tryConsume(seqId)) {
    snapToFinalVerdict(false)
    markResultSequencePlayed(challengeKey)
    return
  }
  markResultSequencePlayed(challengeKey)

  if (isTabHidden()) {
    snapToFinalVerdict(false)
    return
  }

  // Cards strip visible early; ? opens first if needed, then comparison drama
  runRedrawOpenSequence(() => {
    runComparisonSequence()
  })
}

function skipCalc() {
  snapToFinalVerdict(true)
}

const confettiPalette = computed(() => {
  if (localMeta.value.isGameOver) return 'gold' as const
  if (!result.value) return 'mixed' as const
  if (marginTier.value === 'exact' || rareTags.value.includes('perfect')) {
    return 'mixed' as const
  }
  if (hasWildReversal.value) return 'mixed' as const
  return result.value.bidderWins ? ('gold' as const) : ('teal' as const)
})

const confettiDensity = computed(() =>
  confettiDensityFor({
    isGameOver: localMeta.value.isGameOver,
    tier: marginTier.value,
    rareTags: rareTags.value,
  }),
)

const vignetteTone = computed(() => {
  if (localMeta.value.isGameOver) return 'gameover' as const
  if (!result.value) return 'win' as const
  if (eliminated.value || lifeLossAmount.value > 1) return 'lose' as const
  return result.value.bidderWins ? ('lose' as const) : ('win' as const)
})

function cardEmphasis(card: ResultMock['cards'][number]) {
  if (card.isSelf) return 'self' as const
  if (
    card.kind === 'double' ||
    card.kind === 'max_to_zero' ||
    card.kind === 'half' ||
    card.kind === 'redraw' ||
    card.kind === 'zero_mix'
  ) {
    return 'special' as const
  }
  if (card.kind === 'number' && isExtremeNumber(card.value)) {
    return 'extreme' as const
  }
  return 'none' as const
}

function isCardVisible(index: number): boolean {
  return cardsRevealedCount.value > index || totalRevealDone.value
}

/** Heart row: before → after (filled + lost) */
const heartSlots = computed(() => {
  const before = livesBefore.value
  const after = livesAfter.value
  const loss = lifeLossAmount.value
  if (before == null || after == null) {
    // Fallback when lives unknown: show lost hearts only
    return {
      mode: 'loss-only' as const,
      before: loss,
      after: 0,
      loss,
    }
  }
  return {
    mode: 'full' as const,
    before,
    after,
    loss,
  }
})

watch(
  () => {
    const r = result.value
    if (!r) return null
    return `${r.round}:${r.bidValue}:${r.challengerName}:${r.finalTotal}:${r.lifeLostName}`
  },
  () => {
    runCalcSequence()
  },
  { immediate: true },
)

onMounted(() => {
  void bootstrapResult()
})

async function bootstrapResult() {
  if (!allowUiMock && route.query.mock === '1') {
    void router.replace({ name: 'home' })
    return
  }
  if (useMock.value) return

  if (isOnline.value || route.query.online === '1') {
    const qCode =
      typeof route.query.code === 'string' ? route.query.code : undefined
    if (onlineGame.connection !== 'open' || !onlineGame.view) {
      await onlineGame.ensureSession({ code: qCode })
    }
    if (!onlineGame.pendingResult) {
      const code = onlineGame.roomCode ?? qCode
      void router.replace({
        name: 'game',
        query: { online: '1', ...(code ? { code } : {}) },
      })
    }
    return
  }

  if (!allowLocalPlay) {
    void router.replace({ name: 'home' })
    return
  }

  if (!activeResult.value) {
    void router.replace({ name: 'game' })
  }
}

onUnmounted(() => {
  clearStepTimers()
})

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

function goToLobbyAfterRematch() {
  if (!isOnline.value) return
  onlineGame.acceptLobbyReturn()
  const code = onlineGame.roomCode
  void router.replace({
    name: 'lobby',
    query: { online: '1', ...(code ? { code } : {}) },
  })
}

watch(
  () => onlineGame.lastErrorCode,
  (code) => {
    if (code === 'ROOM_CLOSED') {
      void router.replace({ name: 'home' })
    }
  },
)

function goNextRound() {
  if (useMock.value) {
    void router.push({ name: 'game', query: { mock: '1' } })
    return
  }
  if (isOnline.value) {
    onlineGame.clearPendingResult()
    const code = onlineGame.roomCode
    void router.push({
      name: 'game',
      query: { online: '1', ...(code ? { code } : {}) },
    })
    return
  }
  store.clearPendingResult()
  void router.push({ name: 'game' })
}

async function playAgain() {
  if (useMock.value) {
    void router.push({ name: 'game', query: { mock: '1' } })
    return
  }
  if (isOnline.value) {
    onlineGame.requestRematch()
    return
  }
  await store.restartLastGame()
  void router.push({ name: 'game' })
}

const sequenceBusy = computed(
  () =>
    result.value != null &&
    (!totalRevealDone.value || !redrawOpensDone.value),
)
</script>

<template>
  <div class="page-fixed desert-bg safe-x">
    <AppHeader :sticky="false">
      <template #actions>
        <button
          v-if="sequenceBusy"
          type="button"
          class="btn-ghost btn-sm"
          @click="skipCalc"
        >
          スキップ
        </button>
      </template>
    </AppHeader>

    <div
      v-if="result"
      class="relative z-10 mx-auto flex w-full max-w-[1080px] min-h-0 flex-1 flex-col overflow-hidden"
    >
      <FxConfetti
        v-if="showConfetti"
        class="fixed inset-0 z-20 pointer-events-none"
        :density="confettiDensity"
        :palette="confettiPalette"
      />
      <div
        v-if="showVignette"
        class="verdict-vignette"
        :class="`verdict-vignette--${vignetteTone}`"
        aria-hidden="true"
      />

      <!-- Dim while ? zooms -->
      <div
        v-if="hasRedrawOpens && !redrawOpensDone"
        class="redraw-open-scrim"
        :class="{ 'is-on': showRedrawScrim }"
        aria-hidden="true"
      />

      <!-- Scrollable body -->
      <div
        class="min-h-0 flex-1 overflow-y-auto scrollbar-none px-4 pt-4 pb-3 sm:px-6 sm:pt-5 lg:px-8 lg:pt-5"
      >
        <!-- ========== 1. Unified result hero ========== -->
        <section
          class="result-banner-in relative mb-4 overflow-hidden rounded-2xl border border-gold-400/20 bg-night-900/75 px-4 py-5 text-center sm:mb-5 sm:px-6 sm:py-6"
          :class="[
            localMeta.isGameOver
              ? 'ring-1 ring-gold-400/40'
              : result.bidderWins
                ? 'ring-1 ring-gold-400/30'
                : 'ring-1 ring-teal-soft/40',
            totalRevealDone && !localMeta.isGameOver
              ? result.bidderWins
                ? 'verdict-lose-glow'
                : 'verdict-win-glow'
              : '',
          ]"
        >
          <!-- Game over banner -->
          <template v-if="localMeta.isGameOver">
            <p class="mb-1 text-[10px] tracking-[0.18em] text-sand-dim sm:text-xs">
              {{ localMeta.winnerName ? '勝者' : '試合終了' }}
            </p>
            <h2
              class="font-display text-2xl font-bold text-gold-100 sm:text-3xl"
              :class="totalRevealDone || showConfetti ? 'total-slam' : ''"
            >
              <template v-if="localMeta.winnerName">
                {{ localMeta.winnerName }} の勝利！
              </template>
              <template v-else> 脱落者が出たため終了 </template>
            </h2>
            <div class="my-3 h-px w-full bg-gold-400/15" />
          </template>

          <p class="mb-1 text-[10px] tracking-[0.2em] text-sand-dim sm:text-xs">
            {{ localMeta.isGameOver ? '最終ラウンド' : 'コヨーテ！ 結果' }}
          </p>
          <h2
            class="result-title-in font-display font-bold text-gold-200"
            :class="[
              localMeta.isGameOver ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
              totalRevealDone &&
              (marginTier === 'exact' || rareTags.includes('perfect'))
                ? 'total-slam total-slam--exact total-slam--perfect'
                : '',
              totalRevealDone && marginTier === 'clutch' ? 'total-slam--clutch' : '',
              totalRevealDone && hasWildReversal ? 'total-slam--reversal' : '',
              totalRevealDone && hasMaxHeat ? 'total-slam--max-heat' : '',
            ]"
          >
            {{ verdictTitle }}
          </h2>

          <div
            v-if="totalRevealDone && rareTags.length"
            class="mt-2 flex flex-wrap items-center justify-center gap-1.5"
          >
            <span
              v-for="tag in rareTags"
              :key="tag"
              class="rare-tag-chip"
              :class="`rare-tag-chip--${tag}`"
              >{{ rareTagLabel(tag) }}</span
            >
          </div>
          <div
            v-else-if="totalRevealDone && showJapaneseDramaChip && dramaChip"
            class="mt-2 flex justify-center"
          >
            <span
              class="drama-tier-chip"
              :class="`drama-tier-chip--${marginTier}`"
              >{{ dramaChip }}</span
            >
          </div>

          <!-- Primary visual: bid  op  total -->
          <div
            class="result-compare mt-5 flex items-end justify-center gap-3 sm:gap-6 sm:mt-6"
            role="group"
            :aria-label="`宣言 ${result.bidValue} ${compareOp} 実際の合計 ${result.finalTotal}`"
          >
            <!-- Bid -->
            <div
              class="result-compare__side flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:max-w-[11rem]"
              :class="showBidReveal ? 'result-compare__side--in' : 'opacity-40'"
            >
              <span class="text-[10px] tracking-wider text-sand-dim">宣言</span>
              <div class="flex items-center gap-1.5">
                <PlayerAvatar
                  :avatar="result.bidderAvatar"
                  :avatar-src="result.bidderAvatarSrc"
                  :name="result.bidderName"
                  size="sm"
                  hide-name
                />
                <span
                  class="max-w-[5.5rem] truncate text-xs font-semibold text-sand sm:max-w-[7rem] sm:text-sm"
                  >{{ result.bidderName }}</span
                >
              </div>
              <span
                class="font-display text-4xl font-bold tabular-nums text-gold-200 sm:text-5xl"
                >{{ showBidReveal ? result.bidValue : '—' }}</span
              >
            </div>

            <!-- Operator -->
            <div
              class="result-compare__op mb-1 flex shrink-0 flex-col items-center justify-end pb-1"
              :class="showOpReveal ? 'result-compare__op--in' : 'opacity-30'"
              aria-hidden="true"
            >
              <span
                class="font-display text-3xl font-bold leading-none sm:text-4xl"
                :class="
                  result.bidderWins
                    ? 'text-gold-300'
                    : 'text-teal-soft'
                "
              >
                {{ showOpReveal ? compareOp : '·' }}
              </span>
            </div>

            <!-- Actual total -->
            <div
              class="result-compare__side flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:max-w-[11rem]"
              :class="
                calcDone || holdingBeforeSlam ? 'opacity-100' : 'opacity-40'
              "
            >
              <span class="text-[10px] tracking-wider text-sand-dim"
                >実際の合計</span
              >
              <div class="flex h-6 items-center gap-1.5 sm:h-7">
                <span
                  class="chip text-[10px]"
                  :class="result.bidderWins ? 'chip-gold' : 'chip-teal'"
                >
                  {{ result.bidderWins ? '宣言側' : 'コヨーテ' }}
                </span>
              </div>
              <span
                class="font-display text-4xl font-bold tabular-nums text-gold-100 sm:text-5xl"
                :class="[
                  holdingBeforeSlam ? 'total-hold-pulse' : '',
                  totalRevealDone ? 'total-slam' : '',
                  totalRevealDone &&
                  (marginTier === 'exact' || rareTags.includes('perfect'))
                    ? 'total-slam--exact total-slam--perfect'
                    : '',
                  totalRevealDone && marginTier === 'clutch'
                    ? 'total-slam--clutch'
                    : '',
                  totalRevealDone && hasWildReversal
                    ? 'total-slam--reversal'
                    : '',
                  totalRevealDone && hasMaxHeat ? 'total-slam--max-heat' : '',
                  totalRevealDone && hasLastSecond
                    ? 'total-slam--last-second'
                    : '',
                ]"
              >
                {{
                  displayTotal ??
                  (holdingBeforeSlam ? '…' : calcDone ? result.finalTotal : '—')
                }}
              </span>
            </div>
          </div>

          <p
            v-if="totalRevealDone"
            class="result-compare__reason mt-3 text-sm text-sand-dim sm:mt-4"
          >
            {{ comparisonReason }}
          </p>
          <p
            v-else-if="holdingBeforeSlam"
            class="mt-3 text-[11px] tracking-wider text-sand-dim/80"
            aria-hidden="true"
          >
            …
          </p>

          <!-- Life loss: compact horizontal bar -->
          <div
            v-if="totalRevealDone"
            class="life-lost-bar life-lost-pulse mx-auto mt-4 w-full max-w-lg sm:mt-5"
            :class="[
              eliminated ? 'life-lost-bar--ko' : '',
              lifeLossAmount > 1 ? 'life-lost-bar--double' : '',
              hasSurvived ? 'life-lost-bar--survived' : '',
            ]"
            role="status"
          >
            <div class="life-lost-bar__accent" aria-hidden="true" />
            <PlayerAvatar
              class="shrink-0"
              :avatar="result.lifeLostAvatar"
              :avatar-src="result.lifeLostAvatarSrc"
              :name="result.lifeLostName"
              size="md"
              hide-name
            />
            <div class="min-w-0 flex-1 text-left">
              <p class="truncate font-display text-base font-bold text-red-50 sm:text-lg">
                {{ result.lifeLostName }}
                <span
                  v-if="eliminated"
                  class="ml-1.5 align-middle text-sm font-bold tracking-wide text-rose-300"
                  >脱落</span
                >
              </p>
              <p class="mt-0.5 text-xs text-red-200/85 sm:text-sm">
                {{ lifeLossReason }}
              </p>
            </div>
            <div
              class="life-lost-bar__hearts shrink-0 text-right"
              :aria-label="
                heartSlots.mode === 'full'
                  ? `ライフ ${heartSlots.before} から ${heartSlots.after}`
                  : `ライフ −${lifeLossAmount}`
              "
            >
              <div
                class="flex items-center justify-end gap-1.5 font-display text-sm tabular-nums text-sand sm:text-base"
              >
                <template v-if="heartSlots.mode === 'full'">
                  <span class="inline-flex gap-0.5" aria-hidden="true">
                    <span
                      v-for="i in heartSlots.before"
                      :key="`b-${i}`"
                      class="leading-none"
                      :class="
                        i > heartSlots.after
                          ? 'life-heart-lost text-rose-400/90'
                          : 'text-rose-400'
                      "
                      >{{ i > heartSlots.after ? '♡' : '♥' }}</span
                    >
                  </span>
                  <span class="text-sand-dim">→</span>
                  <span class="inline-flex gap-0.5" aria-hidden="true">
                    <template v-if="heartSlots.after > 0">
                      <span
                        v-for="i in heartSlots.after"
                        :key="`a-${i}`"
                        class="leading-none text-rose-400"
                        >♥</span
                      >
                    </template>
                    <span v-else class="text-sand-dim">0</span>
                  </span>
                </template>
                <template v-else>
                  <span
                    v-for="i in lifeLossAmount"
                    :key="`lo-${i}`"
                    class="life-heart-lost text-lg leading-none text-rose-400"
                    :style="{ animationDelay: `${(i - 1) * 0.1}s` }"
                    aria-hidden="true"
                    >♥</span
                  >
                </template>
              </div>
              <p class="mt-0.5 text-[11px] text-sand-dim sm:text-xs">
                <template v-if="heartSlots.mode === 'full'">
                  ライフ {{ heartSlots.before }} → {{ heartSlots.after }}
                </template>
                <template v-else> ライフ −{{ lifeLossAmount }} </template>
                <span
                  v-if="lifeLossAmount > 1"
                  class="ml-1 rounded-full bg-amber-500/20 px-1.5 py-px text-[9px] font-bold text-amber-200"
                  >ダブル</span
                >
                <span
                  v-if="hasSurvived"
                  class="ml-1 rounded-full bg-teal-soft/20 px-1.5 py-px text-[9px] font-bold text-teal-soft"
                  >残り1</span
                >
              </p>
            </div>
          </div>
        </section>

        <!-- ========== 2. Mid: cards | calc (PC 2-col) ========== -->
        <div
          class="mb-4 grid gap-4 sm:mb-5 lg:grid-cols-2 lg:gap-5 lg:items-start"
        >
          <!-- Revealed cards -->
          <section
            class="rounded-2xl border border-gold-400/15 bg-night-900/55 px-3 py-3.5 sm:px-4 sm:py-4"
            :class="
              totalRevealDone &&
              (marginTier === 'exact' || marginTier === 'clutch')
                ? 'result-cards-pulse'
                : ''
            "
          >
            <div class="mb-2.5 flex items-baseline justify-between gap-2">
              <h3 class="text-sm font-semibold text-gold-200">公開されたカード</h3>
              <span class="text-[10px] text-sand-dim"
                >{{ result.cards.length }} 枚</span
              >
            </div>

            <ul
              class="result-card-strip flex gap-2.5 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap sm:overflow-visible"
            >
              <li
                v-for="{ card, index } in visibleCardEntries"
                :key="`${card.playerId}-${index}`"
                class="result-card-item flex w-[4.5rem] shrink-0 flex-col items-center sm:w-[4.75rem]"
                :class="[
                  isCardVisible(index) || isFaceOpen(card, index)
                    ? 'result-card-item--in'
                    : 'result-card-item--wait',
                  card.isSelf ? 'reveal-seat--self' : '',
                  isZooming(card, index) ? 'redraw-open-slot--active z-30' : '',
                ]"
              >
                <div
                  class="mb-1 flex max-w-full flex-col items-center leading-tight"
                >
                  <span
                    class="max-w-full truncate text-[10px] font-medium"
                    :class="card.isSelf ? 'text-teal-soft' : 'text-sand-dim'"
                  >
                    {{ card.isSelf ? 'あなた' : card.playerName }}
                  </span>
                  <span
                    v-if="card.isSelf"
                    class="reveal-self-badge"
                    aria-hidden="true"
                  >自分の札</span>
                </div>

                <!-- Redraw open uses continuous zoom dual-face -->
                <div
                  v-if="card.openedFromRedraw"
                  class="redraw-open-zoom-slot"
                >
                  <div
                    class="redraw-open-zoom"
                    :class="isZooming(card, index) ? 'redraw-open-zoom--play' : ''"
                  >
                    <div
                      class="redraw-open-faces"
                      :class="
                        isFaceOpen(card, index) ? 'redraw-open-faces--open' : ''
                      "
                    >
                      <div class="redraw-open-faces__mystery">
                        <RevealCardTile
                          kind="redraw"
                          label="?"
                          :value="null"
                          size="md"
                          :revealed="true"
                          emphasis="special"
                          opened-from-redraw
                          :face-open="false"
                        />
                      </div>
                      <div class="redraw-open-faces__final">
                        <RevealCardTile
                          :kind="card.kind"
                          :label="card.label"
                          :value="card.value"
                          size="md"
                          :revealed="true"
                          :emphasis="card.isSelf ? 'self' : 'special'"
                          opened-from-redraw
                          :face-open="true"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <RevealCardTile
                  v-else
                  :kind="card.kind"
                  :label="card.label"
                  :value="card.value"
                  size="md"
                  :revealed="isCardVisible(index)"
                  :emphasis="cardEmphasis(card)"
                />

                <p
                  v-if="card.openedFromRedraw"
                  class="mt-1 text-[9px] font-semibold tracking-wide"
                  :class="
                    isFaceOpen(card, index) ? 'text-gold-200' : 'text-sand-dim'
                  "
                >
                  {{ isFaceOpen(card, index) ? '？→' + card.label : '引き直し' }}
                </p>
                <p
                  v-else-if="
                    card.kind !== 'number' && card.kind !== 'zero_mix'
                  "
                  class="mt-1 text-[9px] text-sand-dim"
                >
                  特殊
                </p>
              </li>
            </ul>

            <button
              v-if="hiddenCardCount > 0"
              type="button"
              class="btn-ghost btn-sm mt-2 w-full"
              @click="showAllCards = true"
            >
              すべて見る（あと {{ hiddenCardCount }} 枚）
            </button>
            <button
              v-else-if="
                showAllCards && result.cards.length > CARD_COLLAPSE_AT
              "
              type="button"
              class="btn-ghost btn-sm mt-2 w-full"
              @click="showAllCards = false"
            >
              折りたたむ
            </button>
          </section>

          <!-- Calculation summary -->
          <section
            class="rounded-2xl border border-gold-400/15 bg-night-900/55 px-3 py-3.5 sm:px-4 sm:py-4"
            :class="[
              hasWildReversal && totalRevealDone ? 'result-calc--reversal' : '',
              !redrawOpensDone ? 'opacity-50' : '',
            ]"
          >
            <h3 class="mb-2.5 text-sm font-semibold text-gold-200">
              合計の計算
            </h3>

            <!-- Concise formula -->
            <div
              class="rounded-xl border border-gold-400/15 bg-night-950/50 px-3 py-3 text-center sm:px-4"
            >
              <p
                v-if="calcSummary.terms.length"
                class="font-display text-base font-semibold tabular-nums tracking-wide text-sand sm:text-lg"
                :class="totalRevealDone ? 'opacity-100' : 'opacity-50'"
              >
                {{ calcSummary.terms.join('  ') }}
              </p>
              <p v-else class="text-sm text-sand-dim">数字カードなし</p>
              <div
                class="mx-auto my-2 h-px w-24 bg-gold-400/35 sm:w-32"
                aria-hidden="true"
              />
              <p
                class="font-display text-3xl font-bold tabular-nums text-gold-100 sm:text-4xl"
                :class="[
                  totalRevealDone ? 'total-slam' : 'opacity-40',
                  totalRevealDone && hasWildReversal
                    ? 'total-slam--reversal'
                    : '',
                ]"
              >
                {{
                  totalRevealDone
                    ? (displayTotal ?? result.finalTotal)
                    : '—'
                }}
              </p>
            </div>

            <!-- Specials only when applied -->
            <ul
              v-if="totalRevealDone && calcSummary.specials.length"
              class="mt-3 space-y-1.5"
            >
              <li
                v-for="sp in calcSummary.specials"
                :key="sp.id"
                class="flex items-start gap-2 rounded-lg border border-violet-400/20 bg-violet-950/25 px-2.5 py-1.5 text-left"
              >
                <span
                  class="shrink-0 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-200"
                  >{{ sp.label }}</span
                >
                <span class="min-w-0 text-[11px] leading-snug text-sand-dim">{{
                  sp.detail
                }}</span>
              </li>
            </ul>
            <p
              v-else-if="totalRevealDone && hasWildReversal"
              class="mt-2 text-center text-[11px] text-violet-300"
            >
              特殊札で勝敗が逆転しました
            </p>

            <!-- Details collapsible -->
            <div class="mt-3 border-t border-gold-400/10 pt-2.5">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-xs text-sand-dim transition hover:text-sand"
                :aria-expanded="showCalcDetails"
                @click="showCalcDetails = !showCalcDetails"
              >
                <span>計算の詳細を見る</span>
                <span class="text-gold-300" aria-hidden="true">{{
                  showCalcDetails ? '▲' : '▼'
                }}</span>
              </button>
              <ol
                v-if="showCalcDetails"
                class="mt-2 space-y-2"
              >
                <li
                  v-for="(step, i) in result.calcSteps"
                  :key="step.id"
                  class="calc-step calc-step--done opacity-100"
                >
                  <span class="calc-step__badge">{{ i + 1 }}</span>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-sand">
                      {{ step.title }}
                    </div>
                    <div class="mt-0.5 text-xs text-sand-dim">
                      {{ step.detail }}
                    </div>
                  </div>
                  <div
                    v-if="step.totalAfter != null"
                    class="shrink-0 self-center font-display text-lg font-bold tabular-nums text-gold-200"
                  >
                    {{ step.totalAfter }}
                  </div>
                </li>
              </ol>
            </div>
          </section>
        </div>
      </div>

      <!-- ========== 3. Actions (sticky footer) ========== -->
      <div
        class="result-actions z-20 shrink-0 border-t border-gold-400/15 bg-night-900/95 px-4 py-3 backdrop-blur-md safe-bottom sm:px-6 lg:px-8"
      >
        <div
          v-if="isOnline && onlineGame.pendingLobbyReturn"
          class="mx-auto max-w-lg text-center"
        >
          <p class="text-sm font-medium text-teal-soft">
            ルームがロビーに戻りました
          </p>
          <p class="mt-0.5 text-[11px] text-sand-dim">
            結果を見終わったらロビーへどうぞ
          </p>
          <button
            type="button"
            class="btn-gold mt-2.5 w-full sm:mx-auto sm:max-w-xs"
            @click="goToLobbyAfterRematch"
          >
            ロビーへ
          </button>
        </div>
        <div
          v-else
          class="mx-auto flex w-full max-w-lg flex-col gap-2 sm:flex-row sm:justify-center"
        >
          <button
            v-if="localMeta.isGameOver && !useMock"
            type="button"
            class="btn-gold w-full sm:max-w-xs"
            @click="playAgain"
          >
            もう一度遊ぶ
          </button>
          <button
            v-else
            type="button"
            class="btn-gold w-full sm:max-w-xs"
            :class="!totalRevealDone ? 'opacity-90' : ''"
            @click="goNextRound"
          >
            次のラウンドへ
          </button>
        </div>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div
      v-else
      class="relative z-10 mx-auto flex w-full max-w-[1080px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 safe-bottom sm:px-6 sm:py-6"
      aria-busy="true"
      aria-label="結果を読み込み中"
    >
      <div class="animate-pulse rounded-2xl border border-gold-400/15 bg-night-900/60 p-5 sm:p-6">
        <div class="mx-auto mb-3 h-3 w-24 rounded bg-gold-400/15" />
        <div class="mx-auto mb-4 h-8 w-48 rounded-lg bg-gold-400/20" />
        <div class="mx-auto mb-6 flex justify-center gap-6">
          <div class="h-16 w-20 rounded-xl bg-night-800/80" />
          <div class="h-10 w-10 self-center rounded-full bg-night-800/60" />
          <div class="h-16 w-20 rounded-xl bg-night-800/80" />
        </div>
        <div class="mx-auto h-14 max-w-md rounded-xl bg-red-950/30" />
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="animate-pulse rounded-2xl border border-gold-400/10 bg-night-900/50 p-4">
          <div class="mb-3 h-4 w-28 rounded bg-gold-400/15" />
          <div class="flex gap-2">
            <div class="h-16 w-14 rounded-lg bg-night-800/60" />
            <div class="h-16 w-14 rounded-lg bg-night-800/50" />
            <div class="h-16 w-14 rounded-lg bg-night-800/40" />
          </div>
        </div>
        <div class="animate-pulse rounded-2xl border border-gold-400/10 bg-night-900/50 p-4">
          <div class="mb-3 h-4 w-24 rounded bg-gold-400/15" />
          <div class="h-20 rounded-xl bg-night-800/50" />
        </div>
      </div>
      <p class="text-center text-xs text-sand-dim">結果を読み込んでいます…</p>
    </div>

    <MockBadge />
  </div>
</template>
