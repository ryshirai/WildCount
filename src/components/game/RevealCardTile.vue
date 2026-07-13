<script setup lang="ts">
/**
 * Result-screen card face.
 * Numbers: gold tile. Specials (×2 / MAX→0 / ? / 0mix): CSS/SVG — not AI art.
 * Wave-2: special sparkle / number light pop on reveal.
 */
import { computed } from 'vue'
import type { CardKind } from '@/types/game'
import FxSparkleBurst from '@/components/common/FxSparkleBurst.vue'

const props = withDefaults(
  defineProps<{
    kind: CardKind
    /** Display label e.g. "+5", "×2", "M→0" (aria / title) */
    label: string
    /** Numeric value when applicable */
    value?: number | null
    size?: 'md' | 'lg'
    /** Trigger flip-in (parent staggers via revealed count) */
    revealed?: boolean
  }>(),
  {
    value: null,
    size: 'lg',
    revealed: true,
  },
)

const sizeClass: Record<'md' | 'lg', string> = {
  md: 'h-[3.85rem] w-[2.95rem]',
  lg: 'h-[4.35rem] w-[3.25rem] sm:h-[5rem] sm:w-[3.65rem]',
}

const isSpecial = computed(
  () =>
    props.kind === 'double' ||
    props.kind === 'max_to_zero' ||
    props.kind === 'redraw' ||
    props.kind === 'zero_mix' ||
    props.kind === 'half',
)
</script>

<template>
  <div
    class="reveal-card"
    :class="[
      sizeClass[size],
      revealed
        ? isSpecial
          ? 'reveal-card--sparkle-ring'
          : 'reveal-card--in'
        : 'reveal-card--hidden',
      kind === 'double' ? 'reveal-card--double' : '',
      kind === 'max_to_zero' ? 'reveal-card--max0' : '',
      kind === 'redraw' ? 'reveal-card--redraw' : '',
      kind === 'zero_mix' ? 'reveal-card--zeromix' : '',
      kind === 'number' ? 'reveal-card--number' : '',
    ]"
    :title="label"
    role="img"
    :aria-label="label"
  >
    <span class="reveal-card__sheen" aria-hidden="true" />
    <span class="reveal-card__pip reveal-card__pip--tl" aria-hidden="true" />
    <span class="reveal-card__pip reveal-card__pip--br" aria-hidden="true" />
    <span
      v-if="revealed && isSpecial"
      class="reveal-sparkle"
      aria-hidden="true"
    />
    <FxSparkleBurst
      v-if="revealed && isSpecial"
      density="sm"
      :palette="kind === 'double' ? 'mixed' : 'gold'"
    />
    <!-- DOUBLE ×2 -->
    <template v-if="kind === 'double'">
      <svg class="reveal-card__glyph" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="15.5" stroke="currentColor" stroke-width="1.75" opacity="0.55" />
        <circle cx="20" cy="20" r="11" stroke="currentColor" stroke-width="1" opacity="0.3" />
      </svg>
      <span class="reveal-card__hero font-display">×2</span>
      <span class="reveal-card__badge">DBL</span>
    </template>

    <!-- MAX → 0（2行: 小さな MAX + 大きな →0。1行 "MAX→0" は幅不足で潰れる） -->
    <template v-else-if="kind === 'max_to_zero'">
      <svg
        class="reveal-card__glyph reveal-card__glyph--wide"
        viewBox="0 0 48 28"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 22 L14 6 L22 16 L30 8 L44 22"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.9"
        />
        <circle cx="14" cy="6" r="2" fill="currentColor" />
        <line
          x1="6"
          y1="24"
          x2="42"
          y2="24"
          stroke="currentColor"
          stroke-width="1.25"
          stroke-dasharray="2.5 2"
          opacity="0.45"
        />
      </svg>
      <span class="reveal-card__stack font-display">
        <span class="reveal-card__stack-top">MAX</span>
        <span class="reveal-card__stack-bot">→0</span>
      </span>
    </template>

    <!-- REDRAW ? -->
    <template v-else-if="kind === 'redraw'">
      <svg class="reveal-card__glyph" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M28 14.5a9 9 0 1 0 1.8 8.2"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path d="M26.5 11.5 L30.5 16.5 L24.5 16.5 Z" fill="currentColor" />
      </svg>
      <span class="reveal-card__hero font-display">?</span>
    </template>

    <!-- 0* 捨札ミックス（通常 0 は +0。ヒーローは 0 のみで幅を抑える） -->
    <template v-else-if="kind === 'zero_mix'">
      <span class="reveal-card__hero font-display tabular-nums">0</span>
      <span class="reveal-card__sub">捨札混</span>
    </template>

    <!-- Number -->
    <template v-else>
      <span
        class="reveal-card__hero font-display tabular-nums"
        :class="{
          'text-rose-700': value != null && value < 0,
        }"
      >
        {{ label }}
      </span>
    </template>
  </div>
</template>
