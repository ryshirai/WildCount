<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { mockGameRoom } from '@/data/mockGame'
import { useLocalGameStore } from '@/stores/localGame'
import GameHeader from '@/components/game/GameHeader.vue'
import PlayerCircle from '@/components/game/PlayerCircle.vue'
import CurrentBidDisplay from '@/components/game/CurrentBidDisplay.vue'
import EventLog from '@/components/game/EventLog.vue'
import BidControls from '@/components/game/BidControls.vue'
import MobilePlayerCarousel from '@/components/game/MobilePlayerCarousel.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import type { GameRoomMock } from '@/types/game'

const router = useRouter()
const route = useRoute()
const store = useLocalGameStore()
const {
  gameView,
  pendingResult,
  hasSession,
  botsRunning,
  statusMessage,
  awaitingResultView,
} = storeToRefs(store)

const useMock = computed(() => route.query.mock === '1')

const toast = ref<string | null>(null)
const mobileTab = ref<'chat' | 'players' | 'log'>('players')
const draftBid = ref(0)
const acting = ref(false)

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

const minBid = computed(() => {
  if (useMock.value) return mockGameRoom.draftBid
  return gameView.value?.minBid ?? 1
})

const isGameOver = computed(() => {
  if (useMock.value) return false
  return gameView.value?.isGameOver ?? false
})

const paceHint = computed(() => {
  if (useMock.value) return null
  if (awaitingResultView.value) {
    return statusMessage.value ?? 'コヨーテ！ 結果を確認してください'
  }
  if (statusMessage.value) return statusMessage.value
  if (botsRunning.value) return 'ボット進行中…'
  if (gameView.value?.isSelfTurn) return 'あなたの手番です'
  return null
})

const coyoteBanner = computed(() => {
  if (useMock.value || !pendingResult.value) return null
  const r = pendingResult.value
  return {
    challenger: `${r.challengerAvatar} ${r.challengerName}`,
    bidder: `${r.bidderAvatar} ${r.bidderName}`,
    bid: r.bidValue,
  }
})

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

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = null
  }, 2200)
}

function openResult() {
  void router.push({ name: 'result' })
}

onMounted(() => {
  void bootstrap()
})

async function bootstrap() {
  if (useMock.value) {
    draftBid.value = mockGameRoom.draftBid
    return
  }
  // Challenge already pending — stay here and show “結果を見る”
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

async function onDeclare(value: number) {
  if (useMock.value) {
    showToast(`（モック）宣言: ${value}`)
    return
  }
  if (isGameOver.value) {
    showToast('ゲームは終了しています')
    return
  }
  if (busy.value) return
  acting.value = true
  try {
    await store.placeBid(value)
    if (gameView.value) draftBid.value = gameView.value.draftBid
  } catch (e) {
    showToast(e instanceof Error ? e.message : '宣言に失敗しました')
  } finally {
    acting.value = false
  }
}

async function onChallenge() {
  if (useMock.value) {
    showToast('（モック）コヨーテ！')
    // Mock: still require a button — set via toast only; use link
    return
  }
  if (isGameOver.value) {
    showToast('ゲームは終了しています')
    return
  }
  if (busy.value) return
  acting.value = true
  try {
    await store.challenge()
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'チャレンジに失敗しました')
  } finally {
    acting.value = false
  }
}
</script>

<template>
  <div class="relative flex h-full min-h-dvh flex-col overflow-hidden desert-bg">
    <template v-if="room">
      <!-- Pace / turn status -->
      <div
        v-if="paceHint"
        class="relative z-20 flex items-center justify-center gap-2.5 border-b px-3 py-2.5 text-center text-sm font-medium backdrop-blur-md"
        :class="
          awaitingResultView
            ? 'border-teal-soft/35 bg-teal-deep/40 text-teal-soft'
            : botsRunning
              ? 'border-gold-400/30 bg-night-800/90 text-gold-200'
              : 'border-gold-400/20 bg-night-900/90 text-teal-soft'
        "
        role="status"
        aria-live="polite"
      >
        <span
          v-if="botsRunning"
          class="inline-flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-gold-300 shadow-[0_0_8px_rgba(201,168,76,0.7)]"
          aria-hidden="true"
        />
        <span
          v-else-if="awaitingResultView"
          class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-teal-soft shadow-[0_0_8px_rgba(42,138,138,0.6)]"
          aria-hidden="true"
        />
        <span
          v-else
          class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-teal-soft/80"
          aria-hidden="true"
        />
        {{ paceHint }}
      </div>

      <!-- Coyote: wait for player before result screen -->
      <div
        v-if="coyoteBanner"
        class="relative z-20 border-b border-teal-soft/40 bg-gradient-to-b from-teal-deep/50 to-night-900/98 px-4 py-5 sm:py-6"
      >
        <div class="mx-auto flex max-w-md flex-col items-center gap-3.5 text-center">
          <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-sand-dim">
            チャレンジ成立
          </p>
          <p
            class="font-display text-2xl font-bold text-teal-soft sm:text-3xl"
            style="text-shadow: 0 0 24px rgba(42, 138, 138, 0.45)"
          >
            コヨーテ！
          </p>
          <p class="max-w-sm text-sm leading-relaxed text-sand-dim">
            <span class="font-medium text-sand">{{ coyoteBanner.challenger }}</span>
            が
            <span class="font-medium text-sand">{{ coyoteBanner.bidder }}</span>
            の宣言
            <span class="mx-0.5 inline-flex items-center rounded-md border border-gold-400/40 bg-night-900/80 px-1.5 py-0.5 font-display text-base font-bold text-gold-200">
              {{ coyoteBanner.bid }}
            </span>
            にチャレンジ
          </p>
          <button
            type="button"
            class="btn-gold mt-1 w-full max-w-xs !py-3.5 text-base shadow-gold-glow"
            @click="openResult"
          >
            結果を見る
          </button>
        </div>
      </div>

      <!-- ========== Desktop / tablet layout ========== -->
      <div class="hidden h-full min-h-0 flex-1 flex-col lg:flex">
        <GameHeader
          :room-code="room.roomCode"
          :player-count="room.playerCount"
          :round="room.round"
        />

        <div class="relative flex min-h-0 flex-1">
          <main class="relative flex min-w-0 flex-1 flex-col">
            <div class="relative flex flex-1 items-center justify-center px-4 py-6">
              <div class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
                <CurrentBidDisplay
                  :current-bid="room.currentBid"
                  :turns-until-self="room.turnsUntilSelf"
                />
              </div>

              <PlayerCircle :players="room.players" class="relative z-10" />
            </div>

            <div
              v-if="isGameOver && !awaitingResultView"
              class="mx-4 mb-2 rounded-xl border border-gold-400/30 bg-night-900/90 px-4 py-3 text-center text-sm text-gold-100"
            >
              ゲーム終了 — 結果画面で勝者を確認してください
            </div>

            <BidControls
              v-if="!awaitingResultView"
              v-model="draftBid"
              :min-bid="minBid"
              :can-declare="canDeclare"
              :can-challenge="canChallenge"
              @declare="onDeclare"
              @challenge="onChallenge"
            />
          </main>

          <div class="w-72 shrink-0 border-l border-gold-400/10 p-3 xl:w-80">
            <EventLog :items="room.eventLog" />
          </div>
        </div>
      </div>

      <!-- ========== Mobile layout ========== -->
      <div class="flex h-full min-h-0 flex-1 flex-col lg:hidden">
        <GameHeader
          mobile
          :room-code="room.roomCode"
          :player-count="room.playerCount"
          :round="room.round"
          :connection-status="room.connectionStatus"
        />

        <MobilePlayerCarousel :players="room.players" />

        <div
          class="flex items-center justify-between gap-2 border-b border-gold-400/10 bg-night-950/30 px-4 py-1.5 text-xs text-sand-dim"
        >
          <span class="chip !px-2 !py-0.5 !text-[10px]">
            {{ room.players.filter((p) => p.hasDeclared).length }}/{{ room.playerCount }} 宣言
          </span>
          <span>
            あなたまであと
            <span class="font-semibold text-gold-200">{{ room.turnsUntilSelf }}人</span>
          </span>
          <span class="text-[10px] text-sand-dim/80">自分の札は？</span>
        </div>

        <main class="flex flex-1 flex-col items-center justify-center px-4 py-4">
          <div class="panel w-full max-w-sm px-6 py-8 shadow-panel">
            <CurrentBidDisplay
              compact
              :show-turns-hint="false"
              :current-bid="room.currentBid"
            />
          </div>
        </main>

        <BidControls
          v-if="!awaitingResultView"
          v-model="draftBid"
          mobile
          :min-bid="minBid"
          :can-declare="canDeclare"
          :can-challenge="canChallenge"
          @declare="onDeclare"
          @challenge="onChallenge"
        />

        <nav
          class="flex border-t border-gold-400/15 bg-night-950/95 safe-bottom"
          aria-label="モバイルメニュー"
        >
          <button
            type="button"
            class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition"
            :class="mobileTab === 'chat' ? 'text-gold-200' : 'text-sand-dim'"
            @click="
              mobileTab = 'chat';
              showToast('チャットはMVP外です')
            "
          >
            <span class="text-base">💬</span>
            チャット
          </button>
          <button
            type="button"
            class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition"
            :class="mobileTab === 'players' ? 'text-gold-200' : 'text-sand-dim'"
            @click="mobileTab = 'players'"
          >
            <span class="text-base">👥</span>
            プレイヤー一覧
          </button>
          <button
            type="button"
            class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition"
            :class="mobileTab === 'log' ? 'text-gold-200' : 'text-sand-dim'"
            @click="mobileTab = 'log'"
          >
            <span class="text-base">☰</span>
            イベントログ
          </button>
        </nav>

        <div
          v-if="mobileTab === 'log'"
          class="absolute inset-x-0 bottom-16 top-24 z-20 px-3"
        >
          <EventLog :items="room.eventLog" class="h-full" />
        </div>
      </div>
    </template>

    <div
      v-else
      class="flex flex-1 items-center justify-center text-sm text-sand-dim"
    >
      セッションを準備中…
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast"
        class="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-gold-400/30 bg-night-800/95 px-4 py-2 text-sm text-gold-100 shadow-panel lg:bottom-28"
      >
        {{ toast }}
      </div>
    </Transition>

    <nav
      class="pointer-events-auto fixed bottom-3 right-3 z-30 hidden gap-1.5 lg:flex"
      aria-label="画面リンク"
    >
      <RouterLink to="/" class="btn-ghost !px-2 !py-1 text-[10px]">トップ</RouterLink>
      <RouterLink to="/lobby" class="btn-ghost !px-2 !py-1 text-[10px]">ロビー</RouterLink>
    </nav>

    <MockBadge />
  </div>
</template>
