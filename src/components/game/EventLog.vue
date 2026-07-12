<script setup lang="ts">
import type { EventLogItem } from '@/types/game'
import PlayerAvatar from './PlayerAvatar.vue'

withDefaults(
  defineProps<{
    items: EventLogItem[]
    compact?: boolean
    /** No outer panel (bottom sheet) */
    embedded?: boolean
    hideHeader?: boolean
  }>(),
  {
    compact: false,
    embedded: false,
    hideHeader: false,
  },
)
</script>

<template>
  <aside
    class="flex h-full min-h-0 flex-col overflow-hidden"
    :class="embedded ? 'bg-transparent' : 'panel'"
  >
    <div
      v-if="!hideHeader"
      class="flex items-center justify-between border-b border-gold-400/15"
      :class="compact ? 'px-2.5 py-1.5' : 'px-4 py-3'"
    >
      <h2
        class="font-semibold text-gold-200"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        イベントログ
      </h2>
      <span class="text-sand-dim">▾</span>
    </div>

    <ul
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      :class="compact ? 'space-y-2 px-2 py-2' : 'space-y-3 px-3 py-3'"
    >
      <li
        v-for="item in items"
        :key="item.id"
        class="flex gap-2.5 rounded-xl bg-night-900/40 px-2.5 py-2"
      >
        <PlayerAvatar
          class="shrink-0"
          :avatar="item.avatar"
          :avatar-src="item.avatarSrc"
          :name="item.name"
          size="sm"
          hide-name
        />
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
