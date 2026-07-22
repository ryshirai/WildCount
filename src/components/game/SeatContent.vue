<script setup lang="ts">
/**
 * Shared seat body: hand tiles + status chip + bid chip.
 * Parent always owns name / life; this is cards → status only.
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

/** Game-state only — identity (“あなた”) lives on the name row, not here */
type StatusKind = 'out' | 'turn' | 'declared' | 'wait'

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
  return { kind: 'wait', label: '待機' }
})

const statusClass: Record<StatusKind, string> = {
  out: 'seat-chip-out',
  turn: 'seat-chip-turn',
  declared: 'seat-chip-declared',
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
  <!-- 4. Hand cards
       Self identity lives on avatar/name (teal). Forehead cards are a
       separate object: mystery = card-back style, turn = gold emphasis only. -->
  <div class="relative">
    <HandTiles
      v-if="showHand"
      :labels="player.handHidden ? null : player.handLabels"
      :count="player.handCount"
      :mystery="player.handHidden"
      :self-hand="player.isSelf && player.handHidden"
      :emphasized="player.isCurrentTurn"
      :compact="compact"
    />
    <div
      v-else-if="!compact && player.lives > 0"
      class="card-tile-mystery opacity-50"
      :class="player.isSelf ? 'card-tile-mystery--self' : ''"
      :title="player.isSelf ? '自分の札（非公開）' : undefined"
    >
      ?
    </div>
    <div
      v-else
      class="card-tile-mystery opacity-50"
      :class="compact ? 'card-tile--compact' : ''"
    >
      —
    </div>
  </div>

  <!-- 5. Status (+ bid when declared) -->
  <div
    class="seat-unit__status"
    :class="compact ? '!min-h-0 !gap-0.5' : ''"
  >
    <span
      :class="[
        statusClass[status.kind],
        compact ? 'seat-chip--compact' : '',
      ]"
      :title="status.title"
    >
      {{ status.label }}
    </span>

    <div
      v-if="showBid"
      :key="`bid-${player.id}-${player.bid}`"
      class="bid-chip--pop"
      :class="compact ? 'bid-chip-sm' : 'bid-chip'"
      :title="`宣言 ${player.bid}`"
    >
      {{ player.bid }}
    </div>
  </div>
</template>
