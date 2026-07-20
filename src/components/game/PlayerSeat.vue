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
    class="flex max-w-[6.25rem] flex-col items-center gap-0.5 transition-transform duration-200 sm:max-w-[7rem]"
    :class="[
      player.isCurrentTurn ? 'z-10 scale-[1.03]' : '',
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
