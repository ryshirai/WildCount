<script setup lang="ts">
/**
 * Full-screen help dialog (UX-5).
 * Content from src/data/helpContent.ts — specs in docs/game-rules.md / card-design.md.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  HELP_BASICS,
  HELP_CALC_STEPS,
  HELP_CHALLENGE_RULE,
  HELP_CONTROLS,
  HELP_DECK_SIZE,
  HELP_EXTRA_RULES,
  HELP_NUMBER_SUMMARY,
  HELP_SPECIALS,
  HELP_TABS,
  type HelpTabId,
} from '@/data/helpContent'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Initial / controlled tab when opened */
    initialTab?: HelpTabId
  }>(),
  {
    initialTab: 'basics',
  },
)

const emit = defineEmits<{
  close: []
}>()

const activeTab = ref<HelpTabId>(props.initialTab)
const panelRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)

const tabLabel = computed(
  () => HELP_TABS.find((t) => t.id === activeTab.value)?.label ?? 'ヘルプ',
)

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

function selectTab(id: HelpTabId) {
  activeTab.value = id
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      activeTab.value = props.initialTab
      // Focus close control after paint
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

const specialKindClass: Record<string, string> = {
  double: 'help-face help-face--double',
  half: 'help-face help-face--half',
  max_to_zero: 'help-face help-face--max0',
  redraw: 'help-face help-face--redraw',
  zero_mix: 'help-face help-face--zeromix',
  number: 'help-face help-face--number',
}
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
        <!-- Backdrop -->
        <button
          type="button"
          class="absolute inset-0 bg-night-950/75 backdrop-blur-sm"
          aria-label="ヘルプを閉じる"
          @click="close"
        />

        <!-- Panel -->
        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          class="panel relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border-gold-400/25 shadow-panel safe-bottom sm:max-h-[min(88dvh,36rem)] sm:rounded-2xl"
          @click.stop
        >
          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between gap-3 border-b border-gold-400/15 px-4 py-3 sm:px-5"
          >
            <div class="min-w-0">
              <p class="text-[10px] font-medium uppercase tracking-wider text-sand-dim">
                Help
              </p>
              <h2
                id="help-modal-title"
                class="font-display text-lg font-bold tracking-wide text-gold-200"
              >
                遊び方・ルール
              </h2>
            </div>
            <button
              ref="closeBtnRef"
              type="button"
              class="btn-ghost !px-3 !py-1.5 text-xs"
              @click="close"
            >
              閉じる
            </button>
          </div>

          <!-- Tabs -->
          <div
            class="flex shrink-0 gap-1 overflow-x-auto border-b border-gold-400/10 px-2 py-2 sm:px-3"
            role="tablist"
            :aria-label="`ヘルプの区分（${tabLabel}）`"
          >
            <button
              v-for="tab in HELP_TABS"
              :key="tab.id"
              type="button"
              role="tab"
              class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition"
              :class="
                activeTab === tab.id
                  ? 'bg-gold-400/20 text-gold-100 ring-1 ring-gold-400/40'
                  : 'text-sand-dim hover:bg-night-700/80 hover:text-sand'
              "
              :aria-selected="activeTab === tab.id"
              @click="selectTab(tab.id)"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Body -->
          <div
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5"
            role="tabpanel"
          >
            <!-- Basics -->
            <section v-if="activeTab === 'basics'" class="space-y-4">
              <p class="text-sm leading-relaxed text-sand">
                {{ HELP_BASICS.tagline }}
              </p>
              <ul class="space-y-2.5">
                <li
                  v-for="(line, i) in HELP_BASICS.bullets"
                  :key="i"
                  class="flex gap-2.5 text-sm leading-relaxed text-sand"
                >
                  <span
                    class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold-400/30 bg-night-900/80 text-[10px] font-bold text-gold-200"
                    aria-hidden="true"
                  >
                    {{ i + 1 }}
                  </span>
                  <span>{{ line }}</span>
                </li>
              </ul>
              <p
                class="rounded-xl border border-teal-soft/20 bg-teal-deep/20 px-3 py-2.5 text-xs leading-relaxed text-teal-soft"
              >
                {{ HELP_BASICS.visibilityNote }}
              </p>

              <!-- Extra rules (soft intro on 遊び方) -->
              <div
                class="rounded-xl border border-gold-400/15 bg-night-900/50 px-3 py-3 sm:px-3.5"
              >
                <h3 class="mb-1.5 text-sm font-semibold text-gold-100">
                  エクストラルール（任意）
                </h3>
                <p class="mb-2.5 text-xs leading-relaxed text-sand-dim">
                  {{ HELP_BASICS.extrasLead }}
                </p>
                <ul class="mb-3 space-y-2">
                  <li
                    v-for="(tip, i) in HELP_BASICS.extrasTips"
                    :key="'xt' + i"
                    class="flex gap-2 text-xs leading-relaxed text-sand"
                  >
                    <span class="shrink-0 text-gold-200/80" aria-hidden="true">·</span>
                    <span>{{ tip }}</span>
                  </li>
                </ul>
                <p class="mb-2 text-[11px] font-medium text-gold-200/90">
                  {{ HELP_EXTRA_RULES.sharedNote }}
                </p>
                <ul class="space-y-2.5">
                  <li
                    v-for="item in HELP_EXTRA_RULES.items"
                    :key="item.name"
                    class="rounded-lg border border-gold-400/10 bg-night-800/40 px-2.5 py-2"
                  >
                    <p class="text-xs font-semibold text-gold-100">
                      <span aria-hidden="true" class="mr-1">{{ item.emoji }}</span>
                      {{ item.name }}
                    </p>
                    <p class="mt-0.5 text-[11px] leading-relaxed text-sand-dim">
                      {{ item.detail }}
                    </p>
                  </li>
                </ul>
                <p class="mt-2.5 text-[11px] leading-relaxed text-sand-dim">
                  {{ HELP_EXTRA_RULES.deckNote }}
                </p>
              </div>
            </section>

            <!-- Special cards -->
            <section v-else-if="activeTab === 'cards'" class="space-y-4">
              <p class="text-xs text-sand-dim">
                スタンダードの山札は全部で
                <span class="font-semibold text-gold-200">{{ HELP_DECK_SIZE }}枚</span>
                （数字と特殊札）。特殊札の見た目は結果画面と同じです。
              </p>

              <ul class="space-y-3">
                <li
                  v-for="card in HELP_SPECIALS"
                  :key="card.kind"
                  class="flex gap-3 rounded-xl border border-gold-400/15 bg-night-900/50 p-3"
                >
                  <div
                    class="shrink-0"
                    :class="specialKindClass[card.kind]"
                    aria-hidden="true"
                  >
                    {{ card.face }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <h3 class="text-sm font-semibold text-gold-100">
                        {{ card.name }}
                      </h3>
                      <span class="text-[10px] text-sand-dim">×{{ card.count }}</span>
                    </div>
                    <p class="text-xs leading-relaxed text-sand-dim">
                      {{ card.effect }}
                    </p>
                  </div>
                </li>
              </ul>

              <div class="rounded-xl border border-gold-400/12 bg-night-900/40 px-3 py-3">
                <h3 class="mb-2 text-xs font-semibold text-gold-200">
                  エクストラルール（特殊能力）
                </h3>
                <p class="mb-2 text-[11px] leading-relaxed text-sand-dim">
                  {{ HELP_EXTRA_RULES.intro }}
                </p>
                <p class="mb-2 text-[11px] leading-relaxed text-sand-dim">
                  {{ HELP_EXTRA_RULES.sharedNote }}
                </p>
                <ul class="space-y-2">
                  <li
                    v-for="item in HELP_EXTRA_RULES.items"
                    :key="item.name"
                    class="text-xs leading-relaxed text-sand"
                  >
                    <span aria-hidden="true" class="mr-0.5">{{ item.emoji }}</span>
                    <span class="font-medium text-gold-200/90">{{ item.name }}</span>
                    <span class="text-sand-dim"> — {{ item.detail }}</span>
                  </li>
                </ul>
                <p class="mt-2 text-[11px] leading-relaxed text-sand-dim">
                  {{ HELP_EXTRA_RULES.deckNote }}
                </p>
              </div>

              <div class="rounded-xl border border-gold-400/12 bg-night-900/40 px-3 py-3">
                <h3 class="mb-2 text-xs font-semibold text-gold-200">数字カード</h3>
                <ul class="space-y-1.5">
                  <li
                    v-for="row in HELP_NUMBER_SUMMARY"
                    :key="row.label"
                    class="flex gap-2 text-xs text-sand"
                  >
                    <span class="w-16 shrink-0 font-medium text-gold-200/90">{{
                      row.label
                    }}</span>
                    <span class="text-sand-dim">{{ row.detail }}</span>
                  </li>
                </ul>
              </div>
            </section>

            <!-- Calculation -->
            <section v-else-if="activeTab === 'calc'" class="space-y-4">
              <p class="text-sm text-sand">
                「コヨーテ！」のあとの合計は、次の順番で一度だけ決まります。
              </p>
              <ol class="space-y-2">
                <li
                  v-for="(step, i) in HELP_CALC_STEPS"
                  :key="i"
                  class="flex gap-2.5 rounded-xl border border-gold-400/12 bg-night-900/45 px-3 py-2.5 text-sm text-sand"
                >
                  <span
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gold-400/15 font-display text-xs font-bold text-gold-200"
                    aria-hidden="true"
                  >
                    {{ i + 1 }}
                  </span>
                  <span class="leading-relaxed">{{ step }}</span>
                </li>
              </ol>

              <div
                class="rounded-xl border border-gold-400/20 bg-night-900/55 px-3 py-3"
              >
                <h3 class="mb-2 text-sm font-semibold text-gold-200">
                  {{ HELP_CHALLENGE_RULE.title }}
                </h3>
                <ul class="space-y-1.5">
                  <li
                    v-for="(line, i) in HELP_CHALLENGE_RULE.lines"
                    :key="i"
                    class="text-xs leading-relaxed text-sand-dim"
                  >
                    · {{ line }}
                  </li>
                </ul>
              </div>
            </section>

            <!-- Controls -->
            <section v-else class="space-y-4">
              <div>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-200">
                  手番
                </h3>
                <ul class="space-y-2">
                  <li
                    v-for="(line, i) in HELP_CONTROLS.turn"
                    :key="'t' + i"
                    class="text-sm leading-relaxed text-sand"
                  >
                    {{ line }}
                  </li>
                </ul>
              </div>
              <div>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-200">
                  オンライン対戦
                </h3>
                <ul class="space-y-2">
                  <li
                    v-for="(line, i) in HELP_CONTROLS.online"
                    :key="'o' + i"
                    class="text-sm leading-relaxed text-sand"
                  >
                    {{ line }}
                  </li>
                </ul>
              </div>
              <div>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-200">
                  結果
                </h3>
                <ul class="space-y-2">
                  <li
                    v-for="(line, i) in HELP_CONTROLS.result"
                    :key="'r' + i"
                    class="text-sm leading-relaxed text-sand"
                  >
                    {{ line }}
                  </li>
                </ul>
              </div>
            </section>
          </div>

          <!-- Footer hint -->
          <div
            class="shrink-0 border-t border-gold-400/10 px-4 py-2.5 text-center text-[10px] text-sand-dim sm:px-5"
          >
            Esc キー、または外側をタップで閉じられます
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.help-face {
  display: flex;
  height: 2.75rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  font-family: var(--font-display, ui-sans-serif), system-ui, sans-serif;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.help-face--double {
  border: 1px solid rgba(42, 138, 138, 0.55);
  background: linear-gradient(
    to bottom,
    rgba(20, 80, 80, 0.95),
    #0c1220 70%
  );
  color: #5ec8c8;
  box-shadow: 0 0 12px rgba(42, 138, 138, 0.25);
}

.help-face--half {
  border: 1px solid rgba(167, 139, 250, 0.55);
  background: linear-gradient(
    to bottom,
    rgba(76, 29, 149, 0.55),
    #0c1220 70%
  );
  color: #c4b5fd;
  font-size: 0.65rem;
  box-shadow: 0 0 12px rgba(167, 139, 250, 0.2);
}

.help-face--max0 {
  border: 1px solid rgba(245, 158, 11, 0.5);
  background: linear-gradient(to bottom, rgba(120, 70, 10, 0.55), #0c1220);
  color: #fcd34d;
  font-size: 0.55rem;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.18);
}

.help-face--redraw {
  border: 1px solid rgba(201, 168, 76, 0.45);
  background: linear-gradient(to bottom, #2a3148, #0c1220);
  color: #e8d48b;
  font-size: 1.1rem;
}

.help-face--zeromix {
  border: 1px solid rgba(251, 191, 36, 0.55);
  background: linear-gradient(to bottom, #fef3c7, #fcd34d);
  color: #1a1520;
  font-size: 0.85rem;
}

.help-face--number {
  border: 1px solid rgba(201, 168, 76, 0.55);
  background: linear-gradient(to bottom, #faf6eb, #c9a84c);
  color: #1a1520;
}
</style>
