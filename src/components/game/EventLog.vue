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

/**
 * Visual weight from message content (no protocol change).
 * high: coyote / life / round-critical · mid: declare · low: connect / wait-ish
 */
type LogWeight = 'high' | 'mid' | 'low'

function weightForMessage(message: string, name: string): LogWeight {
  const t = `${name} ${message}`
  if (
    /コヨーテ|チャレンジ|脱落|ライフ|敗北|勝利|ゲーム終了|終了/.test(t)
  ) {
    return 'high'
  }
  if (/宣言|セイム|チェンジ|ショット|リバース|ドロー|ダブル/.test(t)) {
    return 'mid'
  }
  return 'low'
}

const displayItems = computed(() =>
  props.items.map((item, index) => ({
    ...item,
    timeLabel:
      item.kind === 'separator'
        ? ''
        : formatRelativeTimeJa(item.ts, nowMs.value),
    weight:
      item.kind === 'separator'
        ? ('mid' as LogWeight)
        : weightForMessage(item.message, item.name),
    /** Newest first — fade older rows slightly */
    recency: index === 0 ? 'fresh' : index < 3 ? 'recent' : 'older',
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
    Light information panel: timeline with importance hierarchy, minimal chrome.
  -->
  <aside
    class="event-log flex h-full min-h-0 flex-col overflow-hidden"
    :class="
      embedded
        ? 'bg-transparent'
        : 'rounded-md border-0 bg-transparent'
    "
  >
    <div
      v-if="!hideHeader"
      class="flex shrink-0 items-center"
      :class="compact ? 'px-1.5 py-1' : 'px-2 py-1.5'"
    >
      <h2
        class="font-medium tracking-wide text-sand-dim/55"
        :class="compact ? 'text-[10px]' : 'text-[11px]'"
      >
        対戦ログ
      </h2>
    </div>

    <ul
      ref="listEl"
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      :class="compact ? 'px-1 py-0.5' : 'px-1 py-0.5'"
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
          class="flex items-center gap-2 py-1.5"
          role="separator"
          :aria-label="item.message"
        >
          <div class="h-px min-w-[0.5rem] flex-1 bg-gold-400/15" />
          <span
            class="shrink-0 px-0.5 font-display text-[10px] font-semibold tracking-wide text-gold-300/75"
          >
            {{ item.message }}
          </span>
          <div class="h-px min-w-[0.5rem] flex-1 bg-gold-400/15" />
        </div>

        <!-- Timeline row -->
        <div
          v-else
          class="event-log__row flex gap-2 py-1.5"
          :class="[
            index > 0 && displayItems[index - 1]?.kind !== 'separator'
              ? 'border-t border-white/[0.04]'
              : '',
            `event-log__row--${item.weight}`,
            `event-log__row--${item.recency}`,
          ]"
        >
          <PlayerAvatar
            class="shrink-0 opacity-75"
            :avatar="item.avatar"
            :avatar-src="item.avatarSrc"
            :name="item.name"
            size="sm"
            hide-name
          />
          <div class="min-w-0 flex-1">
            <p
              class="leading-snug"
              :class="
                item.weight === 'high'
                  ? 'text-sm text-sand'
                  : item.weight === 'mid'
                    ? 'text-[13px] text-sand/90'
                    : 'text-xs text-sand-dim/85'
              "
            >
              <span
                :class="
                  item.weight === 'high'
                    ? 'font-semibold text-gold-100'
                    : item.weight === 'mid'
                      ? 'font-semibold text-gold-200/85'
                      : 'font-medium text-gold-200/60'
                "
              >{{ item.name }}</span>
              <span
                :class="
                  item.weight === 'low' ? 'text-sand-dim/75' : 'text-sand/85'
                "
              >が{{ item.message }}</span>
            </p>
            <p
              v-if="item.timeLabel"
              class="mt-0.5 text-[10px] tabular-nums text-sand-dim/40"
            >
              {{ item.timeLabel }}
            </p>
          </div>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.event-log__row--fresh {
  opacity: 1;
}
.event-log__row--recent {
  opacity: 0.94;
}
.event-log__row--older {
  opacity: 0.78;
}

/* High-weight: slightly stronger name glow, still light chrome */
.event-log__row--high :deep(.ring-2) {
  box-shadow: 0 0 0 1px rgba(201, 168, 76, 0.2);
}
</style>
