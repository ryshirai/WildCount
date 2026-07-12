<script setup lang="ts">
import type { PlayerSeat } from '@/types/game'
import BidCard from './BidCard.vue'
import PlayerAvatar from './PlayerAvatar.vue'

defineProps<{
  players: PlayerSeat[]
}>()
</script>

<template>
  <div class="relative border-b border-gold-400/10 bg-night-950/40">
    <div
      class="flex gap-2.5 overflow-x-auto px-3 py-3 scrollbar-none"
      style="scrollbar-width: none"
    >
      <div
        v-for="player in players"
        :key="player.id"
        class="flex w-[3.6rem] shrink-0 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1 transition"
        :class="[
          player.isCurrentTurn
            ? 'bg-gold-400/10 ring-1 ring-gold-400/35'
            : player.isSelf
              ? 'bg-teal-deep/25 ring-1 ring-teal-soft/25'
              : '',
          player.lives <= 0 ? 'opacity-40 grayscale' : '',
        ]"
      >
        <div
          class="max-w-full truncate text-[10px] font-medium"
          :class="
            player.isCurrentTurn
              ? 'text-gold-200'
              : player.isSelf
                ? 'text-teal-soft'
                : 'text-sand-dim'
          "
        >
          {{ player.name }}
        </div>
        <PlayerAvatar
          :avatar="player.avatar"
          :avatar-src="player.avatarSrc"
          :name="player.name"
          :highlighted="player.isCurrentTurn"
          :self="player.isSelf"
          size="sm"
          hide-name
        />
        <!-- Lives under avatar -->
        <div
          v-if="player.lives > 0"
          class="flex items-center gap-px"
          :aria-label="`ライフ ${player.lives}`"
        >
          <span
            v-for="i in Math.min(player.lives, 3)"
            :key="i"
            class="text-[9px] leading-none text-rose-400"
            aria-hidden="true"
          >♥</span>
        </div>

        <!-- Hand: others face-up, self ? -->
        <BidCard
          v-if="player.lives > 0"
          :label="player.handHidden ? null : player.handLabel"
          :mystery="player.handHidden || player.handLabel == null"
          :emphasized="player.isCurrentTurn || player.isSelf"
          compact
        />
        <div
          v-else
          class="card-tile-mystery !h-9 !w-7 !text-sm opacity-50"
        >—</div>

        <!-- Status under card (compact) -->
        <span
          v-if="player.lives <= 0"
          class="seat-chip-out !px-1 !text-[8px]"
        >脱落</span>
        <span
          v-else-if="player.connected === false"
          class="seat-chip-out !px-1 !text-[8px]"
          title="再接続待ち"
        >切断</span>
        <span
          v-else-if="player.isCurrentTurn"
          class="seat-chip-turn !px-1 !text-[8px]"
        >手番</span>
        <span
          v-else-if="player.hasDeclared"
          class="seat-chip-declared !px-1 !text-[8px]"
        >済</span>
        <span
          v-else-if="player.isSelf"
          class="seat-chip-self !px-1 !text-[8px]"
        >あなた</span>
        <span
          v-else
          class="seat-chip-wait !px-1 !text-[8px]"
        >待機</span>

        <div
          v-if="player.lives > 0 && player.bid != null"
          :key="`mbid-${player.id}-${player.bid}`"
          class="bid-chip-sm bid-chip--pop"
          :title="`宣言 ${player.bid}`"
        >
          {{ player.bid }}
        </div>
      </div>
    </div>
  </div>
</template>
