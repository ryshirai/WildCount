<script setup lang="ts">
/**
 * Shared seat body: hand tiles + status chip + bid chip.
 * Used by desktop PlayerSeat and mobile MobilePlayerCarousel (R5).
 */
import { computed } from 'vue'
import type { PlayerSeat } from '@/types/game'
import HandTiles from './HandTiles.vue'

const props = withDefaults(
  defineProps<{
    player: PlayerSeat
    /** Mobile carousel density */
    compact?: boolean
  }>(),
  { compact: false },
)

type StatusKind = 'out' | 'turn' | 'declared' | 'self' | 'wait'

const status = computed((): {
  kind: StatusKind
  label: string
  title?: string
} => {
  const p = props.player
  if (p.lives <= 0) return { kind: 'out', label: '脱落' }
  if (p.connected === false) {
    return {
      kind: 'out',
      label: '切断',
      title: props.compact
        ? '再接続待ち'
        : '再接続待ち（しばらくすると脱落します）',
    }
  }
  if (p.isCurrentTurn) return { kind: 'turn', label: '手番' }
  if (p.hasDeclared) return { kind: 'declared', label: '宣言済' }
  if (p.isSelf) return { kind: 'self', label: 'あなた' }
  return { kind: 'wait', label: '待機' }
})

const statusClass: Record<StatusKind, string> = {
  out: 'seat-chip-out',
  turn: 'seat-chip-turn',
  declared: 'seat-chip-declared',
  self: 'seat-chip-self',
  wait: 'seat-chip-wait',
}

const showHand = computed(
  () => props.player.lives > 0 && props.player.handCount > 0,
)

const showBid = computed(
  () => props.player.lives > 0 && props.player.bid != null,
)
</script>

<template>
  <!-- Hand -->
  <div :class="compact ? '' : 'relative mt-0.5'">
    <HandTiles
      v-if="showHand"
      :labels="player.handHidden ? null : player.handLabels"
      :count="player.handCount"
      :mystery="player.handHidden"
      :emphasized="player.isCurrentTurn || player.isSelf"
      :compact="compact"
    />
    <div
      v-else-if="!compact && player.lives > 0"
      class="card-tile-mystery !h-11 !w-9 !text-lg opacity-50"
    >
      ?
    </div>
    <div
      v-else
      class="card-tile-mystery opacity-50"
      :class="compact ? '!h-10 !w-8 !text-sm' : '!h-11 !w-9 !text-base'"
    >
      —
    </div>
  </div>

  <!-- Status under card -->
  <div
    :class="
      compact
        ? ''
        : 'mt-0.5 flex min-h-[1.1rem] justify-center'
    "
  >
    <span
      :class="[
        statusClass[status.kind],
        compact ? '!px-1 !text-[10px]' : '',
      ]"
      :title="status.title"
    >
      {{ status.label }}
    </span>
  </div>

  <!-- Bid chip -->
  <div
    v-if="showBid"
    :key="`bid-${player.id}-${player.bid}`"
    class="bid-chip--pop"
    :class="compact ? 'bid-chip-sm' : 'bid-chip'"
    :title="`宣言 ${player.bid}`"
  >
    {{ player.bid }}
  </div>
</template>
