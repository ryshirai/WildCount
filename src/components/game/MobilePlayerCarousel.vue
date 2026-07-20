<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { PlayerSeat } from '@/types/game'
import LifeHearts from './LifeHearts.vue'
import PlayerAvatar from './PlayerAvatar.vue'
import SeatContent from './SeatContent.vue'

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
        <LifeHearts :lives="player.lives" :max-visible="3" size-class="text-[9px]" />

        <SeatContent :player="player" compact />
      </div>
    </div>
  </div>
</template>
