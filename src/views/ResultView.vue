<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { mockResult } from '@/data/mockResult'
import { useLocalGameStore } from '@/stores/localGame'
import AppLogo from '@/components/common/AppLogo.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import type { CardKind, ResultMock } from '@/types/game'

const router = useRouter()
const route = useRoute()
const store = useLocalGameStore()
const { resultView, isGameOver } = storeToRefs(store)

const useMock = computed(() => route.query.mock === '1')

const result = computed<ResultMock | null>(() => {
  if (useMock.value) return mockResult
  return resultView.value
})

const localMeta = computed(() => {
  if (useMock.value || !resultView.value) {
    return { isGameOver: false, winnerName: null as string | null }
  }
  return {
    isGameOver: resultView.value.isGameOver || isGameOver.value,
    winnerName: resultView.value.winnerName,
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

function cardTileClass(kind: CardKind) {
  if (kind === 'double') return 'border-teal-soft/50 from-teal-deep/80 to-night-800 text-teal-soft'
  if (kind === 'max_to_zero')
    return 'border-amber-400/40 from-amber-900/40 to-night-800 text-amber-200'
  if (kind === 'redraw') return 'border-gold-400/40 from-night-600 to-night-800 text-gold-200'
  return 'border-gold-300/40 from-gold-50 to-gold-200 text-night-900'
}

onMounted(() => {
  if (!useMock.value && !resultView.value) {
    // No pending result — return to game (or start demo)
    void router.replace({ name: 'game' })
  }
})

function goNextRound() {
  if (useMock.value) {
    void router.push({ name: 'game', query: { mock: '1' } })
    return
  }
  store.clearPendingResult()
  if (isGameOver.value) {
    // Stay informative; user can replay from lobby/home
    void router.push({ name: 'game' })
    return
  }
  void router.push({ name: 'game' })
}

function playAgain() {
  store.startLocalGame()
  void router.push({ name: 'game' })
}

function goHome() {
  void router.push({ name: 'home' })
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col desert-bg">
    <header
      class="flex items-center justify-between gap-3 border-b border-gold-400/15 bg-night-900/70 px-4 py-3 backdrop-blur-md sm:px-6"
    >
      <AppLogo size="sm" />
      <div v-if="result" class="flex items-center gap-2">
        <span class="chip font-mono">{{ result.roomCode }}</span>
        <span class="chip">Round {{ result.round }}</span>
      </div>
    </header>

    <div
      v-if="result"
      class="relative z-10 mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6 sm:py-8"
    >
      <!-- Game over banner -->
      <section
        v-if="localMeta.isGameOver"
        class="panel mb-4 overflow-hidden p-4 text-center ring-1 ring-gold-400/40 sm:p-5"
      >
        <p class="text-xs uppercase tracking-wider text-sand-dim">Winner</p>
        <h2 class="font-display text-2xl font-bold text-gold-100 sm:text-3xl">
          {{ localMeta.winnerName ?? '勝者' }} の勝利！
        </h2>
      </section>

      <!-- Verdict banner -->
      <section
        class="panel mb-6 overflow-hidden p-5 text-center sm:p-6"
        :class="result.bidderWins ? 'ring-1 ring-gold-400/30' : 'ring-1 ring-teal-soft/40'"
      >
        <p class="mb-1 text-xs uppercase tracking-wider text-sand-dim">コヨーテ！ 結果</p>
        <h2 class="font-display text-2xl font-bold text-gold-200 sm:text-3xl">
          {{ verdictTitle }}
        </h2>
        <p class="mt-2 text-sm text-sand-dim">{{ verdictDetail }}</p>

        <div class="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          <div class="flex flex-col items-center gap-1">
            <span class="text-[10px] text-sand-dim">宣言</span>
            <div class="flex items-center gap-2">
              <span class="text-2xl" aria-hidden="true">{{ result.bidderAvatar }}</span>
              <span class="text-sm font-semibold text-sand">{{ result.bidderName }}</span>
            </div>
            <span class="font-display text-3xl font-bold text-gold-200">{{
              result.bidValue
            }}</span>
          </div>

          <div class="text-sand-dim" aria-hidden="true">vs</div>

          <div class="flex flex-col items-center gap-1">
            <span class="text-[10px] text-sand-dim">チャレンジ</span>
            <div class="flex items-center gap-2">
              <span class="text-2xl" aria-hidden="true">{{ result.challengerAvatar }}</span>
              <span class="text-sm font-semibold text-sand">{{ result.challengerName }}</span>
            </div>
            <span class="text-xs text-sand-dim">コヨーテ！</span>
          </div>

          <div
            class="flex flex-col items-center gap-1 border-l border-gold-400/15 pl-4 sm:pl-8"
          >
            <span class="text-[10px] text-sand-dim">実際の合計</span>
            <span class="font-display text-4xl font-bold text-gold-100">{{
              result.finalTotal
            }}</span>
          </div>
        </div>

        <p
          class="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-950/40 px-3 py-1 text-xs text-red-200"
        >
          <span aria-hidden="true">{{ result.lifeLostAvatar }}</span>
          {{ result.lifeLostName }} がライフを 1 失った
        </p>
      </section>

      <!-- Revealed cards -->
      <section class="panel mb-6 p-4 sm:p-5">
        <h3 class="mb-4 text-sm font-semibold text-gold-200">カード公開</h3>
        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <li
            v-for="card in result.cards"
            :key="card.playerId"
            class="flex flex-col items-center rounded-xl border border-gold-400/10 bg-night-900/40 px-2 py-3"
            :class="card.isSelf ? 'ring-1 ring-teal-soft/40' : ''"
          >
            <div class="mb-1 text-xl" aria-hidden="true">{{ card.avatar }}</div>
            <div
              class="mb-1 truncate text-[11px] font-medium"
              :class="card.isSelf ? 'text-teal-soft' : 'text-sand-dim'"
            >
              {{ card.playerName }}
            </div>
            <div
              class="flex h-12 w-11 items-center justify-center rounded-lg border bg-gradient-to-b font-display text-sm font-bold shadow-md"
              :class="cardTileClass(card.kind)"
            >
              {{ card.label }}
            </div>
          </li>
        </ul>
      </section>

      <!-- Calculation steps from engine -->
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
            class="flex gap-3 rounded-xl border border-gold-400/10 bg-night-900/50 p-3"
          >
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night-700 text-xs font-bold text-gold-300 ring-1 ring-gold-400/30"
            >
              {{ i + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-sand">{{ step.title }}</div>
              <div class="mt-0.5 text-xs text-sand-dim">{{ step.detail }}</div>
            </div>
            <div
              v-if="step.totalAfter != null"
              class="shrink-0 self-center font-display text-lg font-bold text-gold-200"
            >
              {{ step.totalAfter }}
            </div>
          </li>
        </ol>
      </section>

      <!-- Actions -->
      <div class="flex flex-col gap-3 safe-bottom sm:flex-row sm:justify-center">
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
          {{ useMock ? '次のラウンドへ（モック）' : '次のラウンドへ' }}
        </button>
        <button type="button" class="btn-ghost w-full sm:w-auto" @click="goHome">
          トップへ
        </button>
      </div>
    </div>

    <div
      v-else
      class="flex flex-1 items-center justify-center text-sm text-sand-dim"
    >
      結果を読み込み中…
    </div>

    <MockBadge />
  </div>
</template>
