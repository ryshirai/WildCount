<script setup lang="ts">
/**
 * Seat hand display: one or more BidCard tiles.
 * Multi-card hands (draw1) fan as separate tiles instead of one joined label.
 */
import { computed } from 'vue'
import BidCard from './BidCard.vue'

const props = withDefaults(
  defineProps<{
    /** Face labels when visible (ignored when mystery). */
    labels?: readonly string[] | null
    /**
     * Card count for mystery multi-tile (self forehead).
     * Falls back to labels.length when visible.
     */
    count?: number
    mystery?: boolean
    compact?: boolean
    emphasized?: boolean
  }>(),
  {
    labels: null,
    count: 0,
    mystery: false,
    compact: false,
    emphasized: false,
  },
)

const tileCount = computed(() => {
  if (props.mystery) {
    return Math.max(1, props.count > 0 ? props.count : 1)
  }
  const n = props.labels?.length ?? 0
  return n > 0 ? n : props.count > 0 ? props.count : 0
})

const tiles = computed(() => {
  const n = tileCount.value
  if (n <= 0) return [] as { key: string; label: string | null; mystery: boolean }[]
  if (props.mystery) {
    return Array.from({ length: n }, (_, i) => ({
      key: `m-${i}`,
      label: null as string | null,
      mystery: true,
    }))
  }
  const labels = props.labels ?? []
  return labels.map((label, i) => ({
    key: `f-${i}-${label}`,
    label,
    mystery: false,
  }))
})

const isMulti = computed(() => tiles.value.length >= 2)
</script>

<template>
  <div
    v-if="tiles.length > 0"
    class="hand-tiles"
    :class="[
      compact ? 'hand-tiles--compact' : '',
      isMulti ? 'hand-tiles--multi' : '',
      emphasized ? 'hand-tiles--emphasized' : '',
    ]"
  >
    <div
      v-for="(tile, i) in tiles"
      :key="tile.key"
      class="hand-tiles__item"
      :class="isMulti ? (i === 0 ? 'hand-tiles__item--back' : 'hand-tiles__item--front') : ''"
      :style="
        isMulti
          ? {
              zIndex: i + 1,
              // Light fan — keep both faces readable (avoid heavy overlap)
              transform: `rotate(${i === 0 ? -5 : 5}deg) translateY(${i === 0 ? 1 : 0}px)`,
            }
          : undefined
      "
    >
      <BidCard
        :label="tile.label"
        :mystery="tile.mystery"
        :compact="compact"
        :emphasized="emphasized"
      />
    </div>
  </div>
</template>
