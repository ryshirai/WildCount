<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { mockGameRoom } from '@/data/mockGame'
import GameHeader from '@/components/game/GameHeader.vue'
import PlayerCircle from '@/components/game/PlayerCircle.vue'
import CurrentBidDisplay from '@/components/game/CurrentBidDisplay.vue'
import EventLog from '@/components/game/EventLog.vue'
import BidControls from '@/components/game/BidControls.vue'
import MobilePlayerCarousel from '@/components/game/MobilePlayerCarousel.vue'
import MockBadge from '@/components/common/MockBadge.vue'

const router = useRouter()
const room = reactive({ ...mockGameRoom })
const draftBid = ref(room.draftBid)
const toast = ref<string | null>(null)
const mobileTab = ref<'chat' | 'players' | 'log'>('players')

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = null
  }, 2200)
}

function onDeclare(value: number) {
  showToast(`（モック）宣言: ${value}`)
}

function onChallenge() {
  showToast('（モック）コヨーテ！→ 結果画面へ')
  window.setTimeout(() => {
    void router.push({ name: 'result' })
  }, 600)
}
</script>

<template>
  <div class="relative flex h-full min-h-dvh flex-col overflow-hidden desert-bg">
    <!-- ========== Desktop / tablet layout ========== -->
    <div class="hidden h-full min-h-dvh flex-col lg:flex">
      <GameHeader
        :room-code="room.roomCode"
        :player-count="room.playerCount"
        :round="room.round"
      />

      <div class="relative flex min-h-0 flex-1">
        <!-- Board -->
        <main class="relative flex min-w-0 flex-1 flex-col">
          <div class="relative flex flex-1 items-center justify-center px-4 py-6">
            <!-- Center bid overlaid on circle -->
            <div class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
              <CurrentBidDisplay
                :current-bid="room.currentBid"
                :turns-until-self="room.turnsUntilSelf"
              />
            </div>

            <PlayerCircle :players="room.players" class="relative z-10" />
          </div>

          <BidControls
            v-model="draftBid"
            :can-declare="true"
            :can-challenge="true"
            @declare="onDeclare"
            @challenge="onChallenge"
          />
        </main>

        <!-- Event log sidebar -->
        <div class="w-72 shrink-0 border-l border-gold-400/10 p-3 xl:w-80">
          <EventLog :items="room.eventLog" />
        </div>
      </div>
    </div>

    <!-- ========== Mobile layout ========== -->
    <div class="flex h-full min-h-dvh flex-col lg:hidden">
      <GameHeader
        mobile
        :room-code="room.roomCode"
        :player-count="room.playerCount"
        :round="room.round"
        :connection-status="room.connectionStatus"
      />

      <MobilePlayerCarousel :players="room.players" />

      <div class="flex items-center justify-between px-4 pb-1 text-xs text-sand-dim">
        <span>{{ room.players.filter((p) => p.hasDeclared).length }}/{{ room.playerCount }}</span>
        <span>あなたまであと {{ room.turnsUntilSelf }}人</span>
      </div>

      <main class="flex flex-1 flex-col items-center justify-center px-4 py-4">
        <div class="panel w-full max-w-sm px-6 py-8">
          <CurrentBidDisplay
            compact
            :show-turns-hint="false"
            :current-bid="room.currentBid"
          />
        </div>
      </main>

      <BidControls
        v-model="draftBid"
        mobile
        :can-declare="true"
        :can-challenge="true"
        @declare="onDeclare"
        @challenge="onChallenge"
      />

      <!-- Bottom tab bar -->
      <nav
        class="flex border-t border-gold-400/15 bg-night-950/95 safe-bottom"
        aria-label="モバイルメニュー"
      >
        <button
          type="button"
          class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition"
          :class="mobileTab === 'chat' ? 'text-gold-200' : 'text-sand-dim'"
          @click="mobileTab = 'chat'; showToast('チャットはMVP外です')"
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

      <!-- Mobile event log sheet -->
      <div
        v-if="mobileTab === 'log'"
        class="absolute inset-x-0 bottom-16 top-24 z-20 px-3"
      >
        <EventLog :items="room.eventLog" class="h-full" />
      </div>
    </div>

    <!-- Toast -->
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

    <!-- Mock screen links (desktop) -->
    <nav
      class="pointer-events-auto fixed bottom-3 right-3 z-30 hidden gap-1.5 lg:flex"
      aria-label="モック画面リンク"
    >
      <RouterLink to="/" class="btn-ghost !px-2 !py-1 text-[10px]">トップ</RouterLink>
      <RouterLink to="/lobby" class="btn-ghost !px-2 !py-1 text-[10px]">ロビー</RouterLink>
      <RouterLink to="/result" class="btn-ghost !px-2 !py-1 text-[10px]">結果</RouterLink>
    </nav>

    <MockBadge />
  </div>
</template>
