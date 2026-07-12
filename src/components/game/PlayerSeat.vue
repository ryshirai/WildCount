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
    class="flex flex-col items-center gap-1.5 transition-transform"
    :class="[
      player.isCurrentTurn ? 'scale-105' : '',
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
        <div class="mt-0.5 text-[10px] font-medium text-sand-dim">
          <span v-if="player.lives <= 0" class="text-red-300/80">脱落</span>
          <span v-else class="tracking-tight" :aria-label="`ライフ ${player.lives}`">
            {{ '♥'.repeat(Math.max(0, player.lives)) }}
          </span>
        </div>
        <div
          class="mt-0.5 text-[10px] font-medium"
          :class="
            player.hasDeclared
              ? 'text-emerald-400/90'
              : player.isCurrentTurn
                ? 'text-gold-300'
                : 'text-sand-dim'
          "
        >
          <template v-if="player.lives <= 0">—</template>
          <template v-else-if="player.isCurrentTurn && !player.isSelf">現在の手番</template>
          <template v-else-if="player.hasDeclared">宣言済み</template>
          <template v-else-if="player.isSelf">あなた</template>
          <template v-else>待機中</template>
        </div>
      </template>
    </PlayerAvatar>

    <!-- Hand card: Indian poker — others face-up, self always ? -->
    <BidCard
      v-if="player.lives > 0"
      :label="player.handHidden ? null : player.handLabel"
      :mystery="player.handHidden || player.handLabel == null"
    />
    <div v-else class="card-tile-mystery !h-10 !w-8 !text-base opacity-50">—</div>

    <!-- Bid chip (declared number), separate from hand -->
    <div
      v-if="player.lives > 0 && player.bid != null"
      class="rounded-full border border-gold-400/30 bg-night-900/90 px-2 py-0.5 font-display text-xs font-bold text-gold-200"
      :title="`宣言 ${player.bid}`"
    >
      {{ player.bid }}
    </div>
  </div>
</template>
