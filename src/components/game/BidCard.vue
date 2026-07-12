<script setup lang="ts">
defineProps<{
  value: number | null
  mystery?: boolean
  compact?: boolean
}>()
</script>

<template>
  <div
    v-if="mystery || value === null"
    class="card-tile-mystery"
    :class="compact ? '!h-11 !w-9 !text-xl' : ''"
  >
    ?
  </div>
  <div v-else class="card-tile" :class="compact ? '!h-11 !w-9 !text-base' : ''">
    {{ value }}
  </div>
</template>
