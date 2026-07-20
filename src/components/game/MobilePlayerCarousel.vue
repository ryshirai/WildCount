<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { PlayerSeat } from '@/types/game'
import HandTiles from './HandTiles.vue'
import LifeHearts from './LifeHearts.vue'
import PlayerAvatar from './PlayerAvatar.vue'

const props = defineProps<{
  players: PlayerSeat[]
}>()

const seatEls = ref<Record<string, HTMLElement | null>>({})

function setSeatEl(id: string, el: unknown) {
  if (el instanceof HTMLElement) {
    seatEls.value[id] = el
  } else {
    delete seatEls.value[id]
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function focusTurnSeat() {
  const turn = props.players.find((p) => p.isCurrentTurn && p.lives > 0)
  const target = turn ?? props.players.find((p) => p.isSelf)
  if (!target) return
  const el = seatEls.value[target.id]
  if (!el) return
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    inline: 'center',
    block: 'nearest',
  })
}

watch(
  () => props.players.map((p) => `${p.id}:${p.isCurrentTurn ? 1 : 0}`).join('|'),
  async () => {
    await nextTick()
    focusTurnSeat()
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative border-b border-gold-400/10 bg-night-950/40">
    <div
      class="flex gap-2.5 overflow-x-auto px-3 py-2.5 scrollbar-none"
      style="scrollbar-width: none"
    >
      <div
        v-for="player in players"
        :key="player.id"
        :ref="(el) => setSeatEl(player.id, el)"
        class="flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1 transition"
        :class="[
          player.handCount >= 2 ? 'w-[4.6rem]' : 'w-[3.85rem]',
          player.isCurrentTurn
            ? 'scale-105 bg-gold-400/10 ring-1 ring-gold-400/35'
            : player.isSelf
              ? 'bg-teal-deep/25 ring-1 ring-teal-soft/25'
              : 'opacity-70',
          player.lives <= 0 ? 'opacity-40 grayscale' : '',
        ]"
      >
        <div
          class="max-w-full truncate text-[10px] font-medium"
          :class="
            player.isCurrentTurn
              ? 'text-gold-200'
              : player.isSelf
                ? 'text-teal-soft'
                : 'text-sand-dim'
          "
        >
          {{ player.name }}
        </div>
        <PlayerAvatar
          :avatar="player.avatar"
          :avatar-src="player.avatarSrc"
          :name="player.name"
          :highlighted="player.isCurrentTurn"
          :self="player.isSelf"
          size="sm"
          hide-name
        />
        <!-- Lives under avatar -->
        <LifeHearts :lives="player.lives" :max-visible="3" size-class="text-[9px]" />

        <!-- Hand: multi-card fan when draw1 -->
        <HandTiles
          v-if="player.lives > 0 && player.handCount > 0"
          :labels="player.handHidden ? null : player.handLabels"
          :count="player.handCount"
          :mystery="player.handHidden"
          :emphasized="player.isCurrentTurn || player.isSelf"
          compact
        />
        <div
          v-else
          class="card-tile-mystery !h-10 !w-8 !text-sm opacity-50"
        >—</div>

        <!-- Status under card (min 10px — R4) -->
        <span
          v-if="player.lives <= 0"
          class="seat-chip-out !px-1 !text-[10px]"
        >脱落</span>
        <span
          v-else-if="player.connected === false"
          class="seat-chip-out !px-1 !text-[10px]"
          title="再接続待ち"
        >切断</span>
        <span
          v-else-if="player.isCurrentTurn"
          class="seat-chip-turn !px-1 !text-[10px]"
        >手番</span>
        <span
          v-else-if="player.hasDeclared"
          class="seat-chip-declared !px-1 !text-[10px]"
        >済</span>
        <span
          v-else-if="player.isSelf"
          class="seat-chip-self !px-1 !text-[10px]"
        >あなた</span>
        <span
          v-else
          class="seat-chip-wait !px-1 !text-[10px]"
        >待機</span>

        <div
          v-if="player.lives > 0 && player.bid != null"
          :key="`mbid-${player.id}-${player.bid}`"
          class="bid-chip-sm bid-chip--pop"
          :title="`宣言 ${player.bid}`"
        >
          {{ player.bid }}
        </div>
      </div>
    </div>
  </div>
</template>
