<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  cloneDeckComposition,
  countCards,
  deckSummaryLabel,
  isStandardDeckComposition,
  MAX_CUSTOM_DECK_CARDS,
  MIN_CUSTOM_DECK_CARDS,
  STANDARD_DECK,
  toEditorDeckComposition,
  type DeckComposition,
  type SpecialCounts,
} from '@/domain/game'
import type { WireDeckComposition } from '@/online/protocol'

const props = defineProps<{
  /** Server-synced deck (from PlayerView) */
  deck: WireDeckComposition | null | undefined
  /** Host can edit; guests are read-only */
  editable: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  apply: [deck: WireDeckComposition]
}>()

const SPECIAL_ROWS: Array<{
  key: keyof SpecialCounts
  label: string
  hint: string
}> = [
  { key: 'double', label: '×2', hint: '合計を2倍' },
  { key: 'max_to_zero', label: 'M→0', hint: '最大値を0に' },
  { key: 'redraw', label: '?', hint: '引き直し' },
  { key: 'zero_mix', label: '0*', hint: '捨て札ミックス' },
]

function wireToComposition(wire: WireDeckComposition | null | undefined): DeckComposition {
  if (!wire) return cloneDeckComposition(STANDARD_DECK)
  return {
    id: wire.id,
    label: wire.label,
    numbers: wire.numbers.map((n) => ({ value: n.value, count: n.count })),
    specials: { ...wire.specials },
  }
}

function compositionToWire(comp: DeckComposition): WireDeckComposition {
  return {
    id: comp.id,
    label: comp.label,
    numbers: comp.numbers.map((n) => ({ value: n.value, count: n.count })),
    specials: { ...comp.specials },
  }
}

function compositionsEqual(a: DeckComposition, b: DeckComposition): boolean {
  if (countCards(a) !== countCards(b)) return false
  const aNums = [...a.numbers]
    .filter((n) => n.count > 0)
    .sort((x, y) => x.value - y.value)
  const bNums = [...b.numbers]
    .filter((n) => n.count > 0)
    .sort((x, y) => x.value - y.value)
  if (aNums.length !== bNums.length) return false
  for (let i = 0; i < aNums.length; i++) {
    if (aNums[i]!.value !== bNums[i]!.value || aNums[i]!.count !== bNums[i]!.count) {
      return false
    }
  }
  const sa = a.specials
  const sb = b.specials
  return (
    sa.double === sb.double &&
    sa.max_to_zero === sb.max_to_zero &&
    sa.redraw === sb.redraw &&
    sa.zero_mix === sb.zero_mix
  )
}

const expanded = ref(false)
const draft = ref<DeckComposition>(toEditorDeckComposition(STANDARD_DECK))

const serverDeck = computed(() => wireToComposition(props.deck))

const serverLabel = computed(() => deckSummaryLabel(serverDeck.value))

const draftTotal = computed(() => countCards(draft.value))

const isDirty = computed(
  () => !compositionsEqual(draft.value, serverDeck.value),
)

const totalOk = computed(
  () =>
    draftTotal.value >= MIN_CUSTOM_DECK_CARDS &&
    draftTotal.value <= MAX_CUSTOM_DECK_CARDS,
)

const validationHint = computed(() => {
  if (draftTotal.value < MIN_CUSTOM_DECK_CARDS) {
    return `あと ${MIN_CUSTOM_DECK_CARDS - draftTotal.value} 枚必要です（最低 ${MIN_CUSTOM_DECK_CARDS} 枚）`
  }
  if (draftTotal.value > MAX_CUSTOM_DECK_CARDS) {
    return `${draftTotal.value - MAX_CUSTOM_DECK_CARDS} 枚減らしてください（最大 ${MAX_CUSTOM_DECK_CARDS} 枚）`
  }
  return null
})

// Sync draft when server deck changes, unless host is mid-edit
watch(
  () => props.deck,
  () => {
    if (!props.editable || !isDirty.value) {
      draft.value = toEditorDeckComposition(serverDeck.value)
    }
  },
  { immediate: true, deep: true },
)

watch(
  () => props.editable,
  (ed) => {
    if (!ed) {
      draft.value = toEditorDeckComposition(serverDeck.value)
    }
  },
)

function formatValue(v: number): string {
  if (v > 0) return `+${v}`
  return String(v)
}

function bumpNumber(value: number, delta: number) {
  if (!props.editable || props.disabled) return
  const next = toEditorDeckComposition(draft.value)
  const row = next.numbers.find((n) => n.value === value)
  if (!row) return
  row.count = Math.max(0, Math.min(50, row.count + delta))
  // Custom once edited
  if (isStandardDeckComposition(next)) {
    next.id = 'standard'
    next.label = STANDARD_DECK.label
  } else {
    next.id = 'custom'
    next.label = 'カスタム'
  }
  draft.value = next
}

function bumpSpecial(key: keyof SpecialCounts, delta: number) {
  if (!props.editable || props.disabled) return
  const next = toEditorDeckComposition(draft.value)
  next.specials[key] = Math.max(0, Math.min(50, next.specials[key] + delta))
  if (isStandardDeckComposition(next)) {
    next.id = 'standard'
    next.label = STANDARD_DECK.label
  } else {
    next.id = 'custom'
    next.label = 'カスタム'
  }
  draft.value = next
}

function resetStandard() {
  if (!props.editable || props.disabled) return
  draft.value = toEditorDeckComposition(STANDARD_DECK)
}

function discardEdits() {
  draft.value = toEditorDeckComposition(serverDeck.value)
}

function apply() {
  if (!props.editable || props.disabled || !isDirty.value || !totalOk.value) return
  const payload = compositionToWire(draft.value)
  // Drop zero-count numbers to keep wire small
  payload.numbers = payload.numbers.filter((n) => n.count > 0)
  emit('apply', payload)
}

function numberCount(value: number): number {
  return draft.value.numbers.find((n) => n.value === value)?.count ?? 0
}
</script>

<template>
  <section class="panel p-4 sm:p-5" aria-label="山札設定">
    <div class="mb-3 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-gold-200">山札</h2>
        <p class="mt-0.5 text-xs text-sand-dim">
          {{ serverLabel }}
          <span v-if="isDirty" class="text-gold-200"> · 未適用の変更あり</span>
        </p>
      </div>
      <button
        type="button"
        class="btn-ghost shrink-0 text-xs"
        @click="expanded = !expanded"
      >
        {{ expanded ? '閉じる' : editable ? 'カスタマイズ' : '詳細' }}
      </button>
    </div>

    <!-- Compact summary when collapsed -->
    <div v-if="!expanded" class="flex flex-wrap gap-1.5">
      <span
        v-for="n in serverDeck.numbers.filter((x) => x.count > 0)"
        :key="`s-${n.value}`"
        class="rounded-lg border border-gold-400/20 bg-night-900/60 px-2 py-1 font-mono text-[11px] text-sand"
      >
        {{ formatValue(n.value) }}×{{ n.count }}
      </span>
      <span
        v-for="row in SPECIAL_ROWS"
        :key="`ss-${row.key}`"
        v-show="serverDeck.specials[row.key] > 0"
        class="rounded-lg border border-teal-soft/25 bg-night-900/60 px-2 py-1 font-mono text-[11px] text-teal-soft"
      >
        {{ row.label }}×{{ serverDeck.specials[row.key] }}
      </span>
    </div>

    <div v-else class="space-y-4">
      <p v-if="!editable" class="text-xs text-sand-dim">
        ホストのみ山札を変更できます
      </p>

      <!-- Number cards -->
      <div>
        <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-sand-dim">
          数字カード
        </p>
        <ul class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <li
            v-for="value in draft.numbers.map((n) => n.value)"
            :key="value"
            class="flex items-center justify-between gap-2 rounded-xl border border-gold-400/15 bg-night-900/50 px-3 py-2"
          >
            <span class="font-mono text-sm font-semibold text-gold-100">
              {{ formatValue(value) }}
            </span>
            <div class="flex items-center gap-2">
              <button
                v-if="editable"
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-400/25 bg-night-800 text-sm text-sand disabled:opacity-40"
                :disabled="disabled || numberCount(value) <= 0"
                :aria-label="`${formatValue(value)} を1枚減らす`"
                @click="bumpNumber(value, -1)"
              >
                −
              </button>
              <span class="w-6 text-center font-mono text-sm tabular-nums text-sand">
                {{ numberCount(value) }}
              </span>
              <button
                v-if="editable"
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-400/25 bg-night-800 text-sm text-sand disabled:opacity-40"
                :disabled="disabled || numberCount(value) >= 50"
                :aria-label="`${formatValue(value)} を1枚増やす`"
                @click="bumpNumber(value, 1)"
              >
                ＋
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Specials -->
      <div>
        <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-sand-dim">
          特殊カード
        </p>
        <ul class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <li
            v-for="row in SPECIAL_ROWS"
            :key="row.key"
            class="flex items-center justify-between gap-2 rounded-xl border border-teal-soft/20 bg-night-900/50 px-3 py-2"
          >
            <div class="min-w-0">
              <span class="font-mono text-sm font-semibold text-teal-soft">
                {{ row.label }}
              </span>
              <span class="ml-1.5 text-[11px] text-sand-dim">{{ row.hint }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="editable"
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-400/25 bg-night-800 text-sm text-sand disabled:opacity-40"
                :disabled="disabled || draft.specials[row.key] <= 0"
                :aria-label="`${row.label} を1枚減らす`"
                @click="bumpSpecial(row.key, -1)"
              >
                −
              </button>
              <span class="w-6 text-center font-mono text-sm tabular-nums text-sand">
                {{ draft.specials[row.key] }}
              </span>
              <button
                v-if="editable"
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-400/25 bg-night-800 text-sm text-sand disabled:opacity-40"
                :disabled="disabled || draft.specials[row.key] >= 50"
                :aria-label="`${row.label} を1枚増やす`"
                @click="bumpSpecial(row.key, 1)"
              >
                ＋
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gold-400/15 pt-3">
        <p class="text-xs text-sand-dim">
          合計
          <span
            class="font-mono font-semibold tabular-nums"
            :class="totalOk ? 'text-gold-100' : 'text-red-300'"
          >
            {{ draftTotal }}
          </span>
          枚
          <span v-if="validationHint" class="ml-1 text-red-300">
            · {{ validationHint }}
          </span>
        </p>
        <div v-if="editable" class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-ghost text-xs"
            :disabled="disabled"
            @click="resetStandard"
          >
            スタンダードに戻す
          </button>
          <button
            type="button"
            class="btn-ghost text-xs"
            :disabled="disabled || !isDirty"
            @click="discardEdits"
          >
            変更を破棄
          </button>
          <button
            type="button"
            class="btn-teal !px-3 !py-2 text-xs"
            :disabled="disabled || !isDirty || !totalOk"
            @click="apply"
          >
            山札を適用
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
