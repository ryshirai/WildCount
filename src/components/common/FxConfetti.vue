<script setup lang="ts">
/**
 * Lightweight CSS confetti burst (no canvas / deps).
 * Use for win / game-over dopamine beats. Respects prefers-reduced-motion via CSS.
 */
withDefaults(
  defineProps<{
    /** denser = more pieces */
    density?: 'sm' | 'md' | 'lg'
    /** gold / teal / mixed palette */
    palette?: 'gold' | 'teal' | 'mixed'
    /** auto-hide after ms (0 = stay while mounted) */
    durationMs?: number
  }>(),
  {
    density: 'md',
    palette: 'mixed',
    durationMs: 2800,
  },
)

/** Fixed pseudo-random layout so SSR/hydration and re-renders stay stable */
const PIECES = [
  { x: 8, delay: 0, dur: 2.1, rot: 40, size: 0 },
  { x: 18, delay: 0.08, dur: 2.4, rot: -55, size: 1 },
  { x: 28, delay: 0.15, dur: 1.9, rot: 70, size: 2 },
  { x: 38, delay: 0.05, dur: 2.6, rot: -30, size: 0 },
  { x: 48, delay: 0.2, dur: 2.2, rot: 90, size: 1 },
  { x: 58, delay: 0.12, dur: 2.5, rot: -80, size: 2 },
  { x: 68, delay: 0.03, dur: 2.0, rot: 25, size: 0 },
  { x: 78, delay: 0.18, dur: 2.3, rot: -45, size: 1 },
  { x: 88, delay: 0.1, dur: 2.7, rot: 60, size: 2 },
  { x: 12, delay: 0.25, dur: 2.1, rot: -20, size: 1 },
  { x: 32, delay: 0.3, dur: 2.4, rot: 100, size: 0 },
  { x: 52, delay: 0.22, dur: 1.95, rot: -65, size: 2 },
  { x: 72, delay: 0.28, dur: 2.55, rot: 35, size: 0 },
  { x: 92, delay: 0.14, dur: 2.15, rot: -95, size: 1 },
  { x: 22, delay: 0.35, dur: 2.35, rot: 50, size: 2 },
  { x: 42, delay: 0.4, dur: 2.05, rot: -40, size: 0 },
  { x: 62, delay: 0.32, dur: 2.45, rot: 75, size: 1 },
  { x: 82, delay: 0.38, dur: 2.25, rot: -15, size: 2 },
  { x: 5, delay: 0.45, dur: 2.3, rot: 85, size: 0 },
  { x: 55, delay: 0.5, dur: 2.0, rot: -70, size: 1 },
  { x: 95, delay: 0.42, dur: 2.5, rot: 20, size: 2 },
  { x: 35, delay: 0.48, dur: 2.2, rot: -50, size: 0 },
  { x: 65, delay: 0.55, dur: 2.4, rot: 110, size: 1 },
  { x: 85, delay: 0.52, dur: 1.9, rot: -25, size: 2 },
] as const

const countMap = { sm: 12, md: 18, lg: 24 } as const
</script>

<template>
  <div
    class="fx-confetti pointer-events-none absolute inset-0 overflow-hidden"
    :class="`fx-confetti--${palette}`"
    aria-hidden="true"
  >
    <span
      v-for="(p, i) in PIECES.slice(0, countMap[density])"
      :key="i"
      class="fx-confetti__piece"
      :class="`fx-confetti__piece--${p.size}`"
      :style="{
        left: `${p.x}%`,
        animationDelay: `${p.delay}s`,
        animationDuration: `${p.dur}s`,
        '--fx-rot': `${p.rot}deg`,
      }"
    />
  </div>
</template>
