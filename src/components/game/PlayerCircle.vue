<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerSeat as PlayerSeatType } from '@/types/game'
import PlayerSeat from './PlayerSeat.vue'

const props = defineProps<{
  players: PlayerSeatType[]
}>()

/**
 * Place seats on an ellipse. Seat 1 is top-center-ish, going clockwise.
 *
 * Radii leave margin for seat chrome (avatar + chip + card + bid), so seats
 * are not clipped by the stage edge. Tighter for larger tables.
 */
const seatPositions = computed(() => {
  const n = props.players.length
  // Leave room for seat content (≈80–100px half-extent at md).
  // Larger tables tighten radius less / scale more so 8–10 seats stay readable (R5).
  const rx = n <= 4 ? 36 : n <= 6 ? 38 : n <= 8 ? 40 : 41
  const ry = n <= 4 ? 34 : n <= 6 ? 36 : n <= 8 ? 38 : 39
  const scale = n <= 4 ? 1 : n <= 6 ? 0.92 : n <= 8 ? 0.82 : 0.72

  return props.players.map((player, i) => {
    // Start at top (-90°), go clockwise
    const angleDeg = -90 + (360 / n) * i
    const rad = (angleDeg * Math.PI) / 180
    const x = 50 + rx * Math.cos(rad)
    const y = 50 + ry * Math.sin(rad)
    return { player, x, y, scale }
  })
})
</script>

<template>
  <!--
    Outer stage is a size container; board shrinks to fit both axes
    (see .player-circle-stage in main.css). Seats sit inside the board.
  -->
  <div class="player-circle-stage">
    <div class="player-circle-stage__board">
      <div
        v-for="{ player, x, y, scale } in seatPositions"
        :key="player.id"
        class="absolute z-10"
        :style="{
          left: `${x}%`,
          top: `${y}%`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }"
      >
        <PlayerSeat :player="player" />
      </div>
    </div>
  </div>
</template>
