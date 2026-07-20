<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BidCard from '@/components/game/BidCard.vue'
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
  { key: 'double', label: '×2', hint: '合計を2倍にする' },
  { key: 'half', label: '1/2', hint: '合計を半分にする（端数切り捨て）' },
  { key: 'max_to_zero', label: 'M→0', hint: 'いちばん大きいプラスを0に' },
  { key: 'redraw', label: '?', hint: '配られたら引き直し' },
  { key: 'zero_mix', label: '0*', hint: '0扱いで、捨て札を山に戻す' },
]

function wireToComposition(wire: WireDeckComposition | null | undefined): DeckComposition {
  if (!wire) return cloneDeckComposition(STANDARD_DECK)
  return {
    id: wire.id,
    label: wire.label,
    numbers: wire.numbers.map((n) => ({ value: n.value, count: n.count })),
    specials: {
      double: wire.specials.double,
      half: wire.specials.half ?? 0,
      max_to_zero: wire.specials.max_to_zero,
      redraw: wire.specials.redraw,
      zero_mix: wire.specials.zero_mix,
    },
  }
}

function compositionToWire(comp: DeckComposition): WireDeckComposition {
  return {
    id: comp.id,
    label: comp.label,
    numbers: comp.numbers.map((n) => ({ value: n.value, count: n.count })),
    specials: {
      double: comp.specials.double,
      half: comp.specials.half ?? 0,
      max_to_zero: comp.specials.max_to_zero,
      redraw: comp.specials.redraw,
      zero_mix: comp.specials.zero_mix,
    },
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
    (sa.half ?? 0) === (sb.half ?? 0) &&
    sa.max_to_zero === sb.max_to_zero &&
    sa.redraw === sb.redraw &&
    sa.zero_mix === sb.zero_mix
  )
}

const expanded = ref(false)
const draft = ref<DeckComposition>(toEditorDeckComposition(STANDARD_DECK))

const serverDeck = computed(() => wireToComposition(props.deck))

const serverLabel = computed(() => deckSummaryLabel(serverDeck.value))

const serverTotal = computed(() => countCards(serverDeck.value))

const isStandard = computed(() => isStandardDeckComposition(serverDeck.value))

const numberCardTotal = computed(() =>
  serverDeck.value.numbers.reduce((sum, n) => sum + n.count, 0),
)

const specialCardTotal = computed(() => {
  const s = serverDeck.value.specials
  return s.double + (s.half ?? 0) + s.max_to_zero + s.redraw + s.zero_mix
})

/** High-to-low number rows with count > 0 for summary strip */
const summaryNumbers = computed(() =>
  [...serverDeck.value.numbers]
    .filter((n) => n.count > 0)
    .sort((a, b) => b.value - a.value),
)

const summarySpecials = computed(() =>
  SPECIAL_ROWS.filter((row) => serverDeck.value.specials[row.key] > 0).map(
    (row) => ({
      ...row,
      count: serverDeck.value.specials[row.key],
    }),
  ),
)

/** Mini face samples for the stack preview (distinct values / specials) */
const previewFaces = computed(() => {
  const faces: Array<{
    key: string
    label: string
    kind: 'number' | 'special' | 'mystery'
    value?: number
  }> = []
  const highs = summaryNumbers.value.filter((n) => n.value >= 5).slice(0, 3)
  for (const n of highs) {
    faces.push({
      key: `n-${n.value}`,
      label: formatValue(n.value),
      kind: 'number',
      value: n.value,
    })
  }
  for (const s of summarySpecials.value.slice(0, 2)) {
    faces.push({
      key: `sp-${s.key}`,
      label: s.label,
      kind: 'special',
    })
  }
  if (faces.length < 3) {
    faces.push({ key: 'mystery', label: '?', kind: 'mystery' })
  }
  return faces.slice(0, 4)
})

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
    return `あと ${MIN_CUSTOM_DECK_CARDS - draftTotal.value} 枚足してください（${MIN_CUSTOM_DECK_CARDS} 枚以上）`
  }
  if (draftTotal.value > MAX_CUSTOM_DECK_CARDS) {
    return `${draftTotal.value - MAX_CUSTOM_DECK_CARDS} 枚減らしてください（${MAX_CUSTOM_DECK_CARDS} 枚まで）`
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

function openEditor() {
  expanded.value = true
}

function closeEditor() {
  if (isDirty.value) {
    // keep draft; host may still apply
  }
  expanded.value = false
}
</script>

<template>
  <section
    class="panel relative overflow-hidden p-0"
    aria-label="山札設定"
  >
    <!-- Ambient desert glow -->
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_0%,rgba(201,168,76,0.12),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_100%,rgba(42,138,138,0.1),transparent_50%)]"
      aria-hidden="true"
    />

    <!-- ========== Collapsed: polished summary ========== -->
    <div v-if="!expanded" class="relative">
      <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
        <!-- Card stack preview (same BidCard tiles as the board) -->
        <div
          class="relative mx-auto flex h-[7.5rem] w-[6.5rem] shrink-0 items-end justify-center sm:mx-0 sm:h-32 sm:w-28"
          aria-hidden="true"
        >
          <!-- Back layers (mystery face, same as board) -->
          <div
            class="absolute bottom-1 left-1/2 origin-bottom -translate-x-1/2 rotate-[-14deg] scale-90 opacity-55"
          >
            <BidCard mystery />
          </div>
          <div
            class="absolute bottom-1.5 left-1/2 origin-bottom -translate-x-[42%] rotate-[-6deg] scale-95 opacity-75"
          >
            <BidCard mystery />
          </div>
          <!-- Face cards fanned -->
          <div
            v-for="(face, i) in previewFaces"
            :key="face.key"
            class="absolute bottom-0 origin-bottom"
            :style="{
              transform: `translateX(calc(-50% + ${(i - (previewFaces.length - 1) / 2) * 14}px)) rotate(${(i - (previewFaces.length - 1) / 2) * 7}deg)`,
              left: '50%',
              zIndex: i + 2,
            }"
          >
            <BidCard
              :label="face.kind === 'mystery' ? null : face.label"
              :mystery="face.kind === 'mystery'"
            />
          </div>
        </div>

        <!-- Meta + CTA -->
        <div class="min-w-0 flex-1">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <h2 class="font-display text-base font-semibold tracking-wide text-gold-200 sm:text-lg">
              山札
            </h2>
            <span
              class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              :class="
                isStandard
                  ? 'border border-gold-400/30 bg-gold-400/10 text-gold-200'
                  : 'border border-teal-soft/35 bg-teal-deep/40 text-teal-soft'
              "
            >
              {{ isStandard ? 'スタンダード' : 'カスタム' }}
            </span>
            <span
              v-if="isDirty"
              class="rounded-full border border-amber-400/40 bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium text-amber-200"
            >
              まだ反映していません
            </span>
          </div>

          <p class="mb-3 text-xs leading-relaxed text-sand-dim sm:text-[13px]">
            {{ serverLabel }}
            <template v-if="editable">
              · 各札の枚数を調整できます
            </template>
            <template v-else>
              · ホストが決めた内容です
            </template>
          </p>

          <!-- Big total + breakdown -->
          <div class="mb-3 flex flex-wrap items-end gap-4">
            <div class="flex items-baseline gap-1.5">
              <span
                class="font-display text-4xl font-bold tabular-nums leading-none text-gold-100 sm:text-5xl"
              >
                {{ serverTotal }}
              </span>
              <span class="pb-1 text-sm font-medium text-sand-dim">枚</span>
            </div>
            <div class="flex flex-wrap gap-2 pb-1">
              <span
                class="inline-flex items-center gap-1.5 rounded-xl border border-gold-400/20 bg-night-900/70 px-2.5 py-1.5 text-[11px] text-sand"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-gold-300" aria-hidden="true" />
                数字
                <span class="font-mono font-semibold tabular-nums text-gold-100">
                  {{ numberCardTotal }}
                </span>
              </span>
              <span
                class="inline-flex items-center gap-1.5 rounded-xl border border-teal-soft/25 bg-night-900/70 px-2.5 py-1.5 text-[11px] text-sand"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-teal-soft" aria-hidden="true" />
                特殊
                <span class="font-mono font-semibold tabular-nums text-teal-soft">
                  {{ specialCardTotal }}
                </span>
              </span>
            </div>
          </div>

          <button
            type="button"
            class="w-full sm:w-auto"
            :class="editable ? 'btn-teal' : 'btn-ghost btn-sm'"
            :disabled="disabled"
            @click="openEditor"
          >
            <span v-if="editable" aria-hidden="true">✦</span>
            {{ editable ? '枚数を変更する' : '中身を見る' }}
          </button>
        </div>
      </div>

      <!-- Composition: mini tiles (wrap on sm+; no horizontal scroll needed on PC) -->
      <div
        class="border-t border-gold-400/15 bg-night-950/40 px-4 py-3 sm:px-5"
      >
        <p class="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-sand-dim">
          入っている札
        </p>
        <div class="flex flex-wrap items-start gap-x-2 gap-y-3">
          <!-- Number mini tiles -->
          <div
            v-for="n in summaryNumbers"
            :key="`sum-n-${n.value}`"
            class="flex flex-col items-center"
          >
            <BidCard :label="formatValue(n.value)" compact />
            <span
              class="mt-1 rounded-full border border-gold-400/20 bg-night-900/80 px-1.5 py-px font-mono text-[10px] tabular-nums text-sand-dim"
            >
              ×{{ n.count }}
            </span>
          </div>

          <div
            v-if="summarySpecials.length > 0"
            class="hidden h-12 w-px self-center bg-gradient-to-b from-transparent via-gold-400/35 to-transparent sm:block"
            aria-hidden="true"
          />

          <!-- Special mini tiles -->
          <div
            v-for="s in summarySpecials"
            :key="`sum-s-${s.key}`"
            class="flex flex-col items-center"
            :title="s.hint"
          >
            <BidCard :label="s.label" compact />
            <span
              class="mt-1 rounded-full border border-teal-soft/20 bg-night-900/80 px-1.5 py-px font-mono text-[10px] tabular-nums text-teal-soft/90"
            >
              ×{{ s.count }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== Expanded: editor ========== -->
    <div v-else class="relative space-y-4 p-4 sm:p-5">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h2 class="font-display text-base font-semibold text-gold-200 sm:text-lg">
            山札の枚数を変更
          </h2>
          <p class="mt-0.5 text-xs text-sand-dim">
            {{ serverLabel }}
            <span v-if="isDirty" class="text-gold-200"> · まだ反映していません</span>
          </p>
        </div>
        <button type="button" class="btn-ghost shrink-0 text-xs" @click="closeEditor">
          閉じる
        </button>
      </div>

      <p v-if="!editable" class="rounded-xl border border-gold-400/15 bg-night-900/50 px-3 py-2 text-xs text-sand-dim">
        山札を変えられるのはホストだけです
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
            <BidCard :label="formatValue(value)" compact />
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
            <div class="flex min-w-0 items-center gap-2">
              <BidCard :label="row.label" compact class="shrink-0" />
              <span class="text-[11px] text-sand-dim">{{ row.hint }}</span>
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
            標準に戻す
          </button>
          <button
            type="button"
            class="btn-ghost text-xs"
            :disabled="disabled || !isDirty"
            @click="discardEdits"
          >
            やめる
          </button>
          <button
            type="button"
            class="btn-teal btn-sm"
            :disabled="disabled || !isDirty || !totalOk"
            @click="apply"
          >
            この内容で反映
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
