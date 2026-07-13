<script setup lang="ts">
/**
 * Short "ROUND N" slam when a new round begins.
 * Does not block play — auto-dismisses; reduced-motion → instant done.
 */
import { onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    round: number
    /** Total visible time including out fade */
    durationMs?: number
  }>(),
  {
    durationMs: 1100,
  },
)

const emit = defineEmits<{
  done: []
}>()

const phase = ref<'in' | 'out'>('in')
let outTimer: ReturnType<typeof setTimeout> | null = null
let doneTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (outTimer) {
    clearTimeout(outTimer)
    outTimer = null
  }
  if (doneTimer) {
    clearTimeout(doneTimer)
    doneTimer = null
  }
}

onMounted(() => {
  const prefersReduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduce) {
    emit('done')
    return
  }
  const outAt = Math.max(400, props.durationMs - 280)
  outTimer = setTimeout(() => {
    phase.value = 'out'
  }, outAt)
  doneTimer = setTimeout(() => {
    emit('done')
  }, props.durationMs)
})

onUnmounted(clearTimers)
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 z-[45] flex items-center justify-center"
    aria-live="polite"
    role="status"
  >
    <div
      class="round-slam-banner relative flex flex-col items-center rounded-2xl border border-gold-400/40 bg-night-900/90 px-10 py-6 shadow-[0_0_48px_rgba(201,168,76,0.22)] backdrop-blur-md sm:px-14 sm:py-8"
      :class="phase === 'out' ? 'round-slam-banner--out' : ''"
    >
      <p
        class="text-[10px] font-semibold uppercase tracking-[0.35em] text-sand-dim sm:text-xs"
      >
        Round
      </p>
      <p
        class="round-slam mt-1 font-display text-5xl font-bold tabular-nums text-gold-100 sm:text-6xl"
        style="
          text-shadow:
            0 0 28px rgba(201, 168, 76, 0.45),
            0 0 8px rgba(201, 168, 76, 0.25);
        "
      >
        {{ round }}
      </p>
      <p class="mt-2 text-xs text-sand-dim sm:text-sm">ラウンド開始</p>
    </div>
  </div>
</template>
