<script setup lang="ts">
/**
 * Short declare cut-in (wave-3).
 * Lighter than ExtraActionCutIn / CoyoteCutIn — only open bid or hard raise (+5).
 * CSS-only; tap to skip. Does not hard-block gameplay for long.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { RaiseIntensity } from '@/utils/resultDrama'

const props = withDefaults(
  defineProps<{
    /** open | hard (soft/normal should not mount this) */
    intensity: RaiseIntensity
    bidValue: number
    /** Raise amount when intensity is hard */
    delta?: number | null
    actorName?: string
    durationMs?: number
  }>(),
  {
    delta: null,
    actorName: '',
    durationMs: 1000,
  },
)

const emit = defineEmits<{
  done: []
}>()

const phase = ref<'in' | 'out'>('in')
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let outTimer: ReturnType<typeof setTimeout> | null = null

const title = computed(() =>
  props.intensity === 'open' ? '宣言！' : '大幅アップ！',
)

const line = computed(() => {
  if (props.intensity === 'hard' && props.delta != null && props.delta > 0) {
    return `+${props.delta}`
  }
  return null
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
      intensity === 'hard' ? 'bid-cutin--hard' : 'bid-cutin--open',
    ]"
    role="status"
    aria-live="polite"
    @click="beginOut"
  >
    <div class="bid-cutin__scrim" aria-hidden="true" />
    <div class="bid-cutin__slash" aria-hidden="true" />
    <div class="bid-cutin__card">
      <p v-if="actorName" class="bid-cutin__actor">{{ actorName }}</p>
      <p class="bid-cutin__title">{{ title }}</p>
      <p class="bid-cutin__value font-display tabular-nums">{{ bidValue }}</p>
      <p v-if="line" class="bid-cutin__delta font-display">{{ line }}</p>
    </div>
  </div>
</template>
