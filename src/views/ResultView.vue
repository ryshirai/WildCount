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
import MockBadge from '@/components/common/MockBadge.vue'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'
import RevealCardTile from '@/components/game/RevealCardTile.vue'
import type { ResultMock } from '@/types/game'

const router = useRouter()
const route = useRoute()
const store = useLocalGameStore()
const onlineGame = useOnlineGameStore()
const { resultView, isGameOver } = storeToRefs(store)

const useMock = computed(() => route.query.mock === '1')
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
    isGameOver:
      r.isGameOver ||
      (isOnline.value ? onlineGame.isGameOver : isGameOver.value),
    winnerName: r.winnerName,
  }
})

const verdictTitle = computed(() => {
  if (!result.value) return ''
  if (localMeta.value.isGameOver) return 'ゲーム終了'
  return result.value.bidderWins ? '宣言側の勝ち' : 'チャレンジ成功'
})

const verdictDetail = computed(() => {
  if (!result.value) return ''
  if (result.value.bidderWins) {
    return `合計 ${result.value.finalTotal} ≥ 宣言 ${result.value.bidValue} → チャレンジャーがライフを失う`
  }
  return `合計 ${result.value.finalTotal} < 宣言 ${result.value.bidValue} → 宣言者がライフを失う`
})

/** Active calc step index (-1 = not started; steps.length = all done) */
const activeStepIndex = ref(-1)
const calcDone = ref(false)

let stepTimers: ReturnType<typeof setTimeout>[] = []

const STEP_INTERVAL_MS = 480
const STEP_START_MS = 220

function clearStepTimers() {
  for (const t of stepTimers) clearTimeout(t)
  stepTimers = []
}

function runCalcSequence() {
  clearStepTimers()
  activeStepIndex.value = -1
  calcDone.value = false

  const r = result.value
  if (!r) return

  const steps = r.calcSteps
  if (steps.length === 0) {
    calcDone.value = true
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
    calcDone.value = true
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
    calcDone.value = true
  }
}

watch(
  result,
  () => {
    runCalcSequence()
  },
  { immediate: true },
)

onMounted(() => {
  void bootstrapResult()
})

async function bootstrapResult() {
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

  if (!activeResult.value) {
    void router.replace({ name: 'game' })
  }
}

onUnmounted(() => {
  clearStepTimers()
})

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
    // Online: leave and recreate from home (no server rematch yet)
    onlineGame.leave()
    void router.push({ name: 'home' })
    return
  }
  await store.restartLastGame()
  void router.push({ name: 'game' })
}

function goHome() {
  if (useMock.value) {
    void router.push({ name: 'home' })
    return
  }
  if (isOnline.value) {
    onlineGame.clearPendingResult()
    onlineGame.leave()
    void router.push({ name: 'home' })
    return
  }
  store.clearPendingResult()
  store.resetSession()
  void router.push({ name: 'home' })
}</script>

<template>
  <div class="page-fixed desert-bg safe-x">
    <header
      class="flex shrink-0 items-center justify-between gap-3 border-b border-gold-400/15 bg-night-900/90 px-4 py-3 backdrop-blur-md safe-top sm:px-6"
    >
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
    </header>

    <div
      v-if="result"
      class="relative z-10 mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto px-4 py-6 safe-bottom sm:py-8"
    >
      <!-- Game over banner -->
      <section
        v-if="localMeta.isGameOver"
        class="panel result-banner-in mb-4 overflow-hidden p-4 text-center ring-1 ring-gold-400/40 sm:p-5"
      >
        <p class="text-xs uppercase tracking-[0.2em] text-sand-dim">Winner</p>
        <h2 class="font-display text-2xl font-bold text-gold-100 sm:text-3xl">
          {{ localMeta.winnerName ?? '勝者' }} の勝利！
        </h2>
        <p class="mt-2 text-xs text-sand-dim">
          最後の1人が生き残りました。下からもう一度遊ぶか、トップへ戻れます。
        </p>
      </section>

      <!-- Verdict banner (main “結果”) -->
      <section
        class="panel result-banner-in mb-6 overflow-hidden p-5 text-center sm:p-6"
        :class="result.bidderWins ? 'ring-1 ring-gold-400/35' : 'ring-1 ring-teal-soft/45'"
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
              class="font-display text-4xl font-bold tabular-nums text-gold-100 transition-opacity duration-500"
              :class="calcDone ? 'opacity-100' : 'opacity-40'"
            >
              {{ result.finalTotal }}
            </span>
          </div>
        </div>

        <div
          class="life-lost-pulse mt-5 inline-flex max-w-full items-center gap-2 rounded-2xl border border-red-400/35 bg-gradient-to-r from-red-950/70 to-night-900/80 px-4 py-2.5 text-sm text-red-100 shadow-[0_0_24px_rgba(248,113,113,0.12)]"
          style="animation-delay: 400ms"
        >
          <PlayerAvatar
            :avatar="result.lifeLostAvatar"
            :avatar-src="result.lifeLostAvatarSrc"
            :name="result.lifeLostName"
            size="sm"
            hide-name
          />
          <div class="min-w-0 text-left">
            <p class="text-[10px] uppercase tracking-wider text-red-300/80">ライフ −1</p>
            <p class="truncate font-semibold">
              {{ result.lifeLostName }}
              <span class="font-normal text-red-200/90">がライフを 1 失った</span>
            </p>
          </div>
          <span class="ml-1 text-lg leading-none text-rose-400" aria-hidden="true">♥</span>
        </div>
      </section>

      <!-- Calculation steps (main animation on this screen) -->
      <section class="panel mb-6 p-4 sm:p-5">
        <h3 class="mb-1 text-sm font-semibold text-gold-200">合計計算の過程</h3>
        <p class="mb-4 text-[11px] text-sand-dim">
          {{
            useMock
              ? '仮置き表示（docs/game-rules.md の順序）。?mock=1'
              : 'エンジン calculation 由来（docs/game-rules.md の順序）'
          }}
        </p>
        <ol class="space-y-3">
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
          v-if="calcDone"
          class="mt-4 flex items-center justify-center gap-2 rounded-xl border border-gold-400/25 bg-night-900/60 px-4 py-3"
        >
          <span class="text-xs text-sand-dim">最終合計</span>
          <span class="font-display text-2xl font-bold tabular-nums text-gold-100">{{
            result.finalTotal
          }}</span>
          <span class="text-sand-dim">vs 宣言</span>
          <span class="font-display text-xl font-bold tabular-nums text-gold-300">{{
            result.bidValue
          }}</span>
        </div>
      </section>

      <!-- Card recap (already revealed on game screen) -->
      <section class="panel mb-6 p-4 sm:p-5">
        <h3 class="mb-3 text-sm font-semibold text-gold-200">公開カード（再掲）</h3>
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

      <!-- Actions -->
      <div class="flex flex-col gap-3 safe-bottom sm:flex-row sm:justify-center">
        <template v-if="localMeta.isGameOver && !useMock">
          <button
            type="button"
            class="btn-gold w-full sm:max-w-xs"
            @click="playAgain"
          >
            もう一度遊ぶ
          </button>
          <button type="button" class="btn-teal w-full sm:max-w-xs" @click="goHome">
            トップへ
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="btn-gold w-full sm:max-w-xs"
            @click="goNextRound"
          >
            {{ useMock ? '次のラウンドへ（モック）' : '次のラウンドへ' }}
          </button>
          <button type="button" class="btn-ghost w-full sm:w-auto" @click="goHome">
            トップへ
          </button>
        </template>
      </div>
    </div>

    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center text-sm text-sand-dim"
    >
      結果を読み込み中…
    </div>

    <MockBadge />
  </div>
</template>
