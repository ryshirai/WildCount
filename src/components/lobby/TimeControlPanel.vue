<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WireTimeControl } from '@/online/protocol'

const props = defineProps<{
  timeControl: WireTimeControl | null | undefined
  editable: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  apply: [timeControl: WireTimeControl | null]
}>()

/** Presets shown as chips. main + turn (seconds). */
const PRESETS: Array<{
  id: string
  label: string
  value: WireTimeControl | null
  hint: string
}> = [
  {
    id: 'off',
    label: 'なし',
    value: null,
    hint: '制限時間なし',
  },
  {
    id: '30+15',
    label: '30秒 + 15秒',
    value: { mainSeconds: 30, turnSeconds: 15 },
    hint: 'サクサク短時間',
  },
  {
    id: '60+20',
    label: '1分 + 20秒',
    value: { mainSeconds: 60, turnSeconds: 20 },
    hint: '軽め',
  },
  {
    id: '180+20',
    label: '3分 + 20秒',
    value: { mainSeconds: 180, turnSeconds: 20 },
    hint: '標準寄り',
  },
  {
    id: '300+20',
    label: '5分 + 20秒',
    value: { mainSeconds: 300, turnSeconds: 20 },
    hint: '持ち時間5分 → 毎ターン20秒',
  },
]

function sameControl(
  a: WireTimeControl | null | undefined,
  b: WireTimeControl | null | undefined,
): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return a.mainSeconds === b.mainSeconds && a.turnSeconds === b.turnSeconds
}

function formatControl(tc: WireTimeControl | null | undefined): string {
  if (tc == null) return '制限時間なし'
  const main =
    tc.mainSeconds >= 60 && tc.mainSeconds % 60 === 0
      ? `${tc.mainSeconds / 60}分`
      : `${tc.mainSeconds}秒`
  return `${main} + ${tc.turnSeconds}秒`
}

const expanded = ref(false)
const draft = ref<WireTimeControl | null>(props.timeControl ?? null)
const customMain = ref(300)
const customTurn = ref(20)

watch(
  () => props.timeControl,
  (v) => {
    draft.value = v ?? null
    if (v) {
      customMain.value = v.mainSeconds
      customTurn.value = v.turnSeconds
    }
  },
  { deep: true },
)

const server = computed(() => props.timeControl ?? null)

const dirty = computed(() => !sameControl(draft.value, server.value))

const selectedPresetId = computed(() => {
  const d = draft.value
  const found = PRESETS.find((p) => sameControl(p.value, d))
  return found?.id ?? 'custom'
})

function pickPreset(p: (typeof PRESETS)[number]) {
  if (!props.editable || props.disabled) return
  draft.value = p.value ? { ...p.value } : null
  if (p.value) {
    customMain.value = p.value.mainSeconds
    customTurn.value = p.value.turnSeconds
  }
}

function applyCustom() {
  if (!props.editable || props.disabled) return
  const main = Math.max(0, Math.min(3600, Math.floor(customMain.value) || 0))
  const turn = Math.max(5, Math.min(300, Math.floor(customTurn.value) || 5))
  customMain.value = main
  customTurn.value = turn
  draft.value = { mainSeconds: main, turnSeconds: turn }
}

function apply() {
  if (!props.editable || props.disabled || !dirty.value) return
  emit('apply', draft.value ? { ...draft.value } : null)
}
</script>

<template>
  <section
    class="rounded-2xl border border-gold-400/20 bg-night-900/60 px-3 py-3 sm:px-4"
    aria-label="制限時間"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 text-left"
      @click="expanded = !expanded"
    >
      <div>
        <p class="text-sm font-semibold text-gold-100">制限時間</p>
        <p class="mt-0.5 text-[11px] text-sand-dim">
          {{ formatControl(server) }} · ホストが変更可
        </p>
      </div>
      <span class="text-xs text-sand-dim">{{ expanded ? '閉じる' : '開く' }}</span>
    </button>

    <div v-if="expanded" class="mt-3 space-y-3 border-t border-gold-400/10 pt-3">
      <p
        class="rounded-xl border border-gold-400/10 bg-night-900/50 px-3 py-2 text-[11px] leading-relaxed text-sand-dim"
      >
        <span class="text-sand">持ち時間 + 毎ターンの一時時間</span>
        です。手番では
        <span class="text-sand">一時時間が先に減り</span>、尽きたら持ち時間が減ります。
        使い切らなかった一時時間は持ち越しません。
      </p>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PRESETS"
          :key="p.id"
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs transition"
          :class="
            selectedPresetId === p.id
              ? 'border-teal-soft/60 bg-teal-deep/40 text-teal-soft'
              : 'border-gold-400/20 bg-night-800/60 text-sand hover:border-gold-400/40'
          "
          :disabled="!editable || disabled"
          :title="p.hint"
          @click="pickPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>

      <div
        v-if="editable"
        class="rounded-xl border border-gold-400/10 bg-night-800/40 px-3 py-2"
      >
        <p class="mb-2 text-[11px] font-medium text-gold-200">カスタム（秒）</p>
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1 text-[11px] text-sand-dim">
            持ち時間
            <input
              v-model.number="customMain"
              type="number"
              min="0"
              max="3600"
              step="10"
              class="w-24 rounded-lg border border-gold-400/20 bg-night-900 px-2 py-1.5 text-sm text-sand"
              :disabled="disabled"
            />
          </label>
          <span class="pb-2 text-sand-dim">+</span>
          <label class="flex flex-col gap-1 text-[11px] text-sand-dim">
            毎ターン
            <input
              v-model.number="customTurn"
              type="number"
              min="5"
              max="300"
              step="5"
              class="w-24 rounded-lg border border-gold-400/20 bg-night-900 px-2 py-1.5 text-sm text-sand"
              :disabled="disabled"
            />
          </label>
          <button
            type="button"
            class="btn-ghost !px-3 !py-1.5 text-xs"
            :disabled="disabled"
            @click="applyCustom"
          >
            下書きに反映
          </button>
        </div>
      </div>

      <p class="text-center text-xs text-sand">
        選択中:
        <span class="font-medium text-gold-200">{{ formatControl(draft) }}</span>
      </p>

      <div
        v-if="editable"
        class="flex flex-wrap items-center justify-end gap-2 pt-1"
      >
        <button
          type="button"
          class="btn-teal !px-3 !py-1.5 text-xs"
          :disabled="disabled || !dirty"
          @click="apply"
        >
          制限時間を反映
        </button>
      </div>
      <p v-else class="text-center text-[11px] text-sand-dim">
        閲覧のみ（ホストが設定します）
      </p>
    </div>
  </section>
</template>
