<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { playSfx } from '@/audio'
import type { ClientBidExtra } from '@/online/protocol'

export type BidExtraChoice = ClientBidExtra['type'] | 'none'

export interface BidTargetOption {
  id: string
  name: string
}

interface SkillOption {
  id: BidExtraChoice
  emoji: string
  label: string
  hint: string
}

const bid = defineModel<number>({ required: true })

const props = defineProps<{
  minBid?: number
  /** Forced rebid: this value is illegal */
  forbiddenValue?: number | null
  canChallenge?: boolean
  canDeclare?: boolean
  canSame?: boolean
  canChange?: boolean
  /** 特殊能力 (bid-ride skills) allowed this turn */
  extrasAllowed?: boolean
  allowReverse?: boolean
  allowShot?: boolean
  allowDraw1?: boolean
  allowLifeDouble?: boolean
  /** Targets for shot / draw1 (others only) */
  targetOptions?: readonly BidTargetOption[]
  mobile?: boolean
  /**
   * R4 chat-over mode: declare + coyote only (no stepper / specials).
   * Mobile sheets keep primary actions reachable.
   */
  mini?: boolean
}>()

const emit = defineEmits<{
  declare: [value: number, extra?: ClientBidExtra]
  challenge: []
  same: []
  change: []
}>()

const tickKey = ref(0)
const declareFlash = ref(false)
const challengeFlash = ref(false)
/** Stepper press flash direction for slide feedback */
const stepDir = ref<'up' | 'down' | null>(null)
let stepDirTimer: ReturnType<typeof setTimeout> | null = null
/** Optional declare charge while pointer is held (does not delay click) */
const declareCharging = ref(false)
let chargeTimer: ReturnType<typeof setTimeout> | null = null
/** Flying number from declare button */
const launchFx = ref<{ key: number; value: number } | null>(null)
let launchSeq = 0
let launchTimer: ReturnType<typeof setTimeout> | null = null
const extraChoice = ref<BidExtraChoice>('none')
const targetId = ref<string>('')
/** Mobile progressive disclosure for special abilities */
const skillsExpanded = ref(false)

watch(
  () => props.targetOptions,
  (opts) => {
    if (!opts?.length) {
      targetId.value = ''
      return
    }
    if (!opts.some((o) => o.id === targetId.value)) {
      targetId.value = opts[0]!.id
    }
  },
  { immediate: true },
)

// Clear skill when extras become illegal (e.g. already used / forced rebid)
watch(
  () => props.extrasAllowed,
  (ok) => {
    if (!ok) extraChoice.value = 'none'
  },
)

// Collapse skills panel when nothing is usable
watch(
  () => [props.canSame, props.canChange, props.extrasAllowed] as const,
  ([same, change, extras]) => {
    if (!same && !change && !extras) skillsExpanded.value = false
  },
)

const skillOptions = computed((): SkillOption[] => {
  const list: SkillOption[] = [
    {
      id: 'none',
      emoji: '·',
      label: 'なし',
      hint: '数字だけ宣言',
    },
  ]
  if (props.allowReverse) {
    list.push({
      id: 'reverse',
      emoji: '🔄',
      label: 'リバース',
      hint: '手番の向きを逆にする',
    })
  }
  if (props.allowShot) {
    list.push({
      id: 'shot',
      emoji: '🎯',
      label: 'ショット',
      hint: '次の手番を指名する',
    })
  }
  if (props.allowDraw1) {
    list.push({
      id: 'draw1',
      emoji: '🃏',
      label: 'ドロー',
      hint: '誰かに札を1枚足す（ラウンド1回）',
    })
  }
  if (props.allowLifeDouble) {
    list.push({
      id: 'life_double',
      emoji: '⚡',
      label: 'ダブル',
      hint: '次のコヨーテはライフ −2',
    })
  }
  return list
})

const showSkillBar = computed(
  () =>
    props.extrasAllowed &&
    (props.allowReverse ||
      props.allowShot ||
      props.allowDraw1 ||
      props.allowLifeDouble),
)

/** Any special ability UI may appear this turn */
const hasSpecials = computed(
  () => !!(props.canSame || props.canChange || showSkillBar.value),
)

/** Mobile: specials body visible; desktop always open when hasSpecials */
const specialsOpen = computed(
  () => hasSpecials.value && (!props.mobile || skillsExpanded.value),
)

const needsTarget = computed(
  () => extraChoice.value === 'shot' || extraChoice.value === 'draw1',
)

const selectedSkill = computed(() =>
  skillOptions.value.find((s) => s.id === extraChoice.value),
)

const declareLabel = computed(() => {
  if (props.mini) return `${bid.value} を宣言`
  if (props.mobile) {
    if (extraChoice.value === 'none') return '宣言する'
    return `${bid.value} + ${selectedSkill.value?.label ?? ''}`
  }
  if (extraChoice.value === 'none') return `${bid.value} を宣言`
  return `${bid.value} + ${selectedSkill.value?.label ?? ''} で宣言`
})

const skillsToggleLabel = computed(() => {
  if (extraChoice.value !== 'none') {
    return selectedSkill.value?.label ?? '特殊能力'
  }
  if (props.canSame && !props.canChange && !showSkillBar.value) return 'セイム'
  if (props.canChange && !props.canSame && !showSkillBar.value) return 'チェンジ'
  return '特殊能力'
})

function floor() {
  return props.minBid ?? 0
}

function adjust(delta: number) {
  let next = Math.max(floor(), bid.value + delta)
  if (
    props.forbiddenValue != null &&
    next === props.forbiddenValue &&
    delta !== 0
  ) {
    next = Math.max(floor(), next + (delta > 0 ? 1 : -1))
  }
  if (next === bid.value && delta < 0) {
    // Boundary nudge only — no reward
    tickKey.value += 1
    stepDir.value = 'down'
    if (stepDirTimer) clearTimeout(stepDirTimer)
    stepDirTimer = setTimeout(() => {
      stepDir.value = null
    }, 160)
    playSfx('ui_boundary')
    return
  }
  if (next === bid.value) {
    if (delta !== 0) playSfx('ui_boundary')
    return
  }
  bid.value = next
  tickKey.value += 1
  stepDir.value = delta > 0 ? 'up' : 'down'
  if (stepDirTimer) clearTimeout(stepDirTimer)
  stepDirTimer = setTimeout(() => {
    stepDir.value = null
  }, 180)
  // Slight pitch rise when stepping up (input feedback only — no private info)
  playSfx('ui_tick', { pitch: delta > 0 ? 1.06 : 0.94 })
}

function onDeclarePointerDown() {
  if (props.canDeclare === false) return
  if (chargeTimer) clearTimeout(chargeTimer)
  // Charge is optional polish (150–300ms); release still declares immediately
  chargeTimer = setTimeout(() => {
    declareCharging.value = true
    chargeTimer = null
  }, 160)
}

function onDeclarePointerEnd() {
  if (chargeTimer) {
    clearTimeout(chargeTimer)
    chargeTimer = null
  }
  declareCharging.value = false
}

function selectSkill(id: BidExtraChoice) {
  if (!props.extrasAllowed && id !== 'none') return
  extraChoice.value = id
}

function buildExtra(): ClientBidExtra | undefined {
  if (!props.extrasAllowed || extraChoice.value === 'none') return undefined
  switch (extraChoice.value) {
    case 'reverse':
      return { type: 'reverse' }
    case 'life_double':
      return { type: 'life_double' }
    case 'shot':
      if (!targetId.value) return undefined
      return { type: 'shot', targetId: targetId.value }
    case 'draw1':
      if (!targetId.value) return undefined
      return { type: 'draw1', targetId: targetId.value }
    default:
      return undefined
  }
}

function onDeclare() {
  onDeclarePointerEnd()
  if (props.canDeclare === false) return
  if (
    props.forbiddenValue != null &&
    bid.value === props.forbiddenValue
  ) {
    return
  }
  if (needsTarget.value && !targetId.value) return
  declareFlash.value = true
  window.setTimeout(() => {
    declareFlash.value = false
  }, 360)
  // Launch number toward the board (pairs with CurrentBidDisplay burst)
  if (launchTimer) clearTimeout(launchTimer)
  launchFx.value = { key: ++launchSeq, value: bid.value }
  launchTimer = setTimeout(() => {
    launchFx.value = null
    launchTimer = null
  }, 780)
  emit('declare', bid.value, buildExtra())
  // Reset skill after fire so next turn starts clean if same component stays
  extraChoice.value = 'none'
  if (props.mobile) skillsExpanded.value = false
}

function onChallenge() {
  if (props.canChallenge === false) return
  challengeFlash.value = true
  window.setTimeout(() => {
    challengeFlash.value = false
  }, 360)
  emit('challenge')
}

function onSame() {
  if (!props.canSame) return
  emit('same')
}

function onChange() {
  if (!props.canChange) return
  emit('change')
}

function toggleSkills() {
  skillsExpanded.value = !skillsExpanded.value
}
</script>

<template>
  <!-- Mini dock: declare + coyote only (chat / log open) -->
  <div
    v-if="mini"
    class="border-t border-gold-400/20 bg-night-900/95 px-2 py-1.5 backdrop-blur-md"
  >
    <div class="flex items-center gap-1.5">
      <span
        class="shrink-0 font-display text-lg font-bold tabular-nums text-gold-100"
        aria-hidden="true"
      >
        {{ bid }}
      </span>
      <div class="relative flex min-w-0 flex-1 gap-1.5">
        <span
          v-if="launchFx"
          :key="`launch-mini-${launchFx.key}`"
          class="bid-declare-launch absolute left-1/4 top-0 z-10 -translate-x-1/2 font-display text-3xl font-bold tabular-nums text-gold-100"
          style="
            text-shadow:
              0 0 16px rgba(201, 168, 76, 0.8),
              0 0 32px rgba(201, 168, 76, 0.45);
          "
          aria-hidden="true"
        >
          {{ launchFx.value }}
        </span>
        <button
          type="button"
          class="btn-gold relative min-w-0 flex-1 !py-2 text-sm"
          :class="[
            declareFlash ? 'btn-fx-press' : '',
            declareCharging ? 'btn-declare-charge' : '',
          ]"
          :disabled="canDeclare === false"
          @pointerdown="onDeclarePointerDown"
          @pointerup="onDeclarePointerEnd"
          @pointerleave="onDeclarePointerEnd"
          @pointercancel="onDeclarePointerEnd"
          @click="onDeclare"
        >
          {{ declareLabel }}
        </button>
        <button
          type="button"
          class="btn-coyote min-w-0 flex-1 !py-2 text-sm"
          :class="challengeFlash ? 'btn-fx-press' : ''"
          :disabled="canChallenge === false"
          @click="onChallenge"
        >
          <span aria-hidden="true">🐾</span>
          コヨーテ
        </button>
      </div>
    </div>
  </div>

  <!--
    Full dock: specials may grow tall (all extras + many targets).
    Cap height via parent max-h; scroll specials; keep declare/coyote sticky.
    Primary flow: pick number → declare / coyote (centered action strip).
  -->
  <div
    v-else
    class="bid-dock flex h-full min-h-0 max-h-full flex-col border-t border-gold-400/12 bg-night-900/90"
    :class="mobile ? 'px-2.5 py-2' : 'px-4 py-3 sm:px-6 sm:py-3.5'"
  >
    <!-- Scrollable: hints + special abilities (can be tall when extras ON) -->
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <p
        v-if="!mobile"
        class="mb-2 text-center text-sm text-sand-dim"
      >
        <template v-if="forbiddenValue != null">
          付け直し中：{{ forbiddenValue }} は選べません
        </template>
        <template v-else>数字を選んで宣言するか、コヨーテを仕掛けます</template>
      </p>
      <p v-else class="mb-1.5 text-center text-xs text-sand-dim">
        <template v-if="forbiddenValue != null">
          付け直し（{{ forbiddenValue }} は不可）
        </template>
        <template v-else>数字を選んで宣言</template>
      </p>

      <!-- Mobile: collapse specials behind a chip (R4 progressive disclosure) -->
      <div
        v-if="mobile && hasSpecials"
        class="mb-1.5 flex justify-center"
      >
        <button
          type="button"
          class="skill-chip skill-chip--sm"
          :class="[
            skillsExpanded || extraChoice !== 'none' ? 'skill-chip--on' : '',
            hasSpecials ? 'skill-chip--badge' : '',
          ]"
          :aria-expanded="skillsExpanded"
          :aria-controls="skillsExpanded ? 'bid-specials-panel' : undefined"
          @click="toggleSkills"
        >
          <span aria-hidden="true">✨</span>
          {{ skillsExpanded ? '特殊能力' : skillsToggleLabel }}
          <span class="text-sand-dim" aria-hidden="true">{{
            skillsExpanded ? '▴' : '▾'
          }}</span>
        </button>
      </div>

      <!-- Special abilities panel (solo + bid-ride share 1 slot / round) -->
      <div
        v-if="specialsOpen && (canSame || canChange || showSkillBar)"
        id="bid-specials-panel"
        class="mb-2 space-y-1.5"
      >
        <!-- Mobile: explicit close — toggle chip alone is easy to miss when panel is tall -->
        <div
          v-if="mobile"
          class="flex items-center justify-between gap-2 rounded-lg border border-gold-400/15 bg-night-800/50 px-2 py-1"
        >
          <p class="text-[10px] font-medium text-gold-200/90">
            特殊能力
            <span class="font-normal text-sand-dim">（1Rに1回）</span>
          </p>
          <button
            type="button"
            class="btn-ghost btn-sm !px-2.5 !py-1 text-[11px]"
            aria-label="特殊能力を閉じる"
            @click="skillsExpanded = false"
          >
            閉じる
          </button>
        </div>
        <p
          v-else
          class="text-xs font-medium text-gold-200/90"
        >
          特殊能力
          <span class="font-normal text-sand-dim">（1ラウンドに1回まで）</span>
        </p>

        <div
          v-if="canSame || canChange"
          class="flex flex-wrap gap-1.5"
          :class="mobile ? 'justify-center' : ''"
        >
          <button
            v-if="canSame"
            type="button"
            class="skill-chip skill-chip--solo"
            :class="mobile ? 'skill-chip--sm' : ''"
            @click="onSame"
          >
            <span aria-hidden="true">✋</span>
            セイム
          </button>
          <button
            v-if="canChange"
            type="button"
            class="skill-chip skill-chip--solo skill-chip--change"
            :class="mobile ? 'skill-chip--sm' : ''"
            @click="onChange"
          >
            <span aria-hidden="true">🔀</span>
            チェンジ
          </button>
        </div>

        <!-- Bid-ride skills under same special-ability budget -->
        <template v-if="showSkillBar">
          <div
            class="flex items-baseline justify-between gap-2"
            :class="mobile ? 'justify-center' : ''"
          >
            <p
              class="text-sand-dim"
              :class="mobile ? 'text-[10px]' : 'text-[11px]'"
            >
              宣言と一緒に使う
            </p>
          </div>
          <div
            class="flex flex-wrap gap-1.5"
            :class="mobile ? 'justify-center' : ''"
            role="group"
            aria-label="特殊能力を選ぶ"
          >
            <button
              v-for="opt in skillOptions"
              :key="opt.id"
              type="button"
              class="skill-chip"
              :class="[
                mobile ? 'skill-chip--sm' : '',
                extraChoice === opt.id ? 'skill-chip--on' : '',
                opt.id !== 'none' ? `skill-chip--${opt.id}` : '',
              ]"
              :aria-pressed="extraChoice === opt.id"
              @click="selectSkill(opt.id)"
            >
              <span aria-hidden="true">{{ opt.emoji }}</span>
              {{ opt.label }}
            </button>
          </div>
          <p
            v-if="selectedSkill && extraChoice !== 'none'"
            class="text-sand-dim"
            :class="mobile ? 'text-center text-[10px]' : 'text-[11px]'"
          >
            {{ selectedSkill.hint }}
          </p>
          <div
            v-if="needsTarget"
            class="flex flex-wrap items-center gap-1.5"
            :class="mobile ? 'justify-center' : ''"
          >
            <span
              class="text-sand-dim"
              :class="mobile ? 'text-[10px]' : 'text-[11px]'"
            >
              対象
            </span>
            <button
              v-for="t in targetOptions ?? []"
              :key="t.id"
              type="button"
              class="skill-chip skill-chip--target"
              :class="[
                mobile ? 'skill-chip--sm' : '',
                targetId === t.id ? 'skill-chip--on' : '',
              ]"
              :aria-pressed="targetId === t.id"
              @click="targetId = t.id"
            >
              {{ t.name }}
            </button>
          </div>
        </template>

        <!-- Mobile: second close when list is long (scroll past header) -->
        <div v-if="mobile" class="flex justify-center pt-0.5">
          <button
            type="button"
            class="btn-ghost btn-sm !px-3 !py-1 text-[11px] text-sand-dim"
            @click="skillsExpanded = false"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>

    <!-- Primary actions: number → declare / coyote (always visible) -->
    <div
      class="flex shrink-0 flex-col items-center gap-2 pt-1"
      :class="mobile ? 'gap-1.5' : 'gap-2.5 sm:pt-1.5'"
    >
      <!-- Number tools (secondary) -->
      <div class="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <div
          class="flex items-center gap-0.5 rounded-xl border border-gold-400/20 bg-night-800/90 p-1"
        >
          <button
            type="button"
            class="btn-ghost !rounded-lg !p-0 active:scale-95"
            :class="mobile ? '!h-9 !w-9 text-lg' : '!h-10 !w-10 text-xl'"
            aria-label="1減らす"
            @click="adjust(-1)"
          >
            −
          </button>
          <span
            :key="tickKey"
            class="bid-step-tick text-center font-display font-bold text-gold-100 tabular-nums"
            :class="[
              mobile ? 'min-w-[2.5rem] text-2xl' : 'min-w-[3.25rem] text-3xl',
              stepDir === 'up' ? 'bid-step-tick--up' : '',
              stepDir === 'down' ? 'bid-step-tick--down' : '',
            ]"
          >
            {{ bid }}
          </span>
          <button
            type="button"
            class="btn-ghost !rounded-lg !p-0 active:scale-95"
            :class="mobile ? '!h-9 !w-9 text-lg' : '!h-10 !w-10 text-xl'"
            aria-label="1増やす"
            @click="adjust(1)"
          >
            ＋
          </button>
        </div>

        <button
          type="button"
          class="btn-ghost !rounded-xl font-semibold active:scale-95"
          :class="mobile ? '!px-2.5 !py-2 text-sm' : '!px-3.5 !py-2.5 text-sm'"
          @click="adjust(1)"
        >
          +1
        </button>
        <button
          type="button"
          class="btn-ghost !rounded-xl font-semibold active:scale-95"
          :class="mobile ? '!px-2.5 !py-2 text-sm' : '!px-3.5 !py-2.5 text-sm'"
          @click="adjust(5)"
        >
          +5
        </button>
      </div>

      <!-- Main actions: declare (primary) + coyote (emphasis) -->
      <div
        class="relative flex w-full max-w-xl flex-wrap items-stretch justify-center gap-2 sm:gap-2.5"
      >
        <span
          v-if="launchFx"
          :key="`launch-${launchFx.key}`"
          class="bid-declare-launch absolute left-1/4 top-0 z-10 -translate-x-1/2 font-display text-4xl font-bold tabular-nums text-gold-100 sm:left-[30%] sm:text-5xl"
          style="
            text-shadow:
              0 0 16px rgba(201, 168, 76, 0.8),
              0 0 32px rgba(201, 168, 76, 0.45);
          "
          aria-hidden="true"
        >
          {{ launchFx.value }}
        </span>
        <button
          type="button"
          class="btn-gold relative min-w-0 flex-1 !rounded-xl sm:min-w-[11rem] sm:flex-none sm:px-8"
          :class="[
            declareFlash ? 'btn-fx-press' : '',
            declareCharging ? 'btn-declare-charge' : '',
            mobile ? '!py-2.5 text-sm' : '!py-3 text-base',
            extraChoice !== 'none' ? 'ring-1 ring-teal-soft/40' : '',
          ]"
          :disabled="canDeclare === false"
          @pointerdown="onDeclarePointerDown"
          @pointerup="onDeclarePointerEnd"
          @pointerleave="onDeclarePointerEnd"
          @pointercancel="onDeclarePointerEnd"
          @click="onDeclare"
        >
          {{ declareLabel }}
        </button>
        <button
          type="button"
          class="btn-coyote min-w-0 flex-1 !rounded-xl sm:min-w-[9rem] sm:flex-none sm:px-6"
          :class="[
            challengeFlash ? 'btn-fx-press' : '',
            mobile ? '!py-2.5 text-sm' : '!py-3 text-base',
          ]"
          :disabled="canChallenge === false"
          @click="onChallenge"
        >
          <span aria-hidden="true">🐾</span>
          コヨーテ！
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 9999px;
  border: 1px solid rgba(201, 168, 76, 0.28);
  background: rgba(18, 24, 38, 0.9);
  padding: 0.4rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(232, 220, 190, 0.92);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s ease;
}
.skill-chip:active {
  transform: scale(0.96);
}
.skill-chip--sm {
  padding: 0.3rem 0.55rem;
  font-size: 0.7rem;
}
.skill-chip--on {
  border-color: rgba(94, 200, 200, 0.55);
  background: linear-gradient(
    145deg,
    rgba(30, 70, 70, 0.55),
    rgba(18, 24, 38, 0.95)
  );
  color: #e8f7f5;
  box-shadow: 0 0 0 1px rgba(94, 200, 200, 0.2), 0 0 14px rgba(45, 212, 191, 0.15);
}
.skill-chip--badge {
  box-shadow: 0 0 10px rgba(201, 168, 76, 0.2);
}
.skill-chip--solo {
  border-color: rgba(214, 199, 168, 0.35);
}
.skill-chip--change {
  border-color: rgba(251, 191, 36, 0.4);
}
.skill-chip--target {
  font-weight: 500;
}
.skill-chip--reverse.skill-chip--on {
  border-color: rgba(45, 212, 191, 0.55);
  box-shadow: 0 0 14px rgba(45, 212, 191, 0.18);
}
.skill-chip--shot.skill-chip--on {
  border-color: rgba(240, 215, 140, 0.6);
  box-shadow: 0 0 14px rgba(201, 168, 76, 0.2);
}
.skill-chip--draw1.skill-chip--on {
  border-color: rgba(167, 139, 250, 0.55);
  box-shadow: 0 0 14px rgba(167, 139, 250, 0.18);
}
.skill-chip--life_double.skill-chip--on {
  border-color: rgba(248, 113, 113, 0.55);
  box-shadow: 0 0 14px rgba(248, 113, 113, 0.18);
}

.bid-step-tick--up {
  animation: bid-step-slide-up 0.18s ease-out both;
}
.bid-step-tick--down {
  animation: bid-step-slide-down 0.18s ease-out both;
}
@keyframes bid-step-slide-up {
  from {
    transform: translateY(6px);
    opacity: 0.65;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
@keyframes bid-step-slide-down {
  from {
    transform: translateY(-6px);
    opacity: 0.65;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.btn-declare-charge {
  box-shadow:
    0 0 0 2px rgba(245, 230, 184, 0.55),
    0 0 22px rgba(201, 168, 76, 0.45);
  filter: brightness(1.08);
  transition:
    box-shadow 0.15s ease,
    filter 0.15s ease;
}

@media (prefers-reduced-motion: reduce) {
  .bid-step-tick--up,
  .bid-step-tick--down {
    animation: none !important;
  }
  .btn-declare-charge {
    box-shadow: 0 0 0 1px rgba(245, 230, 184, 0.4);
    filter: none;
  }
}
</style>
