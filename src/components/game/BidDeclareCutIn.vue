<script setup lang="ts">
/**
 * Short declare cut-in (wave-3 + D1).
 * Lighter than ExtraActionCutIn / CoyoteCutIn — open bid or hard raise
 * (NICE / BIG / WILD via raise tier). CSS-only; tap to skip.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { RaiseIntensity } from '@/utils/resultDrama'
import { raiseCutInTitle, type RaiseTier } from '@/utils/bidDrama'

const props = withDefaults(
  defineProps<{
    /** open | hard (soft/normal should not mount this) */
    intensity: RaiseIntensity
    /** D1 raise tier for labels / styling */
    tier?: RaiseTier
    doubleRaise?: boolean
    bidValue: number
    /** Raise amount when not open */
    delta?: number | null
    actorName?: string
    /** Override title (いい上げ！ / 大胆ジャンプ / …) */
    title?: string
    durationMs?: number
  }>(),
  {
    tier: 'normal',
    doubleRaise: false,
    delta: null,
    actorName: '',
    title: '',
    durationMs: 1000,
  },
)

const emit = defineEmits<{
  done: []
}>()

const phase = ref<'in' | 'out'>('in')
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let outTimer: ReturnType<typeof setTimeout> | null = null

const resolvedTitle = computed(() => {
  if (props.title) return props.title
  if (props.intensity === 'open' || props.delta == null) return '宣言！'
  return raiseCutInTitle({
    tier: props.tier,
    delta: props.delta,
    doubleRaise: props.doubleRaise,
  })
})

const line = computed(() => {
  if (props.delta != null && props.delta > 0) {
    return `+${props.delta}`
  }
  return null
})

const tierClass = computed(() => {
  if (props.intensity === 'open') return 'bid-cutin--open'
  switch (props.tier) {
    case 'wild':
      return 'bid-cutin--hard bid-cutin--wild'
    case 'big':
      return 'bid-cutin--hard bid-cutin--big'
    case 'nice':
      return 'bid-cutin--hard bid-cutin--nice'
    default:
      return 'bid-cutin--hard'
  }
})

function finish() {
  emit('done')
}

function clearTimers() {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  if (outTimer) {
    clearTimeout(outTimer)
    outTimer = null
  }
}

function beginOut() {
  if (phase.value === 'out') return
  phase.value = 'out'
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  outTimer = setTimeout(finish, 220)
}

onMounted(() => {
  const hold = Math.max(500, props.durationMs - 220)
  dismissTimer = setTimeout(beginOut, hold)
})

onUnmounted(() => {
  clearTimers()
})
</script>

<template>
  <div
    class="bid-cutin"
    :class="[
      phase === 'out' ? 'bid-cutin--out' : 'bid-cutin--in',
      tierClass,
      doubleRaise ? 'bid-cutin--double' : '',
    ]"
    role="status"
    aria-live="polite"
    @click="beginOut"
  >
    <div class="bid-cutin__scrim" aria-hidden="true" />
    <div class="bid-cutin__slash" aria-hidden="true" />
    <div class="bid-cutin__card">
      <p v-if="actorName" class="bid-cutin__actor">{{ actorName }}</p>
      <p class="bid-cutin__title">{{ resolvedTitle }}</p>
      <p class="bid-cutin__value font-display tabular-nums">{{ bidValue }}</p>
      <p v-if="line" class="bid-cutin__delta font-display">{{ line }}</p>
      <p v-if="doubleRaise" class="bid-cutin__mod">×2 RAISE</p>
    </div>
  </div>
</template>
