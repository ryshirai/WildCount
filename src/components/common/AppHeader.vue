<script setup lang="ts">
import AppLogo from '@/components/common/AppLogo.vue'

withDefaults(
  defineProps<{
    /** Sticky top bar (scroll pages). Set false for fixed-layout parents. */
    sticky?: boolean
    /** Apply safe-area top padding. Disable when a banner above owns safe-top. */
    safeTop?: boolean
    /** Tighter padding for game mobile chrome. */
    compact?: boolean
  }>(),
  { sticky: true, safeTop: true, compact: false },
)
</script>

<template>
  <header
    class="z-30 shrink-0 border-b border-gold-400/15 bg-night-900/90 backdrop-blur-md"
    :class="[
      sticky ? 'sticky top-0' : '',
      safeTop ? 'safe-top' : '',
    ]"
  >
    <div
      class="flex items-center justify-between"
      :class="
        compact
          ? 'gap-1.5 px-2 py-1.5'
          : 'gap-3 px-4 py-3 sm:px-6'
      "
    >
      <div class="min-w-0 shrink">
        <slot name="brand">
          <AppLogo :size="compact ? 'sm' : 'sm'" />
        </slot>
      </div>
      <div
        class="flex min-w-0 items-center"
        :class="compact ? 'gap-0.5' : 'gap-2'"
      >
        <slot name="chips" />
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
