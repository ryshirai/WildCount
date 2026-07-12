<script setup lang="ts">
import type { EventLogItem } from '@/types/game'

defineProps<{
  items: EventLogItem[]
  compact?: boolean
}>()
</script>

<template>
  <aside class="panel flex h-full min-h-0 flex-col overflow-hidden">
    <div
      class="flex items-center justify-between border-b border-gold-400/15 px-4 py-3"
    >
      <h2 class="text-sm font-semibold text-gold-200">イベントログ</h2>
      <span class="text-sand-dim">▾</span>
    </div>

    <ul class="flex-1 space-y-3 overflow-y-auto px-3 py-3">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex gap-2.5 rounded-xl bg-night-900/40 px-2.5 py-2"
      >
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night-700 text-base ring-1 ring-gold-400/20"
        >
          {{ item.avatar }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm leading-snug text-sand">
            <span class="font-semibold text-gold-200">{{ item.name }}</span>
            が{{ item.message }}
          </p>
          <p class="mt-0.5 text-[11px] text-sand-dim">{{ item.timeLabel }}</p>
        </div>
      </li>
    </ul>

    <button
      type="button"
      class="border-t border-gold-400/15 px-4 py-2.5 text-center text-xs text-gold-300 hover:bg-night-700/40"
    >
      ログをすべて表示
    </button>
  </aside>
</template>
