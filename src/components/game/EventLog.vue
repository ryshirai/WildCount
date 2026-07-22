<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { EventLogItem } from '@/types/game'
import { formatRelativeTimeJa } from '@/utils/relativeTime'
import PlayerAvatar from './PlayerAvatar.vue'

const props = withDefaults(
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

const listEl = ref<HTMLElement | null>(null)
/** Ticks so relative labels (たった今 → N分前) advance without new events. */
const nowMs = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

const displayItems = computed(() =>
  props.items.map((item) => ({
    ...item,
    timeLabel:
      item.kind === 'separator'
        ? ''
        : formatRelativeTimeJa(item.ts, nowMs.value),
  })),
)

/** Newest entries are at the top — keep viewport pinned to the latest. */
async function scrollToTop() {
  await nextTick()
  const el = listEl.value
  if (el) el.scrollTop = 0
}

watch(
  () => props.items.length,
  () => {
    void scrollToTop()
  },
)

onMounted(() => {
  nowMs.value = Date.now()
  // ~30s is enough for たった今 → 1分前 without busy re-renders
  tickTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 30_000)
  void scrollToTop()
})

onUnmounted(() => {
  if (tickTimer != null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
})
</script>

<template>
  <!--
    Light information panel: timeline rows, minimal box nesting.
  -->
  <aside
    class="flex h-full min-h-0 flex-col overflow-hidden"
    :class="
      embedded
        ? 'bg-transparent'
        : 'rounded-xl border border-gold-400/10 bg-night-950/40'
    "
  >
    <div
      v-if="!hideHeader"
      class="flex shrink-0 items-center border-b border-gold-400/10"
      :class="compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5'"
    >
      <h2
        class="font-semibold tracking-wide text-sand-dim"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        対戦ログ
      </h2>
    </div>

    <ul
      ref="listEl"
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      :class="compact ? 'px-1.5 py-1' : 'px-2 py-1.5'"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <li
        v-for="(item, index) in displayItems"
        :key="item.id"
      >
        <!-- Round / phase divider -->
        <div
          v-if="item.kind === 'separator'"
          class="flex items-center gap-2 py-2"
          role="separator"
          :aria-label="item.message"
        >
          <div class="h-px min-w-[0.5rem] flex-1 bg-gold-400/20" />
          <span
            class="shrink-0 px-1 font-display text-[11px] font-semibold tracking-wide text-gold-300/90"
          >
            {{ item.message }}
          </span>
          <div class="h-px min-w-[0.5rem] flex-1 bg-gold-400/20" />
        </div>

        <!-- Timeline row (no per-item card chrome) -->
        <div
          v-else
          class="flex gap-2.5 py-2"
          :class="
            index > 0 && displayItems[index - 1]?.kind !== 'separator'
              ? 'border-t border-gold-400/10'
              : ''
          "
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
            <p
              v-if="item.timeLabel"
              class="mt-0.5 text-xs text-sand-dim/80"
            >
              {{ item.timeLabel }}
            </p>
          </div>
        </div>
      </li>
    </ul>
  </aside>
</template>
