<script setup lang="ts">
/**
 * Local CSS sparkle burst (no canvas / deps).
 * Use on card reveal, copy success, ready chips, etc.
 */
withDefaults(
  defineProps<{
    density?: 'sm' | 'md' | 'lg'
    palette?: 'gold' | 'teal' | 'mixed'
  }>(),
  {
    density: 'md',
    palette: 'gold',
  },
)

/** Fixed layout for stable re-renders */
const DOTS = [
  { sx: 0, sy: -18, delay: 0 },
  { sx: 14, sy: -12, delay: 0.04 },
  { sx: 18, sy: 4, delay: 0.08 },
  { sx: 10, sy: 16, delay: 0.06 },
  { sx: -8, sy: 17, delay: 0.1 },
  { sx: -16, sy: 6, delay: 0.05 },
  { sx: -14, sy: -10, delay: 0.09 },
  { sx: 0, sy: 0, delay: 0.02 },
  { sx: 8, sy: -6, delay: 0.12 },
  { sx: -6, sy: 8, delay: 0.11 },
  { sx: 12, sy: 12, delay: 0.14 },
  { sx: -12, sy: -4, delay: 0.07 },
] as const

const countMap = { sm: 6, md: 9, lg: 12 } as const
</script>

<template>
  <div
    class="fx-sparkle"
    :class="`fx-sparkle--${palette}`"
    aria-hidden="true"
  >
    <span
      v-for="(d, i) in DOTS.slice(0, countMap[density])"
      :key="i"
      class="fx-sparkle__dot"
      :style="{
        '--sx': `${d.sx}px`,
        '--sy': `${d.sy}px`,
        animationDelay: `${d.delay}s`,
      }"
    />
  </div>
</template>
