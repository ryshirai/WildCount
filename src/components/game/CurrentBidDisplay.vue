<script setup lang="ts">
withDefaults(
  defineProps<{
    currentBid: number | null
    turnsUntilSelf?: number
    compact?: boolean
    showTurnsHint?: boolean
  }>(),
  {
    showTurnsHint: true,
  },
)
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <p
      class="font-medium tracking-[0.15em] text-gold-300/90"
      :class="compact ? 'text-xs' : 'text-sm'"
    >
      現在の宣言
    </p>
    <p
      class="font-display font-bold leading-none text-gold-100"
      :class="
        compact
          ? 'mt-1 text-5xl sm:text-6xl'
          : 'mt-2 text-5xl sm:text-7xl xl:text-8xl'
      "
      style="text-shadow: 0 0 48px rgba(201, 168, 76, 0.4), 0 0 12px rgba(201, 168, 76, 0.25)"
    >
      {{ currentBid == null ? '—' : currentBid }}
    </p>
    <p
      v-if="showTurnsHint && turnsUntilSelf != null"
      class="mt-3 rounded-full border border-gold-400/25 bg-night-800/70 px-3.5 py-1 text-sand-dim shadow-sm backdrop-blur-sm"
      :class="compact ? 'text-xs' : 'text-sm'"
    >
      あなたまであと
      <span class="font-semibold text-gold-200">{{ turnsUntilSelf }}人</span>
    </p>
  </div>
</template>
