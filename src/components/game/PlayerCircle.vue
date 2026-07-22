<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerSeat as PlayerSeatType } from '@/types/game'
import PlayerSeat from './PlayerSeat.vue'
import RallyTrail from './RallyTrail.vue'

const props = withDefaults(
  defineProps<{
    players: PlayerSeatType[]
    /** Last bidder → next turn light trail (D1 RALLY) */
    lastBidderId?: string | null
    currentTurnPlayerId?: string | null
    /** Replay trail when this changes (e.g. bidCount) */
    trailKey?: number | string | null
  }>(),
  {
    lastBidderId: null,
    currentTurnPlayerId: null,
    trailKey: null,
  },
)

/**
 * Place seats on an ellipse. Seat 1 is top-center-ish, going clockwise.
 *
 * Radii leave margin for seat chrome (avatar + chip + card + bid), so seats
 * are not clipped by the stage edge — especially on FHD (short stage height).
 * CSS --seat-density further scales seats when the stage is short.
 */
const seatPositions = computed(() => {
  const n = props.players.length
  // Ellipse: keep seats clear of center bid; vertical radius is tighter so
  // top/bottom seats stay inside short stages (1080p with bid dock).
  const rx = n <= 4 ? 38 : n <= 6 ? 40 : n <= 8 ? 41 : 42
  const ry = n <= 4 ? 34 : n <= 6 ? 35.5 : n <= 8 ? 36.5 : 37.5
  const scale = n <= 4 ? 1.04 : n <= 6 ? 0.92 : n <= 8 ? 0.8 : 0.7

  return props.players.map((player, i) => {
    // Start at top (-90°), go clockwise
    const angleDeg = -90 + (360 / n) * i
    const rad = (angleDeg * Math.PI) / 180
    const x = 50 + rx * Math.cos(rad)
    const y = 50 + ry * Math.sin(rad)
    return { player, x, y, scale }
  })
})</script>

<template>
  <!--
    Outer stage is a size container; board shrinks to fit both axes
    (see .player-circle-stage in main.css). Seats sit inside the board.
    --seat-base-scale is player-count scale; CSS container queries multiply
    --seat-density so FHD / short stages do not overflow the felt.
  -->
  <div class="player-circle-stage">
    <div class="player-circle-stage__board">
      <RallyTrail
        :players="players"
        :from-id="lastBidderId"
        :to-id="currentTurnPlayerId"
        :flash-key="trailKey"
      />
      <div
        v-for="{ player, x, y, scale } in seatPositions"
        :key="player.id"
        class="player-circle-stage__seat absolute z-10"
        :style="{
          left: `${x}%`,
          top: `${y}%`,
          '--seat-base-scale': String(scale),
        }"
      >
        <PlayerSeat :player="player" />
      </div>
    </div>
  </div>
</template>
