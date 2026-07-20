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
  <div
    class="flex max-w-[6.25rem] flex-col items-center gap-0.5 rounded-xl px-0.5 py-0.5 transition duration-200 sm:max-w-[7rem]"
    :class="[
      player.isCurrentTurn
        ? 'z-10 scale-[1.06] bg-gold-400/10 ring-1 ring-gold-400/40 shadow-[0_0_18px_rgba(201,168,76,0.22)]'
        : player.lives > 0
          ? 'opacity-80'
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
        <!-- Lives only under avatar; status chips sit under the hand card -->
        <div class="mt-0.5">
          <LifeHearts :lives="player.lives" :max-visible="5" size-class="text-[10px]" />
        </div>
      </template>
    </PlayerAvatar>

    <SeatContent :player="player" />
  </div>
</template>
