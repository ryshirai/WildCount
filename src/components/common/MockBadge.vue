<script setup lang="ts">
/**
 * Dev-only corner badge. Never rendered in production builds.
 */
import { allowUiMock } from '@/config/runtime'

defineProps<{
  label?: string
}>()
</script>

<template>
  <div
    v-if="allowUiMock"
    class="pointer-events-none fixed bottom-3 left-3 z-30 hidden rounded bg-night-800/80 px-2 py-1 text-[10px] text-sand-dim ring-1 ring-gold-400/20 lg:block"
  >
    {{ label ?? 'DEV · UI モック可' }}
  </div>
</template>
