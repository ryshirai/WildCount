<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AvatarAssetId } from '@/localGame/avatarCatalog'
import type { ChatMessage } from '@/online/protocol'
import type { StampId } from '@/online/stamps'
import { STAMP_CATALOG, characterStampSrc } from '@/online/stamps'
import PlayerAvatar from './PlayerAvatar.vue'

const props = withDefaults(
  defineProps<{
    messages: ChatMessage[]
    selfPlayerId?: string | null
    /** Resolve avatar emoji / src / asset id from playerId when available */
    avatarForPlayer?: (playerId: string) => {
      avatar: string
      avatarSrc?: string
      avatarId?: AvatarAssetId
    }
    /** Self avatar asset id for stamp picker previews */
    selfAvatarId?: AvatarAssetId | null
    disabled?: boolean
    disabledHint?: string
    compact?: boolean
    /** No outer panel chrome (bottom sheet / drawer) */
    embedded?: boolean
    /** Hide the title row (parent sheet provides chrome) */
    hideHeader?: boolean
    /**
     * R4: hide in-panel stamp grid (mobile game uses StampPickerSheet only).
     * Desktop chat keeps the picker.
     */
    hideStampPicker?: boolean
  }>(),
  {
    selfPlayerId: null,
    /** Bear when parent omits id — emotion stamps still get character art */
    selfAvatarId: 'self',
    disabled: false,
    disabledHint: 'オンライン対戦のときだけ使えます',
    compact: false,
    embedded: false,
    hideHeader: false,
    hideStampPicker: false,
  },
)

const emit = defineEmits<{
  send: [text: string]
  reaction: [stampId: StampId]
}>()

const draft = ref('')
const listEl = ref<HTMLElement | null>(null)
const stampOpen = ref(false)

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
  return { avatar: '👤' as const, avatarSrc: undefined, avatarId: undefined }
}

/** Precompute per-row data once per messages change (avoid N× template calls). */
const displayRows = computed(() =>
  props.messages.map((m) => {
    const av = avatarOf(m.playerId)
    const isStamp = m.kind === 'stamp'
    return {
      id: m.id,
      displayName: m.displayName,
      text: m.text,
      stampId: m.stampId,
      isSelf: m.playerId === props.selfPlayerId,
      isStamp,
      stampSrc:
        isStamp && m.stampId
          ? characterStampSrc(av.avatarId, m.stampId)
          : null,
      avatar: av.avatar,
      avatarSrc: av.avatarSrc,
      time: formatTime(m.ts),
    }
  }),
)

const pickerItems = computed(() => {
  const av = props.selfAvatarId ?? 'self'
  return STAMP_CATALOG.map((s) => ({
    id: s.id as StampId,
    label: s.label,
    emoji: s.emoji,
    src: characterStampSrc(av, s.id),
  }))
})

function onSubmit() {
  if (!canSend.value) return
  const text = draft.value
  draft.value = ''
  stampOpen.value = false
  emit('send', text)
  void scrollToBottom()
}

function onPickStamp(stampId: StampId) {
  if (props.disabled) return
  stampOpen.value = false
  emit('reaction', stampId)
  void scrollToBottom()
}

function toggleStampPicker() {
  if (props.disabled) return
  stampOpen.value = !stampOpen.value
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
    class="flex h-full min-h-0 flex-col overflow-hidden"
    :class="embedded ? 'bg-transparent' : 'panel'"
  >
    <div
      v-if="!hideHeader"
      class="flex items-center justify-between border-b border-gold-400/15"
      :class="compact ? 'px-2.5 py-1.5' : 'px-3 py-2'"
    >
      <h2
        class="font-semibold text-gold-200"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        チャット
      </h2>
      <span class="text-[10px] text-sand-dim">ルーム内</span>
    </div>

    <div
      ref="listEl"
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      :class="compact ? 'space-y-1.5 px-2 py-2' : 'space-y-2 px-2.5 py-2.5'"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <p
        v-if="displayRows.length === 0"
        class="px-1 text-center text-xs text-sand-dim"
        :class="compact ? 'py-4' : 'py-5'"
      >
        まだメッセージはありません
      </p>
      <div
        v-for="row in displayRows"
        :key="row.id"
        class="flex gap-1.5 rounded-lg"
        :class="[
          compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
          row.isSelf ? 'bg-teal-deep/25' : 'bg-night-900/40',
        ]"
      >
        <PlayerAvatar
          class="shrink-0"
          :avatar="row.avatar"
          :avatar-src="row.avatarSrc"
          :name="row.displayName"
          size="sm"
          hide-name
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-1.5">
            <span
              class="truncate font-semibold text-gold-200"
              :class="compact ? 'text-[11px]' : 'text-xs'"
            >
              {{ row.displayName }}
              <span
                v-if="row.isSelf"
                class="ml-0.5 font-normal text-sand-dim"
                >（自分）</span
              >
            </span>
            <span class="shrink-0 text-[10px] text-sand-dim">{{
              row.time
            }}</span>
          </div>
          <div
            v-if="row.isStamp"
            class="mt-0.5 select-none leading-none"
            :title="row.stampId ?? row.text"
          >
            <img
              v-if="row.stampSrc"
              :src="row.stampSrc"
              alt=""
              class="rounded-full object-cover ring-1 ring-gold-400/30"
              :class="compact ? 'h-9 w-9' : 'h-11 w-11'"
              draggable="false"
              decoding="async"
              loading="lazy"
            />
            <span
              v-else
              :class="compact ? 'text-2xl' : 'text-3xl'"
              >{{ row.text }}</span
            >
          </div>
          <p
            v-else
            class="mt-0.5 break-words leading-snug text-sand"
            :class="compact ? 'text-xs' : 'text-sm'"
          >
            {{ row.text }}
          </p>
        </div>
      </div>
    </div>

    <!-- Stamp palette (desktop / when not hideStampPicker) -->
    <div
      v-if="stampOpen && !disabled && !hideStampPicker"
      class="shrink-0 border-t border-gold-400/15 bg-night-950/80 px-1.5 py-1.5"
      role="listbox"
      aria-label="スタンプ"
    >
      <div class="grid grid-cols-5 gap-1">
        <button
          v-for="s in pickerItems"
          :key="s.id"
          type="button"
          role="option"
          class="flex flex-col items-center rounded-lg border border-gold-400/10 bg-night-900/60 px-0.5 py-1 transition hover:border-gold-400/35 hover:bg-teal-deep/30 active:scale-95"
          :title="s.label"
          :aria-label="s.label"
          @click="onPickStamp(s.id)"
        >
          <img
            v-if="s.src"
            :src="s.src"
            alt=""
            class="h-7 w-7 rounded-full object-cover"
            draggable="false"
            decoding="async"
          />
          <span v-else class="text-lg leading-none">{{ s.emoji }}</span>
          <span class="mt-0.5 max-w-full truncate text-[8px] text-sand-dim">{{
            s.label
          }}</span>
        </button>
      </div>
    </div>

    <form
      class="flex shrink-0 items-center border-t border-gold-400/15"
      :class="compact ? 'gap-1 p-1.5' : 'gap-1.5 p-2'"
      @submit.prevent="onSubmit"
    >
      <button
        v-if="!hideStampPicker"
        type="button"
        class="btn-ghost shrink-0 leading-none"
        :class="[
          compact ? '!px-1.5 !py-1 text-sm' : '!px-2 !py-1.5 text-base',
          stampOpen ? 'border-gold-400/40 text-gold-200' : '',
        ]"
        :disabled="disabled"
        :aria-expanded="stampOpen"
        aria-label="スタンプを開く"
        title="スタンプ"
        @click="toggleStampPicker"
      >
        😀
      </button>
      <input
        v-model="draft"
        type="text"
        maxlength="120"
        autocomplete="off"
        enterkeyhint="send"
        class="min-w-0 flex-1 border border-gold-400/20 bg-night-900/80 text-sand placeholder:text-sand-dim focus:border-gold-400/45 focus:outline-none"
        :class="
          compact
            ? 'rounded-lg px-2 py-1 text-xs'
            : 'rounded-xl px-2.5 py-1.5 text-sm'
        "
        :placeholder="disabled ? disabledHint : 'メッセージを入力…'"
        :disabled="disabled"
        aria-label="チャットメッセージ"
      />
      <button
        type="submit"
        class="btn-teal shrink-0"
        :class="compact ? '!px-2 !py-1 text-[11px]' : '!px-2.5 !py-1.5 text-xs'"
        :disabled="!canSend"
      >
        送信
      </button>
    </form>
  </aside>
</template>
