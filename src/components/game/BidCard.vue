<script setup lang="ts">
/**
 * Face-up / face-down card tile (hand display on seats).
 * Indian poker: others show `label`; self uses `mystery` (?).
 * Special faces (×2 / M→0 / ? / 0* / 1/2) get tinted frames.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Face text e.g. "+5", "×2", "M→0". Ignored when mystery. */
    label?: string | null
    /** @deprecated prefer `label` — kept for numeric bid call sites */
    value?: number | null
    mystery?: boolean
    compact?: boolean
    /** Stronger frame (self / current turn) */
    emphasized?: boolean
  }>(),
  {
    label: null,
    value: null,
    mystery: false,
    compact: false,
    emphasized: false,
  },
)

/** Face string used for layout density (long specials like M→0 / 0*). */
const displayText = computed(() =>
  props.label != null ? props.label : props.value != null ? String(props.value) : '',
)

type FaceVariant =
  | 'mystery'
  | 'number'
  | 'double'
  | 'half'
  | 'max0'
  | 'redraw'
  | 'zeromix'
  | 'negative'

const faceVariant = computed<FaceVariant>(() => {
  if (props.mystery || (props.label == null && props.value == null)) return 'mystery'
  const t = displayText.value
  if (t === '×2' || t === 'x2' || t === 'X2') return 'double'
  if (t === '1/2') return 'half'
  if (t === 'M→0' || t === 'MAX→0') return 'max0'
  if (t === '?' || t === '？') return 'redraw'
  if (t === '0*' || t.startsWith('0*')) return 'zeromix'
  if (t.startsWith('-')) return 'negative'
  return 'number'
})

/** Slightly tighter type only for 3+ char faces (+10, +15, +20, -10). */
const isDense = computed(
  () =>
    displayText.value.length >= 3 &&
    faceVariant.value !== 'double' &&
    faceVariant.value !== 'mystery',
)

const isStackedMax = computed(() => faceVariant.value === 'max0')
</script>

<template>
  <div
    class="card-tile"
    :class="[
      compact ? 'card-tile--compact' : '',
      isDense ? 'card-tile--dense' : '',
      emphasized ? 'card-tile--emphasized' : '',
      faceVariant === 'mystery' ? 'card-tile--mystery' : '',
      faceVariant === 'double' ? 'card-tile--double' : '',
      faceVariant === 'half' ? 'card-tile--half' : '',
      faceVariant === 'max0' ? 'card-tile--max0' : '',
      faceVariant === 'redraw' ? 'card-tile--redraw' : '',
      faceVariant === 'zeromix' ? 'card-tile--zeromix' : '',
      faceVariant === 'negative' ? 'card-tile--negative' : '',
      faceVariant === 'number' ? 'card-tile--number' : '',
    ]"
    :title="faceVariant === 'mystery' ? '非公開' : displayText"
    role="img"
    :aria-label="faceVariant === 'mystery' ? '非公開' : displayText"
  >
    <!-- Decorative corner ticks -->
    <span class="card-tile__pip card-tile__pip--tl" aria-hidden="true" />
    <span class="card-tile__pip card-tile__pip--br" aria-hidden="true" />

    <!-- Soft sheen -->
    <span class="card-tile__sheen" aria-hidden="true" />

    <template v-if="faceVariant === 'mystery'">
      <span class="card-tile__hero font-display">?</span>
    </template>

    <template v-else-if="faceVariant === 'double'">
      <span class="card-tile__hero font-display">×2</span>
      <span class="card-tile__badge" aria-hidden="true">DBL</span>
    </template>

    <template v-else-if="isStackedMax">
      <span class="card-tile__stack font-display">
        <span class="card-tile__stack-top">MAX</span>
        <span class="card-tile__stack-bot">→0</span>
      </span>
    </template>

    <!-- 0 捨て札→山札IN（通常 0 と区別: 暗い特殊枠 + 山IN） -->
    <template v-else-if="faceVariant === 'zeromix'">
      <svg class="card-tile__glyph" viewBox="0 0 40 40" fill="none" aria-hidden="true">
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
      <span class="card-tile__hero font-display tabular-nums">0</span>
      <span class="card-tile__badge card-tile__badge--mix" aria-hidden="true">山IN</span>
    </template>

    <template v-else>
      <span class="card-tile__hero font-display tabular-nums">
        {{ displayText }}
      </span>
    </template>
  </div>
</template>
