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
      class="font-medium tracking-wide text-gold-300/90"
      :class="compact ? 'text-xs' : 'text-sm'"
    >
      現在の宣言
    </p>
    <p
      class="font-display font-bold leading-none text-gold-100"
      :class="compact ? 'mt-1 text-6xl' : 'mt-2 text-7xl sm:text-8xl'"
      style="text-shadow: 0 0 40px rgba(201, 168, 76, 0.35)"
    >
      {{ currentBid == null ? '—' : currentBid }}
    </p>
    <p
      v-if="showTurnsHint && turnsUntilSelf != null"
      class="mt-3 rounded-full border border-gold-400/20 bg-night-800/60 px-3 py-1 text-sand-dim"
      :class="compact ? 'text-xs' : 'text-sm'"
    >
      あなたまであと
      <span class="font-semibold text-gold-200">{{ turnsUntilSelf }}人</span>
    </p>
  </div>
</template>
