<script setup lang="ts">
/**
 * Life ♥ row with break / pulse FX when count drops.
 */
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    lives: number
    /** Cap visible hearts (extra shown as ×N) */
    maxVisible?: number
    sizeClass?: string
  }>(),
  {
    maxVisible: 5,
    sizeClass: 'text-[10px]',
  },
)

const prevLives = ref(props.lives)
const breaking = ref(0)
const pulseKey = ref(0)
let breakTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.lives,
  (next, prev) => {
    if (typeof prev !== 'number') {
      prevLives.value = next
      return
    }
    if (next < prev) {
      breaking.value = Math.min(prev - next, 3)
      pulseKey.value += 1
      if (breakTimer) clearTimeout(breakTimer)
      breakTimer = setTimeout(() => {
        breaking.value = 0
        prevLives.value = next
      }, 700)
    } else {
      prevLives.value = next
      breaking.value = 0
    }
  },
)

const visibleCount = () => Math.min(Math.max(props.lives, 0), props.maxVisible)
</script>

<template>
  <div
    v-if="lives > 0 || breaking > 0"
    class="flex items-center justify-center gap-px"
    :aria-label="`ライフ ${lives}`"
  >
    <span
      v-for="i in visibleCount()"
      :key="`h-${i}-${pulseKey}`"
      class="leading-none text-rose-400 drop-shadow-[0_0_4px_rgba(251,113,133,0.45)]"
      :class="[sizeClass, pulseKey > 0 ? 'life-heart-remain-pulse' : '']"
      aria-hidden="true"
      >♥</span
    >
    <span
      v-for="i in breaking"
      :key="`b-${i}-${pulseKey}`"
      class="life-heart-break leading-none text-rose-400"
      :class="sizeClass"
      aria-hidden="true"
      >♥</span
    >
    <span
      v-if="lives > maxVisible"
      class="ml-0.5 font-semibold text-rose-300/90"
      :class="sizeClass === 'text-[10px]' ? 'text-[9px]' : 'text-[8px]'"
      >×{{ lives }}</span
    >
  </div>
</template>
