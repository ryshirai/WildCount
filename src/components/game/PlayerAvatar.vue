<script setup lang="ts">
defineProps<{
  avatar: string
  name: string
  seatIndex?: number
  size?: 'sm' | 'md' | 'lg'
  highlighted?: boolean
  self?: boolean
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <div class="relative">
      <div
        v-if="seatIndex != null"
        class="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-night-900 text-[10px] font-bold text-gold-300 ring-1 ring-gold-400/40"
      >
        {{ seatIndex }}
      </div>
      <div
        class="flex items-center justify-center rounded-full bg-gradient-to-b from-night-600 to-night-800 ring-2"
        :class="[
          size === 'lg' ? 'h-14 w-14 text-2xl' : size === 'sm' ? 'h-9 w-9 text-base' : 'h-11 w-11 text-xl',
          highlighted
            ? 'ring-gold-300 shadow-gold-glow'
            : self
              ? 'ring-teal-soft/80'
              : 'ring-gold-400/30',
        ]"
      >
        <span class="select-none leading-none" aria-hidden="true">{{ avatar }}</span>
      </div>
    </div>
    <div class="max-w-[4.5rem] text-center leading-tight">
      <div
        class="truncate text-xs font-semibold"
        :class="self ? 'text-teal-soft' : 'text-sand'"
      >
        {{ name }}
      </div>
      <slot name="status" />
    </div>
  </div>
</template>
