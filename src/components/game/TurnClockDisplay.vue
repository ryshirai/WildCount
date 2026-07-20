<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { playSfx } from '@/audio'
import type { WireClockSnapshot } from '@/online/protocol'
import {
  formatClockMs,
  isClockUrgent,
  remainingForPlayer,
} from '@/online/clockDisplay'

const props = withDefaults(
  defineProps<{
    clock: WireClockSnapshot | null | undefined
    /** Highlight when it is the local player's turn */
    isSelfTurn?: boolean
    compact?: boolean
    /**
     * Center-table placement (above current bid).
     * Full chrome: ring + display digits + glow.
     */
    prominent?: boolean
  }>(),
  {
    compact: false,
    prominent: false,
  },
)

/** SVG ring geometry (viewBox 0 0 40 40, r = 16) */
const RING_R = 16
const RING_C = 2 * Math.PI * RING_R

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

function tick() {
  now.value = Date.now()
}

onMounted(() => {
  // 100ms keeps the ring smooth without thrashing
  timer = setInterval(tick, 100)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

watch(
  () => props.clock?.turnStartedAt,
  () => {
    now.value = Date.now()
  },
)

const remaining = computed(() => {
  if (!props.clock?.currentTurnPlayerId || props.clock.turnStartedAt == null) {
    return null
  }
  return remainingForPlayer(
    props.clock,
    props.clock.currentTurnPlayerId,
    now.value,
  )
})

const bankLabel = computed(() => {
  if (!remaining.value) return null
  // Hide bank when empty and temp still runs
  if (remaining.value.bankMs <= 0 && remaining.value.tempMs > 0) return null
  return formatClockMs(remaining.value.bankMs)
})

const tempLabel = computed(() => {
  if (!remaining.value) return null
  if (remaining.value.tempMs <= 0) return null
  return formatClockMs(remaining.value.tempMs)
})

const label = computed(() => {
  if (!remaining.value) return null
  const bank = bankLabel.value
  const temp = tempLabel.value
  if (bank != null && temp != null) return `${bank} + ${temp}`
  if (bank != null) return bank
  if (temp != null) return temp
  return formatClockMs(0)
})

/** Fraction of this turn's budget still left (1 → full, 0 → empty). */
const progress = computed(() => {
  if (!props.clock || !remaining.value) return 0
  const total = props.clock.bankAtTurnStartMs + props.clock.turnBonusMs
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, remaining.value.totalMs / total))
})

const dashOffset = computed(() => RING_C * (1 - progress.value))

const urgent = computed(() => {
  if (!props.clock) return false
  return isClockUrgent(props.clock, now.value)
})

const critical = computed(() => {
  if (!remaining.value) return false
  return remaining.value.totalMs > 0 && remaining.value.totalMs <= 5_000
})

const expired = computed(() => {
  if (!remaining.value) return false
  return remaining.value.totalMs <= 0
})

const visible = computed(
  () => props.clock != null && props.clock.turnStartedAt != null && label.value,
)

const tone = computed(() => {
  if (expired.value || urgent.value || critical.value) return 'danger'
  if (props.isSelfTurn) return 'self'
  return 'idle'
})

// D2: soft pulse while urgent (engine cooldown ≈ 900ms; no private info)
watch(
  () => [urgent.value, now.value] as const,
  ([isUrgent]) => {
    if (!isUrgent) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return
    }
    playSfx('timer_pulse')
  },
)
</script>

<template>
  <div
    v-if="visible"
    class="turn-clock"
    :class="[
      `turn-clock--${tone}`,
      compact ? 'turn-clock--compact' : '',
      prominent ? 'turn-clock--prominent' : 'turn-clock--plain',
      critical ? 'turn-clock--critical' : '',
      expired ? 'turn-clock--expired' : '',
    ]"
    role="timer"
    :aria-label="`残り時間 ${label}`"
  >
    <span class="turn-clock__bloom" aria-hidden="true" />

    <!-- Circular remaining-time ring -->
    <div class="turn-clock__ring" aria-hidden="true">
      <svg class="turn-clock__svg" viewBox="0 0 40 40">
        <circle
          class="turn-clock__track"
          cx="20"
          cy="20"
          :r="RING_R"
          fill="none"
        />
        <circle
          class="turn-clock__progress"
          cx="20"
          cy="20"
          :r="RING_R"
          fill="none"
          :stroke-dasharray="RING_C"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span class="turn-clock__glyph">⏱</span>
    </div>

    <div class="turn-clock__body">
      <span class="turn-clock__caption">TIME</span>
      <div class="turn-clock__digits">
        <span v-if="bankLabel != null" class="turn-clock__bank">{{ bankLabel }}</span>
        <template v-if="bankLabel != null && tempLabel != null">
          <span class="turn-clock__plus" aria-hidden="true">+</span>
        </template>
        <span v-if="tempLabel != null" class="turn-clock__temp">{{ tempLabel }}</span>
        <span
          v-if="bankLabel == null && tempLabel == null"
          class="turn-clock__bank"
        >
          0
        </span>
      </div>
    </div>
  </div>
</template>
