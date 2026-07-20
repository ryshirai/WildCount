<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
      hint: '進行方向を逆転',
    })
  }
  if (props.allowShot) {
    list.push({
      id: 'shot',
      emoji: '🎯',
      label: 'ショット',
      hint: '次の手番を指名',
    })
  }
  if (props.allowDraw1) {
    list.push({
      id: 'draw1',
      emoji: '🃏',
      label: 'ドロー',
      hint: '誰かに札+1（R1回）',
    })
  }
  if (props.allowLifeDouble) {
    list.push({
      id: 'life_double',
      emoji: '⚡',
      label: 'ダブル',
      hint: '次チャレンジは −2',
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
  if (props.mini) return `${bid.value} 宣言`
  if (props.mobile) {
    if (extraChoice.value === 'none') return '宣言する'
    return `${bid.value} + ${selectedSkill.value?.label ?? ''}`
  }
  if (extraChoice.value === 'none') return `${bid.value}を宣言`
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
  if (next === bid.value && delta < 0) return
  bid.value = next
  tickKey.value += 1
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
          :class="declareFlash ? 'btn-fx-press' : ''"
          :disabled="canDeclare === false"
          @click="onDeclare"
        >
          {{ declareLabel }}
        </button>
        <button
          type="button"
          class="btn-teal min-w-0 flex-1 !py-2 text-sm"
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

  <div
    v-else
    class="border-t border-gold-400/15 bg-night-900/85 backdrop-blur-md"
    :class="mobile ? 'px-2.5 py-1.5' : 'px-4 py-2.5 sm:py-3'"
  >
    <p v-if="!mobile" class="mb-1.5 text-xs text-sand-dim sm:mb-2">
      <template v-if="forbiddenValue != null">
        付け直し: {{ forbiddenValue }} は使えません
      </template>
      <template v-else>宣言する数字を選んでください</template>
    </p>
    <p v-else class="mb-1 text-center text-[10px] text-sand-dim">
      <template v-if="forbiddenValue != null">
        付け直し（{{ forbiddenValue }} 不可）
      </template>
      <template v-else>宣言する数字</template>
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
        @click="toggleSkills"
      >
        <span aria-hidden="true">✨</span>
        {{ skillsToggleLabel }}
        <span class="text-sand-dim" aria-hidden="true">{{
          skillsExpanded ? '▴' : '▾'
        }}</span>
      </button>
    </div>

    <!-- Special abilities (solo + bid-ride share 1 slot / round) -->
    <div
      v-if="specialsOpen && (canSame || canChange || showSkillBar)"
      class="mb-2 space-y-1.5"
    >
      <p
        v-if="!mobile"
        class="text-xs font-medium text-gold-200/90"
      >
        特殊能力
        <span class="font-normal text-sand-dim">（このラウンドで1回まで）</span>
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
    </div>

    <!-- Bid-ride skills under same special-ability budget -->
    <div v-if="specialsOpen && showSkillBar" class="mb-2 space-y-1.5">
      <div
        class="flex items-baseline justify-between gap-2"
        :class="mobile ? 'justify-center' : ''"
      >
        <p
          class="text-sand-dim"
          :class="mobile ? 'text-[10px]' : 'text-[11px]'"
        >
          宣言に乗せる
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
    </div>

    <div
      class="flex flex-wrap items-center gap-1.5"
      :class="mobile ? 'justify-center' : 'justify-start'"
    >
      <!-- Stepper -->
      <div
        class="flex items-center gap-0.5 rounded-lg border border-gold-400/25 bg-night-800/80 p-0.5"
      >
        <button
          type="button"
          class="btn-ghost !p-0 active:scale-95"
          :class="mobile ? '!h-8 !w-8 text-base' : '!h-9 !w-9 text-lg'"
          aria-label="1減らす"
          @click="adjust(-1)"
        >
          −
        </button>
        <span
          :key="tickKey"
          class="bid-step-tick text-center font-display font-bold text-gold-100 tabular-nums"
          :class="mobile ? 'min-w-[2.25rem] text-xl' : 'min-w-[2.75rem] text-2xl'"
        >
          {{ bid }}
        </span>
        <button
          type="button"
          class="btn-ghost !p-0 active:scale-95"
          :class="mobile ? '!h-8 !w-8 text-base' : '!h-9 !w-9 text-lg'"
          aria-label="1増やす"
          @click="adjust(1)"
        >
          ＋
        </button>
      </div>

      <button
        type="button"
        class="btn-ghost font-semibold active:scale-95"
        :class="mobile ? '!px-2 !py-1.5 text-xs' : '!px-2.5 !py-2 text-sm'"
        @click="adjust(1)"
      >
        +1
      </button>
      <button
        type="button"
        class="btn-ghost font-semibold active:scale-95"
        :class="mobile ? '!px-2 !py-1.5 text-xs' : '!px-2.5 !py-2 text-sm'"
        @click="adjust(5)"
      >
        +5
      </button>

      <div
        class="relative flex flex-1 flex-wrap gap-1.5"
        :class="mobile ? 'w-full basis-full' : 'min-w-[14rem] justify-end'"
      >
        <!-- Declare number launch (from button toward board) -->
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
          class="btn-gold relative flex-1 sm:flex-none"
          :class="[
            declareFlash ? 'btn-fx-press' : '',
            mobile ? '!py-2 text-sm' : '',
            extraChoice !== 'none' ? 'ring-1 ring-teal-soft/40' : '',
          ]"
          :disabled="canDeclare === false"
          @click="onDeclare"
        >
          {{ declareLabel }}
        </button>
        <button
          type="button"
          class="btn-teal flex-1 sm:flex-none"
          :class="[
            challengeFlash ? 'btn-fx-press' : '',
            mobile ? '!py-2 text-sm' : '',
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
</style>
