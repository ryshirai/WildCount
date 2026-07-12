<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    showWordmark?: boolean
  }>(),
  { size: 'md', showWordmark: true },
)
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div
      class="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300/30 to-night-800 ring-1 ring-gold-400/40"
      :class="size === 'lg' ? 'h-14 w-14 text-2xl' : size === 'sm' ? 'h-8 w-8 text-base' : 'h-10 w-10 text-xl'"
    >
      <span aria-hidden="true">🐺</span>
    </div>
    <h1
      v-if="showWordmark"
      class="font-display font-bold tracking-wide text-gold-200"
      :class="size === 'lg' ? 'text-3xl sm:text-4xl' : size === 'sm' ? 'text-lg' : 'text-xl sm:text-2xl'"
    >
      Wild Count
    </h1>
  </div>
</template>
