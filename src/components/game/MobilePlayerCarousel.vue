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
      class="flex items-center gap-2 border-b border-gold-400/10 px-2.5 py-1"
      :class="
        turnPlayer.isSelf
          ? 'bg-gold-400/12'
          : 'bg-night-900/70'
      "
      role="status"
      aria-live="polite"
      :aria-label="
        turnPlayer.isSelf
          ? 'いまの手番はあなた'
          : `いまの手番は${turnPlayer.name}`
      "
    >
      <PlayerAvatar
        :avatar="turnPlayer.avatar"
        :avatar-src="turnPlayer.avatarSrc"
        :name="turnPlayer.name"
        :highlighted="true"
        :self="turnPlayer.isSelf"
        size="sm"
        hide-name
        class="origin-center scale-90"
      />
      <span
        class="min-w-0 flex-1 truncate text-sm font-bold"
        :class="turnPlayer.isSelf ? 'text-gold-50' : 'text-sand'"
      >
        {{ turnPlayer.isSelf ? 'あなた' : turnPlayer.name }}
      </span>
    </div>

    <!--
      SP seats: readable density (specials are in a bottom sheet,
      so we can give the carousel more room than the old ultra-compact strip).
    -->
    <div
      class="flex gap-2 overflow-x-auto px-2.5 py-1.5 scrollbar-none"
      style="scrollbar-width: none"
    >
      <div
        v-for="player in players"
        :key="player.id"
        :ref="(el) => setSeatEl(player.id, el)"
        class="seat-unit flex shrink-0 flex-col items-center px-0.5 py-0.5 transition"
        :class="[
          player.handCount >= 2 ? 'w-[5.25rem]' : 'w-[4.75rem]',
          player.isCurrentTurn
            ? 'seat-unit--turn scale-105'
            : player.isSelf
              ? 'seat-unit--self'
              : 'seat-unit--idle opacity-75',
          player.lives <= 0 ? 'opacity-40 grayscale' : '',
        ]"
      >
        <!-- Same stack as desktop: avatar → name → life → cards → status -->
        <div class="seat-unit__stack !gap-0.5">
          <PlayerAvatar
            :avatar="player.avatar"
            :avatar-src="player.avatarSrc"
            :name="player.name"
            :highlighted="player.isCurrentTurn"
            :self="player.isSelf"
            size="sm"
            hide-name
            class="-mb-1.5 origin-top scale-95"
          />
          <div
            class="seat-unit__name max-w-full truncate !text-[11px] !leading-tight"
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
              class="seat-unit__you !text-[9px] !px-0.5"
            >あなた</span>
          </div>
          <LifeHearts :lives="player.lives" :max-visible="3" size-class="text-[11px]" />
          <SeatContent :player="player" compact />
        </div>
      </div>
    </div>
  </div>
</template>
