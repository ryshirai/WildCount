<script setup lang="ts">
import type { PlayerSeat } from '@/types/game'
import PlayerAvatar from './PlayerAvatar.vue'
import LifeHearts from './LifeHearts.vue'
import SeatContent from './SeatContent.vue'

defineProps<{
  player: PlayerSeat
}>()
</script>

<template>
  <!--
    Unified seat stack (all players, same structure):
    avatar → name → life → cards → status
    Self: avatar glow + name label + card aura (no tall box frame).
  -->
  <div
    class="seat-unit flex max-w-[9.75rem] flex-col items-center px-0.5 py-0.5 transition duration-200 sm:max-w-[10.5rem]"
    :class="[
      player.isCurrentTurn
        ? 'seat-unit--turn z-10 scale-[1.06]'
        : player.isSelf
          ? 'seat-unit--self'
          : player.lives > 0
            ? 'seat-unit--idle'
            : '',
      player.lives <= 0 ? 'opacity-40 grayscale' : '',
    ]"
  >
    <div class="seat-unit__stack">
      <!-- 1. Avatar -->
      <PlayerAvatar
        :avatar="player.avatar"
        :avatar-src="player.avatarSrc"
        :name="player.name"
        :seat-index="player.seatIndex"
        :highlighted="player.isCurrentTurn"
        :self="player.isSelf"
        size="md"
        hide-name
      />

      <!-- 2. Name (+ self label) -->
      <div
        class="seat-unit__name"
        :class="[
          player.isCurrentTurn
            ? 'seat-unit__name--turn'
            : player.isSelf
              ? 'seat-unit__name--self'
              : '',
        ]"
      >
        <span class="truncate">{{ player.name }}</span>
        <span
          v-if="player.isSelf && player.name !== 'あなた'"
          class="seat-unit__you"
          aria-label="あなた"
        >あなた</span>
      </div>

      <!-- 3. Life -->
      <LifeHearts
        :lives="player.lives"
        :max-visible="5"
        size-class="text-sm sm:text-[0.95rem]"
      />

      <!-- 4–5. Cards + status -->
      <SeatContent :player="player" />
    </div>
  </div>
</template>
