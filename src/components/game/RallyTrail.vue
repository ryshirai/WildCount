<script setup lang="ts">
/**
 * Brief light trail from last bidder seat → current turn seat (D1 RALLY).
 * Pure presentation; uses the same ellipse math as PlayerCircle.
 */
import { computed, ref, watch } from 'vue'
import type { PlayerSeat as PlayerSeatType } from '@/types/game'

const props = defineProps<{
  players: readonly PlayerSeatType[]
  fromId: string | null
  toId: string | null
  /** Bumps when a new bid lands so the trail re-plays */
  flashKey?: number | string | null
}>()

type SeatPos = { id: string; x: number; y: number }

const seats = computed((): SeatPos[] => {
  const n = props.players.length
  if (n === 0) return []
  const rx = n <= 4 ? 36 : n <= 6 ? 38 : n <= 8 ? 40 : 41
  const ry = n <= 4 ? 34 : n <= 6 ? 36 : n <= 8 ? 38 : 39
  return props.players.map((player, i) => {
    const angleDeg = -90 + (360 / n) * i
    const rad = (angleDeg * Math.PI) / 180
    return {
      id: player.id,
      x: 50 + rx * Math.cos(rad),
      y: 50 + ry * Math.sin(rad),
    }
  })
})

const trail = ref<{
  key: number
  x1: number
  y1: number
  x2: number
  y2: number
  len: number
  angle: number
} | null>(null)
let seq = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => [props.flashKey, props.fromId, props.toId] as const,
  ([key, fromId, toId]) => {
    if (key == null || !fromId || !toId || fromId === toId) return
    const from = seats.value.find((s) => s.id === fromId)
    const to = seats.value.find((s) => s.id === toId)
    if (!from || !to) return
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    if (len < 2) return
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    if (hideTimer) clearTimeout(hideTimer)
    trail.value = {
      key: ++seq,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      len,
      angle,
    }
    hideTimer = setTimeout(() => {
      trail.value = null
      hideTimer = null
    }, 720)
  },
)
</script>

<template>
  <div
    v-if="trail"
    :key="trail.key"
    class="rally-trail pointer-events-none absolute inset-0 z-[5]"
    aria-hidden="true"
  >
    <div
      class="rally-trail__beam"
      :style="{
        left: `${trail.x1}%`,
        top: `${trail.y1}%`,
        width: `${trail.len}%`,
        transform: `rotate(${trail.angle}deg)`,
        transformOrigin: '0 50%',
      }"
    />
    <div
      class="rally-trail__node rally-trail__node--from"
      :style="{ left: `${trail.x1}%`, top: `${trail.y1}%` }"
    />
    <div
      class="rally-trail__node rally-trail__node--to"
      :style="{ left: `${trail.x2}%`, top: `${trail.y2}%` }"
    />
  </div>
</template>
