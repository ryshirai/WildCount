<script setup lang="ts">
/**
 * Result-screen card face.
 * Numbers: gold tile. Specials (×2 / MAX→0 / ? / 0mix): CSS/SVG — not AI art.
 * Wave-2: special sparkle / number light pop on reveal.
 * Wave-3: emphasis (self / extreme / special pulse).
 */
import { computed } from 'vue'
import type { CardKind } from '@/types/game'
import FxSparkleBurst from '@/components/common/FxSparkleBurst.vue'
import { isExtremeNumber } from '@/utils/resultDrama'

export type CardEmphasis = 'none' | 'self' | 'extreme' | 'special'

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
    /** Drama emphasis (wave-3) */
    emphasis?: CardEmphasis
    /**
     * This face came from opening a `?`. While `faceOpen` is false, show
     * the mystery `?` face; when true, play the open transition to `kind`.
     */
    openedFromRedraw?: boolean
    /** Final face visible (default true for normal cards / skip). */
    faceOpen?: boolean
    /** Mid-open pulse (parent sets briefly while flipping). */
    opening?: boolean
  }>(),
  {
    value: null,
    size: 'lg',
    revealed: true,
    emphasis: 'none',
    openedFromRedraw: false,
    faceOpen: true,
    opening: false,
  },
)

/** Face shown right now — stay on `?` until faceOpen. */
const displayKind = computed<CardKind>(() => {
  if (props.openedFromRedraw && !props.faceOpen) return 'redraw'
  return props.kind
})

const displayLabel = computed(() => {
  if (props.openedFromRedraw && !props.faceOpen) return '?'
  return props.label
})

const displayValue = computed(() => {
  if (props.openedFromRedraw && !props.faceOpen) return null
  return props.value
})

const sizeClass: Record<'md' | 'lg', string> = {
  md: 'h-[3.85rem] w-[2.95rem]',
  lg: 'h-[4.35rem] w-[3.25rem] sm:h-[5rem] sm:w-[3.65rem]',
}

const isSpecial = computed(
  () =>
    displayKind.value === 'double' ||
    displayKind.value === 'max_to_zero' ||
    displayKind.value === 'redraw' ||
    displayKind.value === 'zero_mix' ||
    displayKind.value === 'half',
)

const resolvedEmphasis = computed<CardEmphasis>(() => {
  if (props.emphasis !== 'none') return props.emphasis
  if (isSpecial.value) return 'special'
  if (displayKind.value === 'number' && isExtremeNumber(displayValue.value))
    return 'extreme'
  return 'none'
})

/** Final face just opened from ? — extra sparkle burst */
const justOpened = computed(
  () => props.openedFromRedraw && props.faceOpen && props.revealed,
)

/**
 * Flip-in / sparkle-ring set `animation` (incl. transform).
 * That overrides --opening / --from-redraw later in the stylesheet —
 * so never attach them during a ? open sequence.
 */
const entranceClass = computed(() => {
  if (!props.revealed) return 'reveal-card--hidden'
  if (props.openedFromRedraw || props.opening) return ''
  if (isSpecial.value) return 'reveal-card--sparkle-ring'
  return 'reveal-card--in'
})
</script>

<template>
  <div
    class="reveal-card"
    :class="[
      sizeClass[size],
      entranceClass,
      displayKind === 'double' ? 'reveal-card--double' : '',
      displayKind === 'max_to_zero' ? 'reveal-card--max0' : '',
      displayKind === 'redraw' ? 'reveal-card--redraw' : '',
      displayKind === 'zero_mix' ? 'reveal-card--zeromix' : '',
      displayKind === 'number' ? 'reveal-card--number' : '',
      displayKind === 'half' ? 'reveal-card--double' : '',
      revealed && resolvedEmphasis === 'self' ? 'reveal-card--self' : '',
      revealed && resolvedEmphasis === 'extreme' ? 'reveal-card--extreme' : '',
      revealed &&
      (resolvedEmphasis === 'special' || isSpecial) &&
      (displayKind === 'double' || displayKind === 'max_to_zero') &&
      !openedFromRedraw
        ? 'reveal-card--impact'
        : '',
      openedFromRedraw && !faceOpen && revealed && !opening
        ? 'reveal-card--mystery-wait'
        : '',
      opening ? 'reveal-card--opening' : '',
      justOpened && !opening ? 'reveal-card--from-redraw' : '',
    ]"
    :title="displayLabel"
    role="img"
    :aria-label="
      openedFromRedraw && !faceOpen
        ? '引き直しカード（未オープン）'
        : openedFromRedraw
          ? `？からオープン: ${label}`
          : label
    "
  >
    <span class="reveal-card__sheen" aria-hidden="true" />
    <span class="reveal-card__pip reveal-card__pip--tl" aria-hidden="true" />
    <span class="reveal-card__pip reveal-card__pip--br" aria-hidden="true" />
    <!-- Skip particle FX on ? open path — remount mid-zoom causes hitch -->
    <span
      v-if="revealed && isSpecial && !openedFromRedraw"
      class="reveal-sparkle"
      aria-hidden="true"
    />
    <FxSparkleBurst
      v-if="revealed && isSpecial && !openedFromRedraw"
      density="sm"
      :palette="displayKind === 'double' ? 'mixed' : 'gold'"
    />
    <!-- DOUBLE ×2 -->
    <template v-if="displayKind === 'double'">
      <svg class="reveal-card__glyph" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="15.5" stroke="currentColor" stroke-width="1.75" opacity="0.55" />
        <circle cx="20" cy="20" r="11" stroke="currentColor" stroke-width="1" opacity="0.3" />
      </svg>
      <span class="reveal-card__hero font-display">×2</span>
      <span class="reveal-card__badge">DBL</span>
    </template>

    <!-- HALF 1/2 -->
    <template v-else-if="displayKind === 'half'">
      <span class="reveal-card__hero font-display">1/2</span>
    </template>

    <!-- MAX → 0（2行: 小さな MAX + 大きな →0。1行 "MAX→0" は幅不足で潰れる） -->
    <template v-else-if="displayKind === 'max_to_zero'">
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

    <!-- REDRAW ? (including pre-open mystery) -->
    <template v-else-if="displayKind === 'redraw'">
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
      <span
        v-if="openedFromRedraw && !faceOpen"
        class="reveal-card__badge"
        >OPEN</span
      >
    </template>

    <!-- 0 捨て札→山札IN（通常 0 と区別: 暗い特殊枠 + 循環矢印 + 山IN） -->
    <template v-else-if="displayKind === 'zero_mix'">
      <svg class="reveal-card__glyph" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M12 16c1.8-3.2 5.2-5.2 9-5.2 4.6 0 8.5 3 9.8 7.2"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          opacity="0.55"
        />
        <path d="M28.5 14.2 L32.2 18.5 L26.5 19.2 Z" fill="currentColor" opacity="0.55" />
        <path
          d="M28 24c-1.8 3.2-5.2 5.2-9 5.2-4.6 0-8.5-3-9.8-7.2"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          opacity="0.55"
        />
        <path d="M11.5 25.8 L7.8 21.5 L13.5 20.8 Z" fill="currentColor" opacity="0.55" />
      </svg>
      <span class="reveal-card__hero font-display tabular-nums">0</span>
      <span class="reveal-card__badge reveal-card__badge--mix">山IN</span>
    </template>

    <!-- Number -->
    <template v-else>
      <span
        class="reveal-card__hero font-display tabular-nums"
        :class="{
          'text-rose-700': displayValue != null && displayValue < 0,
        }"
      >
        {{ displayLabel }}
      </span>
      <span
        v-if="openedFromRedraw && faceOpen"
        class="reveal-card__badge reveal-card__badge--from-q"
        >？→</span
      >
    </template>
  </div>
</template>
