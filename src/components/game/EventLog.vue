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
        対戦ログ
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
      >
        <!-- Round / phase divider -->
        <div
          v-if="item.kind === 'separator'"
          class="flex items-center gap-2 py-1"
          role="separator"
          :aria-label="item.message"
        >
          <div class="h-px min-w-[0.75rem] flex-1 bg-gradient-to-r from-transparent to-gold-400/35" />
          <span
            class="shrink-0 rounded-full border border-gold-400/40 bg-gold-400/10 px-2.5 py-0.5 font-display text-[10px] font-semibold tracking-wide text-gold-200 sm:text-[11px]"
          >
            {{ item.message }}
          </span>
          <div class="h-px min-w-[0.75rem] flex-1 bg-gradient-to-l from-transparent to-gold-400/35" />
        </div>

        <!-- Player / room action -->
        <div
          v-else
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
