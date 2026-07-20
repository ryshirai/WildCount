<script setup lang="ts">
/**
 * In-game mountain deck info: recipe totals + optional live draw-pile remaining.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import BidCard from '@/components/game/BidCard.vue'
import {
  cloneDeckComposition,
  countCards,
  deckSummaryLabel,
  isStandardDeckComposition,
  STANDARD_DECK,
  type DeckComposition,
  type SpecialCounts,
} from '@/domain/game'
import type { WireDeckComposition } from '@/online/protocol'

const props = defineProps<{
  open: boolean
  deck?: WireDeckComposition | DeckComposition | null
  /** Live draw pile remaining (public). Omit when unknown. */
  deckRemaining?: number | null
}>()

const emit = defineEmits<{
  close: []
}>()

const closeBtnRef = ref<HTMLButtonElement | null>(null)

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

function toComposition(
  source: WireDeckComposition | DeckComposition | null | undefined,
): DeckComposition {
  if (!source) return cloneDeckComposition(STANDARD_DECK)
  return {
    id: source.id,
    label: source.label,
    numbers: source.numbers.map((n) => ({ value: n.value, count: n.count })),
    specials: {
      double: source.specials.double,
      half: source.specials.half ?? 0,
      max_to_zero: source.specials.max_to_zero,
      redraw: source.specials.redraw,
      zero_mix: source.specials.zero_mix,
    },
  }
}

const composition = computed(() => toComposition(props.deck))
const total = computed(() => countCards(composition.value))
const summary = computed(() => deckSummaryLabel(composition.value))
const isStandard = computed(() => isStandardDeckComposition(composition.value))
const remaining = computed(() => {
  const n = props.deckRemaining
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.max(0, Math.floor(n))
})

const numberCardTotal = computed(() =>
  composition.value.numbers.reduce((sum, n) => sum + n.count, 0),
)

const specialCardTotal = computed(() => {
  const s = composition.value.specials
  return s.double + (s.half ?? 0) + s.max_to_zero + s.redraw + s.zero_mix
})

const summaryNumbers = computed(() =>
  [...composition.value.numbers]
    .filter((n) => n.count > 0)
    .sort((a, b) => b.value - a.value),
)

const summarySpecials = computed(() =>
  SPECIAL_ROWS.filter((row) => composition.value.specials[row.key] > 0).map(
    (row) => ({
      ...row,
      count: composition.value.specials[row.key],
    }),
  ),
)

function formatValue(v: number): string {
  if (v > 0) return `+${v}`
  return String(v)
}

function close() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      requestAnimationFrame(() => {
        closeBtnRef.value?.focus()
      })
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
        role="presentation"
      >
        <button
          type="button"
          class="absolute inset-0 bg-night-950/75 backdrop-blur-sm"
          aria-label="山札情報を閉じる"
          @click="close"
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deck-info-title"
          class="panel relative z-10 flex max-h-[min(88dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-gold-400/25 shadow-panel safe-bottom sm:rounded-2xl"
          @click.stop
        >
          <!-- Ambient -->
          <div
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_0%,rgba(201,168,76,0.12),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(42,138,138,0.1),transparent_50%)]"
            aria-hidden="true"
          />

          <div
            class="relative flex shrink-0 items-center justify-between gap-3 border-b border-gold-400/15 px-4 py-3 sm:px-5"
          >
            <div class="min-w-0">
              <p class="text-[10px] font-medium uppercase tracking-wider text-sand-dim">
                Deck
              </p>
              <h2
                id="deck-info-title"
                class="font-display text-lg font-bold text-gold-200"
              >
                この対戦の山札
              </h2>
            </div>
            <button
              ref="closeBtnRef"
              type="button"
              class="btn-ghost !p-2 text-sm"
              aria-label="閉じる"
              @click="close"
            >
              ✕
            </button>
          </div>

          <div class="relative overflow-y-auto px-4 py-5 sm:px-5">
            <div class="mb-4 flex flex-wrap items-center gap-2">
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
              <span class="text-xs text-sand-dim">{{ summary }}</span>
            </div>

            <div
              v-if="remaining != null"
              class="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gold-400/25 bg-gold-400/8 px-3 py-3"
            >
              <div class="min-w-0">
                <p class="text-[10px] font-medium uppercase tracking-wider text-gold-300/90">
                  いまの山札
                </p>
                <div class="mt-1 flex items-baseline gap-1.5">
                  <span
                    class="font-display text-4xl font-bold tabular-nums leading-none text-gold-100"
                  >
                    {{ remaining }}
                  </span>
                  <span class="pb-0.5 text-sm font-medium text-sand-dim">枚 残り</span>
                </div>
              </div>
              <p class="max-w-[14rem] pb-1 text-[11px] leading-relaxed text-sand-dim">
                ラウンドをまたいでも山はリセットしません。切れたら捨て札を戻してシャッフルします。
              </p>
            </div>

            <div class="mb-5 flex flex-wrap items-end gap-4">
              <div class="min-w-0">
                <p class="text-[10px] font-medium uppercase tracking-wider text-sand-dim">
                  構成（全部）
                </p>
                <div class="mt-1 flex items-baseline gap-1.5">
                  <span
                    class="font-display text-5xl font-bold tabular-nums leading-none text-gold-100"
                  >
                    {{ total }}
                  </span>
                  <span class="pb-1 text-base font-medium text-sand-dim">枚</span>
                </div>
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

            <p class="mb-4 rounded-xl border border-gold-400/15 bg-night-900/50 px-3 py-2 text-[11px] leading-relaxed text-sand-dim">
              下の一覧は<strong class="font-medium text-sand">開始時に決めた山札の中身</strong>です。残枚数は配札・ドロー・捨て札ミックスなどで減ります。
            </p>

            <p class="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-sand-dim">
              入っている札
            </p>
            <div class="flex flex-wrap items-start gap-x-2 gap-y-3">
              <div
                v-for="n in summaryNumbers"
                :key="`n-${n.value}`"
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

              <div
                v-for="s in summarySpecials"
                :key="`s-${s.key}`"
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

          <div
            class="relative shrink-0 border-t border-gold-400/15 px-4 py-3 sm:px-5"
          >
            <button type="button" class="btn-ghost w-full text-sm" @click="close">
              閉じる
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
