<script setup lang="ts">
import AppLogo from '@/components/common/AppLogo.vue'

withDefaults(
  defineProps<{
    /** Sticky top bar (scroll pages). Set false for fixed-layout parents. */
    sticky?: boolean
  }>(),
  { sticky: true },
)
</script>

<template>
  <header
    class="z-30 shrink-0 border-b border-gold-400/15 bg-night-900/90 backdrop-blur-md safe-top"
    :class="sticky ? 'sticky top-0' : ''"
  >
    <div class="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div class="min-w-0 shrink">
        <slot name="brand">
          <AppLogo size="sm" />
        </slot>
      </div>
      <div class="flex min-w-0 items-center gap-2">
        <slot name="chips" />
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
