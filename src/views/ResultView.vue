<script setup lang="ts">
/**
 * Result screen after game-side card reveal.
 * Focus: verdict + calculation steps (cards are a static recap).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { mockResult } from '@/data/mockResult'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'
import AppLogo from '@/components/common/AppLogo.vue'
import FxConfetti from '@/components/common/FxConfetti.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'
import RevealCardTile from '@/components/game/RevealCardTile.vue'
import { allowLocalPlay, allowUiMock } from '@/config/runtime'
import type { ResultMock } from '@/types/game'

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

const verdictTitle = computed(() => {
  if (!result.value) return ''
  if (localMeta.value.isGameOver) return 'ゲーム終了'
  return result.value.bidderWins ? '宣言が通った！' : 'コヨーテ成功！'
})

const lifeLossAmount = computed(() => {
  const n = result.value?.lifeLoss
  return typeof n === 'number' && n > 0 ? n : 1
})

const verdictDetail = computed(() => {
  if (!result.value) return ''
  const loss = lifeLossAmount.value
  const lossPhrase =
    loss > 1 ? `ライフを ${loss} 失います（ダブル）` : 'ライフを失います'
  if (result.value.bidderWins) {
    return `合計 ${result.value.finalTotal} は宣言 ${result.value.bidValue} 以上 → チャレンジした人が${lossPhrase}`
  }
  return `合計 ${result.value.finalTotal} は宣言 ${result.value.bidValue} より小さい → 宣言した人が${lossPhrase}`
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

let stepTimers: ReturnType<typeof setTimeout>[] = []
let countRaf = 0

const STEP_INTERVAL_MS = 480
const STEP_START_MS = 220
const COUNT_UP_MS = 620

function clearStepTimers() {
  for (const t of stepTimers) clearTimeout(t)
  stepTimers = []
  if (countRaf) {
    cancelAnimationFrame(countRaf)
    countRaf = 0
  }
}

function animateTotalTo(target: number) {
  if (countRaf) cancelAnimationFrame(countRaf)
  totalRevealDone.value = false
  const prefersReduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduce) {
    displayTotal.value = target
    totalRevealDone.value = true
    showConfetti.value = true
    showVignette.value = true
    return
  }

  const start = performance.now()
  const from = 0
  const span = target - from

  function frame(now: number) {
    const t = Math.min(1, (now - start) / COUNT_UP_MS)
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
    }
  }
  countRaf = requestAnimationFrame(frame)
}

function onCalcDone() {
  calcDone.value = true
  const r = result.value
  if (!r) return
  animateTotalTo(r.finalTotal)
}

function runCalcSequence() {
  clearStepTimers()
  activeStepIndex.value = -1
  calcDone.value = false
  showConfetti.value = false
  showVignette.value = false
  totalRevealDone.value = false
  displayTotal.value = null

  const r = result.value
  if (!r) return

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
  clearStepTimers()
  if (result.value) {
    activeStepIndex.value = result.value.calcSteps.length
    onCalcDone()
  }
}

/** Self-perspective: did "あなた" survive / win the challenge? */
const confettiPalette = computed(() => {
  if (localMeta.value.isGameOver) return 'gold' as const
  if (!result.value) return 'mixed' as const
  // Challenge success → teal; bidder held → gold
  return result.value.bidderWins ? ('gold' as const) : ('teal' as const)
})

const confettiDensity = computed(() =>
  localMeta.value.isGameOver ? ('lg' as const) : ('md' as const),
)

const vignetteTone = computed(() => {
  if (localMeta.value.isGameOver) return 'gameover' as const
  if (!result.value) return 'win' as const
  // Coyote success (challenger correct) → teal win feel; bidder held → gold
  return result.value.bidderWins ? ('lose' as const) : ('win' as const)
})

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
}</script>

<template>
  <div class="page-fixed desert-bg safe-x">
    <!-- safe-top on outer, py-3 on inner (same pattern as Lobby / Game) -->
    <header
      class="shrink-0 border-b border-gold-400/15 bg-night-900/90 backdrop-blur-md safe-top"
    >
      <div class="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <AppLogo size="sm" />
        <div v-if="result" class="flex items-center gap-2">
          <span class="chip font-mono">{{ result.roomCode }}</span>
          <span class="chip">Round {{ result.round }}</span>
          <button
            v-if="!calcDone"
            type="button"
            class="btn-ghost !px-2 !py-1 text-[11px]"
            @click="skipCalc"
          >
            スキップ
          </button>
        </div>
      </div>
    </header>

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

      <!-- Game over banner -->
      <section
        v-if="localMeta.isGameOver"
        class="panel result-banner-in relative mb-4 overflow-hidden p-4 text-center ring-1 ring-gold-400/40 sm:p-5"
      >
        <p class="text-xs uppercase tracking-[0.2em] text-sand-dim">Winner</p>
        <h2
          class="font-display text-2xl font-bold text-gold-100 sm:text-3xl"
          :class="totalRevealDone || showConfetti ? 'total-slam' : ''"
        >
          {{ localMeta.winnerName ?? '勝者' }} の勝利！
        </h2>
        <p class="mt-2 text-xs text-sand-dim">
          最後の1人が生き残りました。下の「もう一度遊ぶ」から再戦できます。
        </p>
      </section>

      <!-- Verdict banner (main “結果”) -->
      <section
        class="panel result-banner-in relative mb-6 overflow-hidden p-5 text-center sm:p-6"
        :class="[
          result.bidderWins ? 'ring-1 ring-gold-400/35' : 'ring-1 ring-teal-soft/45',
          totalRevealDone
            ? result.bidderWins
              ? 'verdict-lose-glow'
              : 'verdict-win-glow'
            : '',
        ]"
        style="animation-delay: 60ms"
      >
        <p class="mb-1 text-xs uppercase tracking-[0.18em] text-sand-dim">コヨーテ！ 結果</p>
        <h2 class="font-display text-2xl font-bold text-gold-200 sm:text-3xl">
          {{ verdictTitle }}
        </h2>
        <p class="mt-2 text-sm text-sand-dim">{{ verdictDetail }}</p>

        <div class="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          <div class="flex flex-col items-center gap-1">
            <span class="text-[10px] uppercase tracking-wider text-sand-dim">宣言</span>
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
            <span class="text-[10px] uppercase tracking-wider text-sand-dim">チャレンジ</span>
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
            <span class="chip !border-teal-soft/35 !bg-teal-deep/40 !text-teal-soft">コヨーテ！</span>
          </div>

          <div
            class="flex flex-col items-center gap-1 border-l border-gold-400/15 pl-4 sm:pl-8"
          >
            <span class="text-[10px] uppercase tracking-wider text-sand-dim">実際の合計</span>
            <span
              class="font-display text-4xl font-bold tabular-nums text-gold-100 transition-opacity duration-300"
              :class="[
                calcDone ? 'opacity-100' : 'opacity-40',
                totalRevealDone ? 'total-slam' : '',
              ]"
            >
              {{ displayTotal ?? '—' }}
            </span>
          </div>
        </div>

        <div
          v-if="totalRevealDone"
          class="life-lost-panel life-lost-pulse mt-6 w-full max-w-md mx-auto rounded-2xl border border-red-400/40 bg-gradient-to-b from-red-950/80 via-night-900/90 to-night-950/95 px-5 py-5 text-center shadow-[0_0_36px_rgba(248,113,113,0.18)] sm:px-8 sm:py-6"
          role="status"
        >
          <p
            class="life-lost-label mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-red-300/90"
          >
            ライフ −{{ lifeLossAmount
            }}<span
              v-if="lifeLossAmount > 1"
              class="ml-1.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-amber-200"
              >ダブル</span
            >
          </p>

          <div class="life-lost-avatar-wrap mx-auto mb-2 inline-flex">
            <PlayerAvatar
              :avatar="result.lifeLostAvatar"
              :avatar-src="result.lifeLostAvatarSrc"
              :name="result.lifeLostName"
              size="lg"
              hide-name
            />
          </div>

          <p
            class="life-lost-name font-display text-xl font-bold text-red-50 sm:text-2xl"
          >
            {{ result.lifeLostName }}
          </p>

          <div
            class="life-lost-hearts mt-3 flex items-center justify-center gap-2 sm:gap-3"
            :aria-label="`ライフ ${lifeLossAmount} 失った`"
          >
            <span
              v-for="i in lifeLossAmount"
              :key="`lost-h-${i}`"
              class="heart-crack life-lost-heart text-4xl leading-none text-rose-400 sm:text-5xl"
              :style="{ animationDelay: `${(i - 1) * 0.12}s` }"
              aria-hidden="true"
              >♥</span
            >
          </div>

          <p class="mt-3 text-sm text-red-200/90 sm:text-base">
            ライフを
            <span class="font-display text-lg font-bold tabular-nums text-rose-300">{{
              lifeLossAmount
            }}</span>
            失いました
          </p>
        </div>
      </section>

      <!-- Calculation steps (main animation on this screen) -->
      <section class="panel mb-5 p-4 sm:mb-6 sm:p-5">
        <h3 class="mb-1 text-sm font-semibold text-gold-200">合計の出し方</h3>
        <p class="mb-3 text-[11px] text-sand-dim sm:mb-4">
          特殊札の効果を、決まった順番で適用した結果です
        </p>
        <ol class="space-y-2.5 sm:space-y-3">
          <li
            v-for="(step, i) in result.calcSteps"
            :key="step.id"
            class="calc-step"
            :class="stepClass(i)"
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

        <div
          v-if="totalRevealDone"
          class="calc-done-pop mt-4 flex items-center justify-center gap-2 rounded-xl border border-gold-400/25 bg-night-900/60 px-4 py-3 shadow-[0_0_24px_rgba(201,168,76,0.12)]"
        >
          <span class="text-xs text-sand-dim">最終合計</span>
          <span class="total-slam font-display text-2xl font-bold tabular-nums text-gold-100">{{
            displayTotal ?? result.finalTotal
          }}</span>
          <span class="text-sand-dim">vs 宣言</span>
          <span class="font-display text-xl font-bold tabular-nums text-gold-300">{{
            result.bidValue
          }}</span>
          <span
            class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            :class="
              result.bidderWins
                ? 'bg-gold-400/20 text-gold-200'
                : 'bg-teal-deep/50 text-teal-soft'
            "
          >
            {{ result.bidderWins ? '宣言が通った' : 'コヨーテ成功' }}
          </span>
        </div>
      </section>

      <!-- Card recap (already revealed on game screen) -->
      <section class="panel mb-5 p-4 sm:mb-6 sm:p-5">
        <h3 class="mb-3 text-sm font-semibold text-gold-200">みんなの札（もう一度）</h3>
        <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          <li
            v-for="card in result.cards"
            :key="card.playerId"
            class="flex flex-col items-center rounded-xl border border-gold-400/10 bg-night-900/40 px-1.5 py-2"
            :class="card.isSelf ? 'ring-1 ring-teal-soft/40' : ''"
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
              {{ card.playerName }}
            </div>
            <RevealCardTile
              :kind="card.kind"
              :label="card.label"
              :value="card.value"
              size="md"
              :revealed="true"
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

    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center text-sm text-sand-dim"
    >
      結果を読み込んでいます…
    </div>

    <MockBadge />
  </div>
</template>
