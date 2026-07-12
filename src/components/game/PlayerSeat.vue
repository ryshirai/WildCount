<script setup lang="ts">
import type { PlayerSeat } from '@/types/game'
import PlayerAvatar from './PlayerAvatar.vue'
import BidCard from './BidCard.vue'

defineProps<{
  player: PlayerSeat
}>()
</script>

<template>
  <div
    class="flex max-w-[5.5rem] flex-col items-center gap-0.5 transition-transform duration-200 sm:max-w-[6.5rem]"
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
        <div
          v-if="player.lives > 0"
          class="mt-0.5 flex items-center justify-center gap-px"
          :aria-label="`ライフ ${player.lives}`"
        >
          <span
            v-for="i in Math.min(player.lives, 5)"
            :key="i"
            class="text-[10px] leading-none text-rose-400 drop-shadow-[0_0_4px_rgba(251,113,133,0.45)]"
            aria-hidden="true"
          >♥</span>
          <span
            v-if="player.lives > 5"
            class="ml-0.5 text-[9px] font-semibold text-rose-300/90"
          >×{{ player.lives }}</span>
        </div>
      </template>
    </PlayerAvatar>

    <!-- Hand card: Indian poker — others face-up, self always ? -->
    <div class="relative mt-0.5">
      <BidCard
        v-if="player.lives > 0"
        :label="player.handHidden ? null : player.handLabel"
        :mystery="player.handHidden || player.handLabel == null"
        :emphasized="player.isCurrentTurn || player.isSelf"
      />
      <div
        v-else
        class="card-tile-mystery !h-10 !w-8 !text-base opacity-50"
      >—</div>
    </div>

    <!-- Status under card (手番 / 済 / 待機 / 切断 / あなた / 脱落) -->
    <div class="mt-0.5 flex min-h-[1.1rem] justify-center">
      <span v-if="player.lives <= 0" class="seat-chip-out">脱落</span>
      <span
        v-else-if="player.connected === false"
        class="seat-chip-out"
        title="再接続待ち（約60秒で脱落）"
      >切断</span>
      <span
        v-else-if="player.isCurrentTurn"
        class="seat-chip-turn"
      >手番</span>
      <span
        v-else-if="player.hasDeclared"
        class="seat-chip-declared"
      >済</span>
      <span
        v-else-if="player.isSelf"
        class="seat-chip-self"
      >あなた</span>
      <span
        v-else
        class="seat-chip-wait"
      >待機</span>
    </div>

    <!-- Bid chip (declared number) under status -->
    <div
      v-if="player.lives > 0 && player.bid != null"
      :key="`bid-${player.id}-${player.bid}`"
      class="bid-chip bid-chip--pop"
      :title="`宣言 ${player.bid}`"
    >
      {{ player.bid }}
    </div>
  </div>
</template>
