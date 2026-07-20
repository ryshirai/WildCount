<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WireWinCondition } from '@/online/protocol'

const props = defineProps<{
  winCondition: WireWinCondition | null | undefined
  editable: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  apply: [winCondition: WireWinCondition]
}>()

const OPTIONS: Array<{
  id: WireWinCondition
  label: string
  emoji: string
  hint: string
}> = [
  {
    id: 'first_elimination',
    label: '一人脱落で終了',
    emoji: '💀',
    hint: '誰か1人でもライフが0になったら試合終了（基本）',
  },
  {
    id: 'last_standing',
    label: '勝ち残り',
    emoji: '👑',
    hint: '最後の1人が残るまで続ける',
  },
]

function normalize(
  v: WireWinCondition | null | undefined,
): WireWinCondition {
  return v === 'last_standing' ? 'last_standing' : 'first_elimination'
}

const expanded = ref(false)
const draft = ref<WireWinCondition>(normalize(props.winCondition))

watch(
  () => props.winCondition,
  (v) => {
    draft.value = normalize(v)
  },
)

const server = computed(() => normalize(props.winCondition))

const dirty = computed(() => draft.value !== server.value)

const summaryLabel = computed(() => {
  const opt = OPTIONS.find((o) => o.id === server.value)
  return opt?.label ?? '一人脱落で終了'
})

function select(id: WireWinCondition) {
  if (!props.editable || props.disabled) return
  draft.value = id
}

function apply() {
  if (!props.editable || props.disabled || !dirty.value) return
  emit('apply', draft.value)
}

function reset() {
  draft.value = server.value
}
</script>

<template>
  <section
    class="rounded-2xl border border-gold-400/15 bg-night-900/40"
    aria-label="勝利条件"
  >
    <button
      type="button"
      class="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-4"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="text-lg" aria-hidden="true">🏁</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gold-200">勝利条件</p>
        <p class="mt-0.5 truncate text-[11px] text-sand-dim">
          {{ summaryLabel }}
        </p>
      </div>
      <span class="shrink-0 text-xs text-sand-dim" aria-hidden="true">
        {{ expanded ? '閉じる' : '開く' }}
      </span>
    </button>

    <div
      v-if="expanded"
      class="space-y-3 border-t border-gold-400/10 px-3 pb-3 pt-3 sm:px-4"
    >
      <div class="grid gap-2">
        <button
          v-for="opt in OPTIONS"
          :key="opt.id"
          type="button"
          class="flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition"
          :class="
            draft === opt.id
              ? 'border-gold-400/50 bg-gold-400/10 ring-1 ring-gold-400/30'
              : 'border-gold-400/10 bg-night-950/40 hover:border-gold-400/25'
          "
          :disabled="!editable || disabled"
          @click="select(opt.id)"
        >
          <span class="mt-0.5 text-base" aria-hidden="true">{{
            opt.emoji
          }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gold-100">{{ opt.label }}</p>
            <p class="mt-0.5 text-[11px] leading-snug text-sand-dim">
              {{ opt.hint }}
            </p>
          </div>
          <span
            class="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border"
            :class="
              draft === opt.id
                ? 'border-gold-300 bg-gold-300'
                : 'border-gold-400/40'
            "
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        v-if="editable"
        class="flex flex-wrap items-center gap-2 pt-1"
      >
        <button
          type="button"
          class="btn-gold px-3 py-1.5 text-xs"
          :disabled="disabled || !dirty"
          @click="apply"
        >
          適用
        </button>
        <button
          type="button"
          class="rounded-lg border border-gold-400/20 px-3 py-1.5 text-xs text-sand-dim transition hover:border-gold-400/40 hover:text-sand-soft disabled:opacity-40"
          :disabled="disabled || !dirty"
          @click="reset"
        >
          戻す
        </button>
      </div>
    </div>
  </section>
</template>
