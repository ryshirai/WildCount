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
      class="shrink-0 overflow-hidden rounded-full ring-1 ring-gold-400/40 shadow-gold-glow"
      :class="size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'"
    >
      <img
        src="/brand/logo-mark.webp"
        alt=""
        width="56"
        height="56"
        class="h-full w-full object-cover"
        decoding="async"
      />
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
