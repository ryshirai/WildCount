<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { PlayerSeat } from '@/types/game'
import LifeHearts from './LifeHearts.vue'
import PlayerAvatar from './PlayerAvatar.vue'
import SeatContent from './SeatContent.vue'

const props = defineProps<{
  players: PlayerSeat[]
}>()

/** Sticky "whose turn" line above the seat scroller (SP scan path). */
const turnPlayer = computed(
  () => props.players.find((p) => p.isCurrentTurn && p.lives > 0) ?? null,
)

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
  <div class="relative border-b border-gold-400/15 bg-night-950/50">
    <!-- Fixed turn summary (does not scroll away with seats) -->
    <div
      v-if="turnPlayer"
      class="flex items-center gap-1.5 border-b border-gold-400/10 px-2.5 py-0.5"
      :class="
        turnPlayer.isSelf
          ? 'bg-gold-400/12'
          : 'bg-night-900/70'
      "
      role="status"
      aria-live="polite"
    >
      <span
        class="shrink-0 text-[9px] font-bold tracking-wide"
        :class="turnPlayer.isSelf ? 'text-gold-200' : 'text-sand-dim'"
      >
        いまの番
      </span>
      <PlayerAvatar
        :avatar="turnPlayer.avatar"
        :avatar-src="turnPlayer.avatarSrc"
        :name="turnPlayer.name"
        :highlighted="true"
        :self="turnPlayer.isSelf"
        size="sm"
        hide-name
        class="scale-[0.85] origin-center"
      />
      <span
        class="min-w-0 flex-1 truncate text-xs font-bold"
        :class="turnPlayer.isSelf ? 'text-gold-50' : 'text-sand'"
      >
        {{ turnPlayer.isSelf ? 'あなた' : turnPlayer.name }}
      </span>
      <span
        class="shrink-0 rounded-full border px-1.5 py-px text-[9px] font-bold"
        :class="
          turnPlayer.isSelf
            ? 'border-gold-400/50 bg-gold-400/25 text-gold-100'
            : 'border-gold-400/30 bg-night-800/80 text-gold-200'
        "
      >
        {{ turnPlayer.isSelf ? 'あなたの番' : '番' }}
      </span>
    </div>

    <!-- SP seats: one more step smaller for bid-dock headroom -->
    <div
      class="flex gap-1.5 overflow-x-auto px-2 py-1 scrollbar-none"
      style="scrollbar-width: none"
    >
      <div
        v-for="player in players"
        :key="player.id"
        :ref="(el) => setSeatEl(player.id, el)"
        class="seat-unit flex shrink-0 flex-col items-center px-0.5 py-0 transition"
        :class="[
          player.handCount >= 2 ? 'w-[4.6rem]' : 'w-[4rem]',
          player.isCurrentTurn
            ? 'seat-unit--turn scale-105'
            : player.isSelf
              ? 'seat-unit--self'
              : 'seat-unit--idle opacity-75',
          player.lives <= 0 ? 'opacity-40 grayscale' : '',
        ]"
      >
        <!-- Same stack as desktop: avatar → name → life → cards → status -->
        <div class="seat-unit__stack !gap-0">
          <PlayerAvatar
            :avatar="player.avatar"
            :avatar-src="player.avatarSrc"
            :name="player.name"
            :highlighted="player.isCurrentTurn"
            :self="player.isSelf"
            size="sm"
            hide-name
            class="-mb-2.5 origin-top scale-[0.8]"
          />
          <div
            class="seat-unit__name max-w-full truncate !text-[10px] !leading-tight"
            :class="
              player.isCurrentTurn
                ? 'seat-unit__name--turn'
                : player.isSelf
                  ? 'seat-unit__name--self'
                  : ''
            "
          >
            <span class="truncate">{{ player.name }}</span>
            <span
              v-if="player.isSelf && player.name !== 'あなた'"
              class="seat-unit__you !text-[8px] !px-0.5"
            >あなた</span>
          </div>
          <LifeHearts :lives="player.lives" :max-visible="3" size-class="text-[9px]" />
          <SeatContent :player="player" compact />
        </div>
      </div>
    </div>
  </div>
</template>
