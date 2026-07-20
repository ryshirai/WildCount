<script setup lang="ts">
/**
 * Result screen after game-side card reveal (D3: hold + rare tags + once-only).
 * Focus: verdict + calculation steps (cards are a static recap).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { playSfx } from '@/audio'
import { mockResult } from '@/data/mockResult'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'
import AppHeader from '@/components/common/AppHeader.vue'
import FxConfetti from '@/components/common/FxConfetti.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import StatusChip from '@/components/common/StatusChip.vue'
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
  classifyMargin,
  classifyRareTags,
  confettiDensityFor,
  isExtremeNumber,
  marginChipLabel,
  preSlamHoldMs,
  rareTagLabel,
  resultSequenceEventId,
  verdictDetailFor,
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
  // Prefer the frozen result snapshot — live game flags can flip when peers act
  return {
    isGameOver:
      r.isGameOver ||
      (!isOnline.value && isGameOver.value),
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

/** D3 rare tags from public result + frozen COYOTE context */
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
      : (isOnline.value
          ? onlineGame.gameView?.roundBidCount
          : undefined) ?? null,
  })
})

/** Prefer English rare tags; fall back to Japanese margin chip when none */
const showJapaneseDramaChip = computed(() => {
  if (!dramaChip.value) return false
  // PERFECT/CLUTCH already cover exact/clutch
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

const verdictDetail = computed(() => {
  if (!result.value) return ''
  return verdictDetailFor({
    finalTotal: result.value.finalTotal,
    bidValue: result.value.bidValue,
    bidderWins: result.value.bidderWins,
    lifeLoss: lifeLossAmount.value,
    selfIsLoser: selfIsLoser.value,
    eliminated: eliminated.value,
    lifeLostName: result.value.lifeLostName,
  })
})

/** Active calc step index (-1 = not started; steps.length = all done) */
const activeStepIndex = ref(-1)
const calcDone = ref(false)
/** Animated final total (count-up when calc finishes) */
const displayTotal = ref<number | null>(null)
const showConfetti = ref(false)
/** True after count-up finishes — triggers slam + confetti */
const totalRevealDone = ref(false)
/** Full-screen vignette flash on verdict */
const showVignette = ref(false)
/** D3: hold beat after calc before slam */
const holdingBeforeSlam = ref(false)

let stepTimers: ReturnType<typeof setTimeout>[] = []
let holdTimer: ReturnType<typeof setTimeout> | null = null
let countRaf = 0
const resultDeduper = getCoyoteSequenceDeduper()

const STEP_INTERVAL_MS = 480
const STEP_START_MS = 220
/** Slightly longer count-up on exact / clutch for drama */
const COUNT_UP_MS_BASE = 620
const COUNT_UP_MS_SLOW = 820

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

function clearStepTimers() {
  for (const t of stepTimers) clearTimeout(t)
  stepTimers = []
  clearHoldTimer()
  if (countRaf) {
    cancelAnimationFrame(countRaf)
    countRaf = 0
  }
}

function playVerdictSfx() {
  if (isTabHidden()) return
  playSfx('result_slam')
  // Self-centric win/lose from public selfIsLoser; no private hand info
  const lose = selfIsLoser.value
  // Small delay so slam and verdict don't fully stack
  window.setTimeout(() => {
    playSfx(lose ? 'result_lose' : 'result_win')
  }, 120)
}

/** Jump to final total + life UI (skip / remount / hidden). */
function snapToFinalVerdict(playSfxOnReveal = false) {
  clearStepTimers()
  const r = result.value
  if (!r) return
  activeStepIndex.value = r.calcSteps.length
  calcDone.value = true
  displayTotal.value = r.finalTotal
  totalRevealDone.value = true
  showConfetti.value = true
  showVignette.value = true
  holdingBeforeSlam.value = false
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
    }
  }
  countRaf = requestAnimationFrame(frame)
}

function onCalcDone() {
  calcDone.value = true
  const r = result.value
  if (!r) return

  // Tab hidden or reduced motion: skip hold, still slam quickly
  if (isTabHidden() || prefersReducedMotion()) {
    animateTotalTo(r.finalTotal)
    return
  }

  // Plan §4.7: ~500ms hold (longer for clutch/exact) before total slam
  clearHoldTimer()
  holdingBeforeSlam.value = true
  const holdMs = preSlamHoldMs(marginTier.value)
  holdTimer = setTimeout(() => {
    holdTimer = null
    holdingBeforeSlam.value = false
    animateTotalTo(r.finalTotal)
  }, holdMs)
}

function runCalcSequence() {
  clearStepTimers()
  activeStepIndex.value = -1
  calcDone.value = false
  showConfetti.value = false
  showVignette.value = false
  totalRevealDone.value = false
  displayTotal.value = null
  holdingBeforeSlam.value = false

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

  // Same challenge already finished result sequence → final state only
  if (!resultDeduper.tryConsume(seqId)) {
    snapToFinalVerdict(false)
    markResultSequencePlayed(challengeKey)
    return
  }
  markResultSequencePlayed(challengeKey)

  // Hidden tab: converge immediately
  if (isTabHidden()) {
    snapToFinalVerdict(false)
    return
  }

  const steps = r.calcSteps
  if (steps.length === 0) {
    onCalcDone()
    return
  }

  for (let i = 0; i < steps.length; i++) {
    const t = setTimeout(() => {
      activeStepIndex.value = i
    }, STEP_START_MS + i * STEP_INTERVAL_MS)
    stepTimers.push(t)
  }

  const doneT = setTimeout(() => {
    activeStepIndex.value = steps.length
    onCalcDone()
  }, STEP_START_MS + steps.length * STEP_INTERVAL_MS)
  stepTimers.push(doneT)
}

function stepClass(i: number) {
  if (activeStepIndex.value < 0) return ''
  if (i < activeStepIndex.value) return 'calc-step--done'
  if (i === activeStepIndex.value) return 'calc-step--active'
  return ''
}

function skipCalc() {
  // Skip → correct final total, win/loss, life (plan D3 acceptance)
  snapToFinalVerdict(true)
}

/** Self-perspective: did "あなた" survive / win the challenge? */
const confettiPalette = computed(() => {
  if (localMeta.value.isGameOver) return 'gold' as const
  if (!result.value) return 'mixed' as const
  if (marginTier.value === 'exact' || rareTags.value.includes('perfect')) {
    return 'mixed' as const
  }
  if (hasWildReversal.value) return 'mixed' as const
  // Challenge success → teal; bidder held → gold
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
  // Coyote success (challenger correct) → teal win feel; bidder held → gold
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

// Restart calc only when the challenge identity changes (not peer view noise)
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

  // Production: local result only exists after a local game (DEV)
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

// Only the player who pressed「もう一度遊ぶ」auto-navigates to lobby
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

// Host dissolved room / idle purge during result screen
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
    // Server rematch → lobby (same seats); navigation via status watch
    onlineGame.requestRematch()
    return
  }
  await store.restartLastGame()
  void router.push({ name: 'game' })
}
</script>

<template>
  <div class="page-fixed desert-bg safe-x">
    <AppHeader :sticky="false">
      <template #chips>
        <template v-if="result">
          <StatusChip class="font-mono tracking-wider" :label="result.roomCode" />
          <StatusChip :label="`ラウンド ${result.round}`" />
        </template>
      </template>
      <template #actions>
        <button
          v-if="result && !calcDone"
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
      class="relative z-10 mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto scrollbar-none px-4 py-5 safe-bottom sm:py-6 lg:py-5"
    >
      <!-- Confetti + vignette once calc resolves -->
      <FxConfetti
        v-if="showConfetti"
        class="fixed inset-0 z-20"
        :density="confettiDensity"
        :palette="confettiPalette"
      />
      <div
        v-if="showVignette"
        class="verdict-vignette"
        :class="`verdict-vignette--${vignetteTone}`"
        aria-hidden="true"
      />

      <!-- Single verdict banner (game-over winner folded in) -->
      <section
        class="panel result-banner-in relative mb-5 overflow-hidden p-5 text-center sm:mb-6 sm:p-6"
        :class="[
          localMeta.isGameOver
            ? 'ring-1 ring-gold-400/40'
            : result.bidderWins
              ? 'ring-1 ring-gold-400/35'
              : 'ring-1 ring-teal-soft/45',
          totalRevealDone && !localMeta.isGameOver
            ? result.bidderWins
              ? 'verdict-lose-glow'
              : 'verdict-win-glow'
            : '',
        ]"
      >
        <!-- Game-over (sole winner or multi-survivor first-elimination end) -->
        <template v-if="localMeta.isGameOver">
          <p class="mb-1 text-xs tracking-[0.18em] text-sand-dim">
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
          <p class="mt-2 text-xs text-sand-dim">
            {{
              localMeta.winnerName
                ? '最後の1人が生き残りました。下の「もう一度遊ぶ」から再戦できます。'
                : '誰かがライフを失い切ったため試合が終わりました。下の「もう一度遊ぶ」から再戦できます。'
            }}
          </p>
          <div class="my-4 h-px w-full bg-gold-400/15" />
        </template>

        <p class="mb-1 text-xs tracking-[0.18em] text-sand-dim">
          {{ localMeta.isGameOver ? '最終ラウンド' : 'コヨーテ！ 結果' }}
        </p>
        <h2
          class="font-display font-bold text-gold-200"
          :class="[
            localMeta.isGameOver ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
            totalRevealDone && (marginTier === 'exact' || rareTags.includes('perfect'))
              ? 'total-slam total-slam--exact total-slam--perfect'
              : '',
            totalRevealDone && marginTier === 'clutch' ? 'total-slam--clutch' : '',
            totalRevealDone && hasWildReversal ? 'total-slam--reversal' : '',
            totalRevealDone && hasMaxHeat ? 'total-slam--max-heat' : '',
          ]"
        >
          {{ verdictTitle }}
        </h2>
        <!-- D3 rare tags (PERFECT / CLUTCH / WILD REVERSAL / …) -->
        <div
          v-if="totalRevealDone && rareTags.length"
          class="mt-2 flex flex-wrap items-center justify-center gap-1.5"
        >
          <span
            v-for="tag in rareTags"
            :key="tag"
            class="rare-tag-chip"
            :class="`rare-tag-chip--${tag}`"
          >{{ rareTagLabel(tag) }}</span>
        </div>
        <div
          v-else-if="totalRevealDone && showJapaneseDramaChip && dramaChip"
          class="mt-2 flex justify-center"
        >
          <span
            class="drama-tier-chip"
            :class="`drama-tier-chip--${marginTier}`"
          >{{ dramaChip }}</span>
        </div>
        <p
          v-if="holdingBeforeSlam"
          class="mt-2 text-[11px] tracking-wider text-sand-dim/80"
          aria-hidden="true"
        >
          …
        </p>
        <p class="mt-2 text-sm text-sand-dim">{{ verdictDetail }}</p>

        <div class="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          <div class="flex flex-col items-center gap-1">
            <span class="text-[10px] tracking-wider text-sand-dim">宣言</span>
            <div class="flex items-center gap-2">
              <PlayerAvatar
                :avatar="result.bidderAvatar"
                :avatar-src="result.bidderAvatarSrc"
                :name="result.bidderName"
                size="sm"
                hide-name
              />
              <span class="text-sm font-semibold text-sand">{{ result.bidderName }}</span>
            </div>
            <span class="font-display text-3xl font-bold tabular-nums text-gold-200">{{
              result.bidValue
            }}</span>
          </div>

          <div
            class="flex h-10 w-10 items-center justify-center rounded-full border border-gold-400/20 bg-night-900/60 text-xs font-semibold text-sand-dim"
            aria-hidden="true"
          >
            vs
          </div>

          <div class="flex flex-col items-center gap-1">
            <span class="text-[10px] tracking-wider text-sand-dim">チャレンジ</span>
            <div class="flex items-center gap-2">
              <PlayerAvatar
                :avatar="result.challengerAvatar"
                :avatar-src="result.challengerAvatarSrc"
                :name="result.challengerName"
                size="sm"
                hide-name
              />
              <span class="text-sm font-semibold text-sand">{{ result.challengerName }}</span>
            </div>
            <span class="chip chip-teal">コヨーテ！</span>
          </div>

          <div
            class="flex flex-col items-center gap-1 border-l border-gold-400/15 pl-4 sm:pl-8"
          >
            <span class="text-[10px] tracking-wider text-sand-dim">実際の合計</span>
            <span
              class="font-display text-4xl font-bold tabular-nums text-gold-100 transition-opacity duration-300"
              :class="[
                calcDone || holdingBeforeSlam ? 'opacity-100' : 'opacity-40',
                holdingBeforeSlam ? 'total-hold-pulse' : '',
                totalRevealDone ? 'total-slam' : '',
                totalRevealDone && (marginTier === 'exact' || rareTags.includes('perfect'))
                  ? 'total-slam--exact total-slam--perfect'
                  : '',
                totalRevealDone && marginTier === 'clutch' ? 'total-slam--clutch' : '',
                totalRevealDone && hasWildReversal ? 'total-slam--reversal' : '',
                totalRevealDone && hasMaxHeat ? 'total-slam--max-heat' : '',
                totalRevealDone && hasLastSecond ? 'total-slam--last-second' : '',
              ]"
            >
              {{ displayTotal ?? (holdingBeforeSlam ? '…' : '—') }}
            </span>
          </div>
        </div>

        <!-- Life loss: avatar + hearts + short line (no triple redundancy) -->
        <div
          v-if="totalRevealDone"
          class="life-lost-panel life-lost-pulse mt-6 w-full max-w-md mx-auto rounded-2xl border border-red-400/40 bg-gradient-to-b from-red-950/80 via-night-900/90 to-night-950/95 px-5 py-5 text-center shadow-[0_0_36px_rgba(248,113,113,0.18)] sm:px-8 sm:py-6"
          :class="[
            eliminated ? 'life-lost-panel--ko' : '',
            lifeLossAmount > 1 ? 'life-lost-panel--double' : '',
            hasSurvived ? 'life-lost-panel--survived' : '',
            hasWildReversal ? 'life-lost-panel--reversal' : '',
          ]"
          role="status"
        >
          <div class="life-lost-avatar-wrap mx-auto mb-2 inline-flex">
            <PlayerAvatar
              :avatar="result.lifeLostAvatar"
              :avatar-src="result.lifeLostAvatarSrc"
              :name="result.lifeLostName"
              size="lg"
              hide-name
            />
          </div>

          <p class="life-lost-name font-display text-xl font-bold text-red-50 sm:text-2xl">
            {{ result.lifeLostName }}
          </p>

          <p
            v-if="eliminated"
            class="life-lost-ko-label mt-1 font-display text-lg font-bold tracking-wide text-rose-300 sm:text-xl"
          >
            脱落！
          </p>

          <div
            class="life-lost-hearts mt-3 flex items-center justify-center gap-2 sm:gap-3"
            :aria-label="
              eliminated
                ? `${result.lifeLostName} が脱落した`
                : `${result.lifeLostName} がライフを ${lifeLossAmount} 失った`
            "
          >
            <span
              v-for="i in lifeLossAmount"
              :key="`lost-h-${i}`"
              class="heart-crack life-lost-heart text-4xl leading-none text-rose-400 sm:text-5xl"
              :style="{ animationDelay: `${(i - 1) * 0.12}s` }"
              aria-hidden="true"
              >♥</span
            >
            <!-- SURVIVED: remaining life re-lights -->
            <span
              v-if="hasSurvived"
              class="heart-survive life-lost-heart text-4xl leading-none text-rose-300 sm:text-5xl"
              aria-hidden="true"
              >♥</span
            >
          </div>

          <p class="mt-3 text-sm text-red-200/90 sm:text-base">
            <template v-if="eliminated">ライフ 0</template>
            <template v-else>
              ライフ −{{ lifeLossAmount
              }}<span
                v-if="lifeLossAmount > 1"
                class="ml-1.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200"
                >ダブル</span
              >
              <span
                v-if="hasSurvived"
                class="ml-1.5 rounded-full bg-teal-soft/20 px-2 py-0.5 text-[10px] font-bold text-teal-soft"
                >残り 1</span
              >
            </template>
          </p>
        </div>
      </section>

      <!-- Calculation steps (main animation on this screen) -->
      <section
        class="panel mb-5 p-4 sm:mb-6 sm:p-5"
        :class="hasWildReversal && totalRevealDone ? 'result-calc--reversal' : ''"
      >
        <h3 class="mb-1 text-sm font-semibold text-gold-200">合計の出し方</h3>
        <p class="mb-3 text-[11px] text-sand-dim sm:mb-4">
          特殊札の効果を、決まった順番で適用した結果です
          <span v-if="hasWildReversal" class="text-violet-300"> · 特殊札で勝敗が逆転</span>
        </p>
        <ol class="space-y-2.5 sm:space-y-3">
          <li
            v-for="(step, i) in result.calcSteps"
            :key="step.id"
            class="calc-step"
            :class="[
              stepClass(i),
              hasWildReversal &&
              (step.id === 'double' ||
                step.id === 'half' ||
                step.id === 'multiplier' ||
                step.id === 'max_to_zero') &&
              i <= activeStepIndex
                ? 'calc-step--special-hit'
                : '',
            ]"
          >
            <span class="calc-step__badge">
              <template v-if="i < activeStepIndex">✓</template>
              <template v-else>{{ i + 1 }}</template>
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-sand">{{ step.title }}</div>
              <div class="mt-0.5 text-xs text-sand-dim">{{ step.detail }}</div>
            </div>
            <div
              v-if="step.totalAfter != null"
              class="shrink-0 self-center font-display text-lg font-bold tabular-nums text-gold-200"
              :class="i <= activeStepIndex ? 'opacity-100' : 'opacity-30'"
            >
              {{ step.totalAfter }}
            </div>
          </li>
        </ol>

        <!-- Post-calc summary: secondary after count-up (verdict total is primary) -->
        <div
          v-if="totalRevealDone"
          class="calc-done-pop mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-gold-400/25 bg-night-900/60 px-4 py-3 shadow-[0_0_24px_rgba(201,168,76,0.12)]"
        >
          <span class="text-xs text-sand-dim">最終合計</span>
          <span class="font-display text-2xl font-bold tabular-nums text-gold-100">{{
            displayTotal ?? result.finalTotal
          }}</span>
          <span class="text-sand-dim">vs 宣言</span>
          <span class="font-display text-xl font-bold tabular-nums text-gold-300">{{
            result.bidValue
          }}</span>
          <StatusChip
            :variant="result.bidderWins ? 'gold' : 'teal'"
            class="ml-1 text-[10px]"
            :label="result.bidderWins ? '宣言が通った' : 'コヨーテ成功'"
          />
        </div>
      </section>

      <!-- Card recap (already revealed on game screen) -->
      <section
        class="panel mb-5 p-4 sm:mb-6 sm:p-5"
        :class="
          totalRevealDone && (marginTier === 'exact' || marginTier === 'clutch')
            ? 'result-cards-pulse'
            : ''
        "
      >
        <h3 class="mb-3 text-sm font-semibold text-gold-200">みんなの札（もう一度）</h3>
        <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          <li
            v-for="(card, ci) in result.cards"
            :key="`${card.playerId}-${ci}`"
            class="flex flex-col items-center rounded-xl border border-gold-400/10 bg-night-900/40 px-1.5 py-2"
            :class="card.isSelf ? 'ring-2 ring-teal-soft/55 reveal-seat--self' : ''"
          >
            <PlayerAvatar
              class="mb-0.5"
              :avatar="card.avatar"
              :avatar-src="card.avatarSrc"
              :name="card.playerName"
              :self="card.isSelf"
              size="sm"
              hide-name
            />
            <div
              class="mb-1 max-w-full truncate text-[10px] font-medium"
              :class="card.isSelf ? 'text-teal-soft' : 'text-sand-dim'"
            >
              {{ card.isSelf ? 'あなたの札' : card.playerName }}
            </div>
            <RevealCardTile
              :kind="card.kind"
              :label="card.label"
              :value="card.value"
              size="md"
              :revealed="true"
              :emphasis="cardEmphasis(card)"
            />
          </li>
        </ul>
      </section>

      <!-- Peer rematch: room is lobby; stay on result until they choose -->
      <div
        v-if="isOnline && onlineGame.pendingLobbyReturn"
        class="mb-4 rounded-2xl border border-teal-soft/35 bg-night-900/90 px-4 py-3 text-center"
      >
        <p class="text-sm font-medium text-teal-soft">
          ルームがロビーに戻りました
        </p>
        <p class="mt-1 text-[11px] text-sand-dim">
          誰かが「もう一度遊ぶ」を押しました。結果を見終わったらロビーへどうぞ。
        </p>
        <button
          type="button"
          class="btn-gold mt-3 w-full sm:max-w-xs"
          @click="goToLobbyAfterRematch"
        >
          ロビーへ
        </button>
      </div>

      <!-- Actions: single primary CTA only (no トップへ — easy mis-tap) -->
      <div
        v-else
        class="flex flex-col gap-3 sm:flex-row sm:justify-center"
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
          @click="goNextRound"
        >
          次のラウンドへ
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div
      v-else
      class="relative z-10 mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 safe-bottom sm:py-6"
      aria-busy="true"
      aria-label="結果を読み込み中"
    >
      <div class="panel animate-pulse p-5 sm:p-6">
        <div class="mx-auto mb-3 h-3 w-24 rounded bg-gold-400/15" />
        <div class="mx-auto mb-4 h-8 w-48 rounded-lg bg-gold-400/20" />
        <div class="mx-auto mb-6 h-3 w-64 max-w-full rounded bg-gold-400/10" />
        <div class="flex justify-center gap-6">
          <div class="h-16 w-20 rounded-xl bg-night-800/80" />
          <div class="h-10 w-10 self-center rounded-full bg-night-800/60" />
          <div class="h-16 w-20 rounded-xl bg-night-800/80" />
          <div class="h-16 w-16 rounded-xl bg-night-800/80" />
        </div>
      </div>
      <div class="panel animate-pulse p-4 sm:p-5">
        <div class="mb-3 h-4 w-28 rounded bg-gold-400/15" />
        <div class="space-y-2.5">
          <div class="h-12 rounded-xl bg-night-800/60" />
          <div class="h-12 rounded-xl bg-night-800/50" />
          <div class="h-12 rounded-xl bg-night-800/40" />
        </div>
      </div>
      <p class="text-center text-xs text-sand-dim">結果を読み込んでいます…</p>
    </div>

    <MockBadge />
  </div>
</template>
