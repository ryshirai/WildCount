<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ChatMessage } from '@/online/protocol'
import PlayerAvatar from './PlayerAvatar.vue'

const props = withDefaults(
  defineProps<{
    messages: ChatMessage[]
    selfPlayerId?: string | null
    /** Resolve avatar emoji / src from playerId when available */
    avatarForPlayer?: (playerId: string) => {
      avatar: string
      avatarSrc?: string
    }
    disabled?: boolean
    disabledHint?: string
    compact?: boolean
  }>(),
  {
    selfPlayerId: null,
    disabled: false,
    disabledHint: 'オンライン対戦でのみ利用できます',
    compact: false,
  },
)

const emit = defineEmits<{
  send: [text: string]
}>()

const draft = ref('')
const listEl = ref<HTMLElement | null>(null)

const canSend = computed(
  () => !props.disabled && draft.value.trim().length > 0,
)

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function avatarOf(playerId: string) {
  if (props.avatarForPlayer) return props.avatarForPlayer(playerId)
  return { avatar: '👤' as const, avatarSrc: undefined }
}

function onSubmit() {
  if (!canSend.value) return
  const text = draft.value
  draft.value = ''
  emit('send', text)
  void scrollToBottom()
}

async function scrollToBottom() {
  await nextTick()
  const el = listEl.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(
  () => props.messages.length,
  () => {
    void scrollToBottom()
  },
)
</script>

<template>
  <aside
    class="panel flex h-full min-h-0 flex-col overflow-hidden"
    :class="compact ? '' : ''"
  >
    <div
      class="flex items-center justify-between border-b border-gold-400/15 px-4 py-3"
    >
      <h2 class="text-sm font-semibold text-gold-200">チャット</h2>
      <span class="text-[11px] text-sand-dim">ルーム内</span>
    </div>

    <div
      ref="listEl"
      class="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <p
        v-if="messages.length === 0"
        class="px-1 py-6 text-center text-xs text-sand-dim"
      >
        まだメッセージはありません
      </p>
      <div
        v-for="m in messages"
        :key="m.id"
        class="flex gap-2 rounded-xl px-2 py-1.5"
        :class="
          m.playerId === selfPlayerId
            ? 'bg-teal-deep/25'
            : 'bg-night-900/40'
        "
      >
        <PlayerAvatar
          class="shrink-0"
          :avatar="avatarOf(m.playerId).avatar"
          :avatar-src="avatarOf(m.playerId).avatarSrc"
          :name="m.displayName"
          size="sm"
          hide-name
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <span class="truncate text-xs font-semibold text-gold-200">
              {{ m.displayName }}
              <span
                v-if="m.playerId === selfPlayerId"
                class="ml-1 font-normal text-sand-dim"
                >（自分）</span
              >
            </span>
            <span class="shrink-0 text-[10px] text-sand-dim">{{
              formatTime(m.ts)
            }}</span>
          </div>
          <p class="mt-0.5 break-words text-sm leading-snug text-sand">
            {{ m.text }}
          </p>
        </div>
      </div>
    </div>

    <form
      class="flex shrink-0 gap-2 border-t border-gold-400/15 p-2.5"
      @submit.prevent="onSubmit"
    >
      <input
        v-model="draft"
        type="text"
        maxlength="120"
        autocomplete="off"
        enterkeyhint="send"
        class="min-w-0 flex-1 rounded-xl border border-gold-400/20 bg-night-900/80 px-3 py-2 text-sm text-sand placeholder:text-sand-dim focus:border-gold-400/45 focus:outline-none"
        :placeholder="disabled ? disabledHint : 'メッセージを入力…'"
        :disabled="disabled"
        aria-label="チャットメッセージ"
      />
      <button
        type="submit"
        class="btn-teal !px-3 !py-2 text-xs"
        :disabled="!canSend"
      >
        送信
      </button>
    </form>
  </aside>
</template>
