<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerSeat as PlayerSeatType } from '@/types/game'
import PlayerSeat from './PlayerSeat.vue'

const props = defineProps<{
  players: PlayerSeatType[]
}>()

/**
 * Place seats on an ellipse. Seat 1 is top-center-ish (mock order),
 * going clockwise. Self sits near bottom.
 *
 * Angles (deg from top, clockwise): distribute 10 players evenly,
 * with slight bias so layout matches the design mock.
 */
const seatPositions = computed(() => {
  const n = props.players.length
  // Start from top (-90deg in standard math = top), offset so seat1 is slightly left of top-center
  // Matching mock: seats 1-5 top arc, 6-7 right, 8 bottom, 9-10 left
  return props.players.map((player, i) => {
    // Start at top (-90°), go clockwise so seat 1 ≈ top, seat 8 ≈ bottom
    const angleDeg = -90 + (360 / n) * i
    const rad = (angleDeg * Math.PI) / 180
    // Leave a wide center for the current-bid display
    const rx = 46
    const ry = 44
    const x = 50 + rx * Math.cos(rad)
    const y = 50 + ry * Math.sin(rad)
    return { player, x, y }
  })
})
</script>

<template>
  <div class="relative mx-auto aspect-[5/4] w-full max-w-4xl">
    <div
      v-for="{ player, x, y } in seatPositions"
      :key="player.id"
      class="absolute z-10"
      :style="{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }"
    >
      <div class="origin-center scale-90 xl:scale-100">
        <PlayerSeat :player="player" />
      </div>
    </div>
  </div>
</template>
