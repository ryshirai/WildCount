<script setup lang="ts">
/**
 * Face-up / face-down card tile.
 * Indian poker: others show `label`; self uses `mystery` (?).
 * Also usable for bid chips via numeric label.
 */
withDefaults(
  defineProps<{
    /** Face text e.g. "+5", "×2", "18". Ignored when mystery. */
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
</script>

<template>
  <div
    v-if="mystery || (label == null && value == null)"
    class="card-tile-mystery"
    :class="[
      compact ? '!h-11 !w-9 !text-xl' : '',
      emphasized ? 'ring-2 ring-gold-300/60 shadow-turn-glow' : '',
    ]"
    title="非公開"
  >
    ?
  </div>
  <div
    v-else
    class="card-tile"
    :class="[
      compact ? '!h-11 !w-9 !text-sm' : '',
      emphasized ? 'ring-2 ring-gold-400/50 shadow-gold-glow' : '',
    ]"
  >
    {{ label != null ? label : value }}
  </div>
</template>
