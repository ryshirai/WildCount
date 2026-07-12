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
    :class="player.isCurrentTurn ? 'scale-105' : ''"
  >
    <PlayerAvatar
      :avatar="player.avatar"
      :name="player.name"
      :seat-index="player.seatIndex"
      :highlighted="player.isCurrentTurn"
      :self="player.isSelf"
      size="md"
    >
      <template #status>
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
          <template v-if="player.isCurrentTurn && !player.isSelf">現在の手番</template>
          <template v-else-if="player.hasDeclared">宣言済み</template>
          <template v-else-if="player.isSelf">あなた</template>
          <template v-else>待機中</template>
        </div>
      </template>
    </PlayerAvatar>

    <BidCard
      :value="player.bid"
      :mystery="player.isSelf && player.bid === null"
    />
  </div>
</template>
