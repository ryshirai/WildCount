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
    One cohesive “seat” unit: avatar + name + life + hand + status.
    Sized for commercial table readability (≈1.3–1.5× prior density).
  -->
  <div
    class="seat-unit flex max-w-[8.25rem] flex-col items-center gap-1 px-1.5 py-1.5 transition duration-200 sm:max-w-[9rem] sm:gap-1.5 sm:px-2 sm:py-2"
    :class="[
      player.isCurrentTurn
        ? 'seat-unit--turn z-10 scale-[1.08]'
        : player.isSelf
          ? 'seat-unit--self'
          : player.lives > 0
            ? 'seat-unit--idle'
            : '',
      player.lives <= 0 ? 'opacity-40 grayscale' : '',
    ]"
  >
    <PlayerAvatar
      :avatar="player.avatar"
      :avatar-src="player.avatarSrc"
      :name="player.name"
      :seat-index="player.seatIndex"
      :highlighted="player.isCurrentTurn"
      :self="player.isSelf"
      size="md"
    >
      <template #status>
        <div class="mt-1">
          <LifeHearts
            :lives="player.lives"
            :max-visible="5"
            size-class="text-xs sm:text-[0.8rem]"
          />
        </div>
      </template>
    </PlayerAvatar>

    <SeatContent :player="player" />
  </div>
</template>
