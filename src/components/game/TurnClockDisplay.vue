<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { WireClockSnapshot } from '@/online/protocol'
import {
  formatActiveTurnClock,
  isClockUrgent,
  remainingForPlayer,
} from '@/online/clockDisplay'

const props = defineProps<{
  clock: WireClockSnapshot | null | undefined
  /** Highlight when it is the local player's turn */
  isSelfTurn?: boolean
  compact?: boolean
}>()

const now = ref(Date.now())
let raf = 0
let timer: ReturnType<typeof setInterval> | null = null

function tick() {
  now.value = Date.now()
}

onMounted(() => {
  // 250ms is enough for second-level display without thrashing
  timer = setInterval(tick, 250)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (raf) cancelAnimationFrame(raf)
})

watch(
  () => props.clock?.turnStartedAt,
  () => {
    now.value = Date.now()
  },
)

const label = computed(() => {
  if (!props.clock) return null
  return formatActiveTurnClock(props.clock, now.value)
})

const urgent = computed(() => {
  if (!props.clock) return false
  return isClockUrgent(props.clock, now.value)
})

const expired = computed(() => {
  if (!props.clock?.currentTurnPlayerId || props.clock.turnStartedAt == null) {
    return false
  }
  const r = remainingForPlayer(
    props.clock,
    props.clock.currentTurnPlayerId,
    now.value,
  )
  return r.totalMs <= 0
})

const visible = computed(
  () => props.clock != null && props.clock.turnStartedAt != null && label.value,
)
</script>

<template>
  <div
    v-if="visible"
    class="inline-flex items-center gap-1.5 font-mono tabular-nums"
    :class="[
      compact ? 'text-xs' : 'text-sm',
      urgent || expired
        ? 'text-rose-300'
        : isSelfTurn
          ? 'text-teal-soft'
          : 'text-gold-200',
    ]"
    role="timer"
    :aria-label="`残り時間 ${label}`"
  >
    <span aria-hidden="true">⏱</span>
    <span
      class="font-semibold tracking-wide"
      :class="urgent || expired ? 'animate-pulse' : ''"
    >
      {{ label }}
    </span>
  </div>
</template>
