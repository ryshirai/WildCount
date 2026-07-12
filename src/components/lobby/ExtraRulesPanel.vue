<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WireExtraRules } from '@/online/protocol'

const props = defineProps<{
  extraRules: WireExtraRules | null | undefined
  editable: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  apply: [rules: WireExtraRules]
}>()

const ROWS: Array<{
  key: keyof WireExtraRules
  label: string
  emoji: string
  hint: string
}> = [
  {
    key: 'same',
    label: 'セイム',
    emoji: '✋',
    hint: '数字を上げずに「その宣言のまま」次の人へパス',
  },
  {
    key: 'change',
    label: 'チェンジ',
    emoji: '🔀',
    hint: '直前に宣言した人に、別の数字へ付け直しさせる',
  },
  {
    key: 'reverse',
    label: 'リバース',
    emoji: '🔄',
    hint: '宣言と一緒に使う。手番の回る向きが逆になる',
  },
  {
    key: 'shot',
    label: 'ショット',
    emoji: '🎯',
    hint: '宣言と一緒に使う。次の手番を好きな人に指名',
  },
  {
    key: 'draw1',
    label: 'ドロー',
    emoji: '🃏',
    hint: '宣言と一緒に使う。誰かに札を1枚足す（場全体で1回）',
  },
  {
    key: 'lifeDouble',
    label: 'ダブル',
    emoji: '⚡',
    hint: '宣言と一緒に使う。次がすぐコヨーテなら負けはライフ2減',
  },
]

function defaults(): WireExtraRules {
  return {
    same: false,
    change: false,
    reverse: false,
    shot: false,
    draw1: false,
    lifeDouble: false,
  }
}

function normalize(r: WireExtraRules | null | undefined): WireExtraRules {
  return { ...defaults(), ...(r ?? {}) }
}

const expanded = ref(false)
const draft = ref<WireExtraRules>(normalize(props.extraRules))

watch(
  () => props.extraRules,
  (v) => {
    draft.value = normalize(v)
  },
  { deep: true },
)

const server = computed(() => normalize(props.extraRules))

const enabledCount = computed(
  () => ROWS.filter((row) => server.value[row.key]).length,
)

const dirty = computed(() => {
  const a = draft.value
  const b = server.value
  return ROWS.some((row) => a[row.key] !== b[row.key])
})

function toggle(key: keyof WireExtraRules) {
  if (!props.editable || props.disabled) return
  draft.value = { ...draft.value, [key]: !draft.value[key] }
}

function apply() {
  if (!props.editable || props.disabled || !dirty.value) return
  emit('apply', { ...draft.value })
}

function resetAll() {
  if (!props.editable || props.disabled) return
  draft.value = defaults()
}
</script>

<template>
  <section
    class="rounded-2xl border border-gold-400/20 bg-night-900/60 px-3 py-3 sm:px-4"
    aria-label="エクストラルール"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 text-left"
      @click="expanded = !expanded"
    >
      <div>
        <p class="text-sm font-semibold text-gold-100">エクストラルール</p>
        <p class="mt-0.5 text-[11px] text-sand-dim">
          <template v-if="enabledCount === 0">オフ＝ふつうの遊び方</template>
          <template v-else>{{ enabledCount }} 個オン</template>
          · ホストが変更可
        </p>
      </div>
      <span class="text-xs text-sand-dim">{{ expanded ? '閉じる' : '開く' }}</span>
    </button>

    <div v-if="expanded" class="mt-3 space-y-2 border-t border-gold-400/10 pt-3">
      <p class="rounded-xl border border-gold-400/10 bg-night-900/50 px-3 py-2 text-[11px] leading-relaxed text-sand-dim">
        足したいものだけオンにしてください。オンにした能力は
        <span class="text-sand">1人・1ラウンドで1回まで</span>
        （どれか1つ使ったら、そのラウンドは他も使えません）。
      </p>
      <label
        v-for="row in ROWS"
        :key="row.key"
        class="flex cursor-pointer items-start gap-3 rounded-xl border border-gold-400/10 bg-night-800/50 px-3 py-2"
        :class="
          !editable || disabled
            ? 'cursor-default opacity-80'
            : 'hover:border-gold-400/25'
        "
      >
        <input
          type="checkbox"
          class="mt-1 h-4 w-4 accent-gold-400"
          :checked="draft[row.key]"
          :disabled="!editable || disabled"
          @change="toggle(row.key)"
        />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-sand-100">
            <span aria-hidden="true" class="mr-1">{{ row.emoji }}</span>
            {{ row.label }}
          </span>
          <span class="mt-0.5 block text-[11px] leading-snug text-sand-dim">{{
            row.hint
          }}</span>
        </span>
      </label>

      <div
        v-if="editable"
        class="flex flex-wrap items-center justify-end gap-2 pt-1"
      >
        <button
          type="button"
          class="btn-ghost !px-3 !py-1.5 text-xs"
          :disabled="disabled"
          @click="resetAll"
        >
          すべて OFF
        </button>
        <button
          type="button"
          class="btn-teal !px-3 !py-1.5 text-xs"
          :disabled="disabled || !dirty"
          @click="apply"
        >
          ルールを反映
        </button>
      </div>
      <p v-else class="text-center text-[11px] text-sand-dim">
        閲覧のみ（ホストが設定します）
      </p>
    </div>
  </section>
</template>
