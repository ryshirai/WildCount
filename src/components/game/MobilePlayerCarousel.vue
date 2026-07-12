<script setup lang="ts">
import type { PlayerSeat } from '@/types/game'
import BidCard from './BidCard.vue'

defineProps<{
  players: PlayerSeat[]
}>()
</script>

<template>
  <div class="relative">
    <div
      class="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-none"
      style="scrollbar-width: none"
    >
      <div
        v-for="player in players"
        :key="player.id"
        class="flex w-14 shrink-0 flex-col items-center gap-1"
        :class="player.isCurrentTurn ? 'opacity-100' : 'opacity-95'"
      >
        <div
          class="truncate text-[10px] font-medium"
          :class="[
            player.isSelf ? 'text-teal-soft' : 'text-sand-dim',
            player.lives <= 0 ? 'opacity-40' : '',
          ]"
        >
          {{ player.name }}
        </div>
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full bg-night-700 text-lg ring-2"
          :class="[
            player.lives <= 0 ? 'opacity-40 grayscale' : '',
            player.isCurrentTurn
              ? 'ring-gold-300 shadow-gold-glow'
              : player.isSelf
                ? 'ring-teal-soft/70'
                : 'ring-gold-400/25',
          ]"
        >
          {{ player.avatar }}
        </div>
        <div class="text-[9px] text-sand-dim">
          <template v-if="player.lives <= 0">脱落</template>
          <template v-else>{{ '♥'.repeat(player.lives) }}</template>
        </div>
        <!-- Hand: others face-up, self ? -->
        <BidCard
          v-if="player.lives > 0"
          :label="player.handHidden ? null : player.handLabel"
          :mystery="player.handHidden || player.handLabel == null"
          compact
        />
        <div
          v-if="player.lives > 0 && player.bid != null"
          class="font-display text-[10px] font-bold text-gold-200"
        >
          {{ player.bid }}
        </div>
      </div>
    </div>
  </div>
</template>
