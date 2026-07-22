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
/** Mobile: specials bottom sheet (StampPicker-style) */
const specialsSheetOpen = ref(false)

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
    if (!ok) {
      extraChoice.value = 'none'
      specialsSheetOpen.value = false
    }
  },
)

watch(
  () => props.mobile,
  (isMobile) => {
    if (!isMobile) specialsSheetOpen.value = false
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

/** 「なし」とそれ以外を分けて改行表示する */
const noneSkill = computed(
  () => skillOptions.value.find((s) => s.id === 'none') ?? null,
)
const rideSkills = computed(() =>
  skillOptions.value.filter((s) => s.id !== 'none'),
)

/** Any special ability UI may appear this turn */
const hasSpecials = computed(
  () => !!(props.canSame || props.canChange || showSkillBar.value),
)

const needsTarget = computed(
  () => extraChoice.value === 'shot' || extraChoice.value === 'draw1',
)

const selectedSkill = computed(() =>
  skillOptions.value.find((s) => s.id === extraChoice.value),
)

const selectedTargetName = computed(() => {
  if (!needsTarget.value || !targetId.value) return null
  return props.targetOptions?.find((t) => t.id === targetId.value)?.name ?? null
})

/** Dock trigger summary when a ride skill is armed */
const specialsSummary = computed(() => {
  if (extraChoice.value === 'none' || !selectedSkill.value) return null
  const base = `${selectedSkill.value.emoji} ${selectedSkill.value.label}`
  if (needsTarget.value && selectedTargetName.value) {
    return `${base} → ${selectedTargetName.value}`
  }
  if (needsTarget.value) return `${base}（対象を選択）`
  return base
})

const declareLabel = computed(() => {
  if (props.mini) return `${bid.value} を宣言`
  if (props.mobile) {
    if (extraChoice.value === 'none') return '宣言する'
    return `${bid.value} + ${selectedSkill.value?.label ?? ''}`
  }
  if (extraChoice.value === 'none') return `${bid.value} を宣言`
  return `${bid.value} + ${selectedSkill.value?.label ?? ''} で宣言`
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

function openSpecialsSheet() {
  if (!hasSpecials.value) return
  specialsSheetOpen.value = true
  playSfx('ui_tick', { pitch: 1.02 })
}

function closeSpecialsSheet() {
  specialsSheetOpen.value = false
}

function selectSkill(id: BidExtraChoice) {
  if (!props.extrasAllowed && id !== 'none') return
  // Tap selected again to clear
  if (extraChoice.value === id && id !== 'none') {
    extraChoice.value = 'none'
    return
  }
  extraChoice.value = id
}

/** Mobile sheet: pick ride skill; stay open only when target is required */
function selectSkillFromSheet(id: BidExtraChoice) {
  selectSkill(id)
  // Stay open while shot/draw1 is armed (need a target). Cleared → close.
  if (extraChoice.value === 'shot' || extraChoice.value === 'draw1') return
  closeSpecialsSheet()
}

function selectTargetFromSheet(id: string) {
  targetId.value = id
  closeSpecialsSheet()
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
  if (needsTarget.value && !targetId.value) {
    // Need a target — open sheet so the player can finish choosing
    if (props.mobile) openSpecialsSheet()
    return
  }
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
  specialsSheetOpen.value = false
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
  specialsSheetOpen.value = false
}

function onChange() {
  if (!props.canChange) return
  emit('change')
  specialsSheetOpen.value = false
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
    Full dock:
    - Mobile: specials via bottom sheet (trigger only in dock)
    - Desktop: inline skill chips + target row
  -->
  <div
    v-else
    class="bid-dock flex shrink-0 flex-col border-t border-gold-400/12 bg-night-900/94"
    :class="mobile ? 'px-2 py-1.5 pb-2' : 'px-4 py-2.5 pb-4 sm:px-6 sm:pb-5'"
  >
    <p
      v-if="forbiddenValue != null"
      class="mb-1.5 text-center text-xs font-medium text-amber-200/90"
    >
      付け直し：{{ forbiddenValue }} は選べません
    </p>

    <!-- Desktop only: inline specials (larger chips) -->
    <div
      v-if="hasSpecials && !mobile"
      id="bid-specials-panel"
      class="mb-2 flex flex-col items-center gap-1.5"
      role="group"
      aria-label="特殊能力（1ラウンドに1回）"
    >
      <div
        v-if="canSame || canChange || (showSkillBar && noneSkill)"
        class="flex flex-wrap items-center justify-center gap-1.5"
      >
        <span
          class="mr-0.5 text-xs font-medium text-sand-dim/70"
          aria-hidden="true"
        >特殊</span>
        <button
          v-if="canSame"
          type="button"
          class="skill-chip skill-chip--solo skill-chip--lg"
          title="直前の宣言と同じ数字で宣言する"
          @click="onSame"
        >
          <span aria-hidden="true">✋</span>
          セイム
        </button>
        <button
          v-if="canChange"
          type="button"
          class="skill-chip skill-chip--solo skill-chip--change skill-chip--lg"
          title="手札を引き直す"
          @click="onChange"
        >
          <span aria-hidden="true">🔀</span>
          チェンジ
        </button>
        <button
          v-if="showSkillBar && noneSkill"
          type="button"
          class="skill-chip skill-chip--lg"
          :class="extraChoice === 'none' ? 'skill-chip--on' : ''"
          :title="noneSkill.hint"
          :aria-pressed="extraChoice === 'none'"
          @click="selectSkill('none')"
        >
          <span aria-hidden="true">{{ noneSkill.emoji }}</span>
          {{ noneSkill.label }}
        </button>
      </div>

      <div
        v-if="showSkillBar && rideSkills.length"
        class="flex flex-wrap items-center justify-center gap-1.5"
        role="group"
        aria-label="宣言と一緒に使う能力"
      >
        <button
          v-for="opt in rideSkills"
          :key="opt.id"
          type="button"
          class="skill-chip skill-chip--lg"
          :class="[
            extraChoice === opt.id ? 'skill-chip--on' : '',
            `skill-chip--${opt.id}`,
          ]"
          :title="opt.hint"
          :aria-pressed="extraChoice === opt.id"
          @click="selectSkill(opt.id)"
        >
          <span aria-hidden="true">{{ opt.emoji }}</span>
          {{ opt.label }}
        </button>
      </div>

      <div
        v-if="needsTarget"
        class="flex max-w-full items-center gap-1.5 overflow-x-auto overscroll-x-contain px-0.5 scrollbar-none"
        role="group"
        aria-label="対象プレイヤー"
      >
        <span class="shrink-0 text-xs text-sand-dim/80">対象</span>
        <button
          v-for="t in targetOptions ?? []"
          :key="t.id"
          type="button"
          class="skill-chip skill-chip--target skill-chip--lg shrink-0"
          :class="targetId === t.id ? 'skill-chip--on' : ''"
          :aria-pressed="targetId === t.id"
          @click="targetId = t.id"
        >
          {{ t.name }}
        </button>
      </div>
    </div>

    <!-- Primary: number cluster + declare / coyote -->
    <div
      class="flex shrink-0 flex-col items-center"
      :class="mobile ? 'gap-2' : 'gap-2.5'"
    >
      <div
        class="bid-number-control flex flex-wrap items-center justify-center"
        :class="mobile ? 'gap-1.5' : 'gap-2'"
        role="group"
        aria-label="宣言する数字"
      >
        <button
          type="button"
          class="btn-ghost !rounded-xl !p-0 font-semibold text-sand-dim active:scale-95"
          :class="mobile ? '!h-11 !w-11 text-xl' : '!h-12 !w-12 text-2xl'"
          aria-label="1減らす"
          @click="adjust(-1)"
        >
          −
        </button>

        <div
          class="bid-value-readout flex items-center justify-center rounded-xl border border-gold-400/40 bg-night-950/85"
          :class="
            mobile
              ? 'min-h-[3rem] min-w-[4.25rem] px-3.5'
              : 'min-h-[3.5rem] min-w-[5.5rem] px-5'
          "
        >
          <span
            :key="tickKey"
            class="bid-step-tick font-display font-bold leading-none tabular-nums text-gold-50"
            :class="[
              mobile ? 'text-4xl' : 'text-5xl',
              stepDir === 'up' ? 'bid-step-tick--up' : '',
              stepDir === 'down' ? 'bid-step-tick--down' : '',
            ]"
            :aria-label="`選択中の数字 ${bid}`"
          >
            {{ bid }}
          </span>
        </div>

        <button
          type="button"
          class="btn-ghost !rounded-xl !p-0 font-semibold text-sand-dim active:scale-95"
          :class="mobile ? '!h-11 !w-11 text-xl' : '!h-12 !w-12 text-2xl'"
          aria-label="1増やす"
          @click="adjust(1)"
        >
          ＋
        </button>

        <button
          type="button"
          class="btn-ghost !rounded-xl font-semibold text-sand active:scale-95"
          :class="
            mobile
              ? '!min-h-11 !px-3 !py-2 text-sm'
              : '!min-h-12 !px-4 !py-2.5 text-base'
          "
          @click="adjust(1)"
        >
          +1
        </button>
        <button
          type="button"
          class="btn-ghost !rounded-xl font-semibold text-sand active:scale-95"
          :class="
            mobile
              ? '!min-h-11 !px-3 !py-2 text-sm'
              : '!min-h-12 !px-4 !py-2.5 text-base'
          "
          @click="adjust(5)"
        >
          +5
        </button>
      </div>

      <!-- Mobile: open specials bottom sheet -->
      <button
        v-if="mobile && hasSpecials"
        type="button"
        class="specials-trigger flex w-full max-w-xl items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99]"
        :class="
          specialsSummary
            ? 'border-teal-soft/45 bg-teal-deep/30 text-teal-soft'
            : 'border-gold-400/25 bg-night-950/70 text-sand'
        "
        :aria-expanded="specialsSheetOpen"
        aria-controls="specials-sheet"
        aria-haspopup="dialog"
        @click="openSpecialsSheet"
      >
        <span class="min-w-0 flex items-center gap-2">
          <span class="text-base leading-none" aria-hidden="true">✨</span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold leading-tight">
              {{ specialsSummary ?? '特殊能力' }}
            </span>
            <span
              class="mt-0.5 block text-[11px] font-normal leading-tight opacity-75"
            >
              {{
                specialsSummary
                  ? 'タップで変更・解除'
                  : 'セイム・チェンジ・リバースなど（1ラウンド1回）'
              }}
            </span>
          </span>
        </span>
        <span
          class="shrink-0 text-xs font-medium opacity-70"
          aria-hidden="true"
        >選ぶ</span>
      </button>

      <div
        class="relative flex w-full flex-wrap items-stretch justify-center"
        :class="mobile ? 'max-w-xl gap-2' : 'max-w-2xl gap-3'"
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
          class="btn-gold relative min-w-0 flex-[1.35] !rounded-xl shadow-gold"
          :class="[
            declareFlash ? 'btn-fx-press' : '',
            declareCharging ? 'btn-declare-charge' : '',
            mobile
              ? '!min-h-12 !py-3 text-base font-bold'
              : '!min-h-[3.25rem] !px-10 !py-3.5 text-lg font-bold sm:min-w-[13rem] sm:flex-none',
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
          class="btn-coyote min-w-0 flex-1 !rounded-xl"
          :class="[
            challengeFlash ? 'btn-fx-press' : '',
            mobile
              ? '!min-h-12 !py-3 text-base font-semibold'
              : '!min-h-[3.25rem] !px-8 !py-3.5 text-lg font-semibold sm:min-w-[11rem] sm:flex-none',
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

  <!-- Mobile specials bottom sheet (Teleport — same pattern as StampPickerSheet) -->
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
        v-if="mobile && specialsSheetOpen"
        id="specials-sheet"
        class="fixed inset-0 z-[70] flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="特殊能力を選ぶ"
      >
        <button
          type="button"
          class="absolute inset-0 bg-night-950/60"
          aria-label="閉じる"
          @click="closeSpecialsSheet"
        />
        <div
          class="relative z-10 mx-auto flex max-h-[min(78dvh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gold-400/25 border-b-0 bg-night-900/98 shadow-panel safe-bottom"
          @click.stop
        >
          <div class="mb-1 flex shrink-0 justify-center pt-2" aria-hidden="true">
            <div class="h-1 w-10 rounded-full bg-gold-400/30" />
          </div>
          <div class="mb-2 flex shrink-0 items-center justify-between px-4">
            <div>
              <p class="text-sm font-semibold text-gold-200">特殊能力</p>
              <p class="text-[11px] text-sand-dim">1ラウンドに1回まで</p>
            </div>
            <button
              type="button"
              class="btn-ghost !px-2.5 !py-1.5 text-xs"
              @click="closeSpecialsSheet"
            >
              閉じる
            </button>
          </div>

          <div
            class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-3"
          >
            <!-- Immediate: セイム / チェンジ -->
            <section v-if="canSame || canChange" aria-label="すぐ使う">
              <p class="mb-1.5 px-1 text-[11px] font-medium text-sand-dim">
                すぐ使う
              </p>
              <div class="grid gap-2" :class="canSame && canChange ? 'grid-cols-2' : 'grid-cols-1'">
                <button
                  v-if="canSame"
                  type="button"
                  class="sheet-skill-btn sheet-skill-btn--solo"
                  title="直前の宣言と同じ数字で宣言する"
                  @click="onSame"
                >
                  <span class="text-xl leading-none" aria-hidden="true">✋</span>
                  <span class="min-w-0">
                    <span class="block text-sm font-bold">セイム</span>
                    <span class="mt-0.5 block text-[11px] font-normal opacity-75"
                    >同じ数字で宣言</span
                    >
                  </span>
                </button>
                <button
                  v-if="canChange"
                  type="button"
                  class="sheet-skill-btn sheet-skill-btn--change"
                  title="手札を引き直す"
                  @click="onChange"
                >
                  <span class="text-xl leading-none" aria-hidden="true">🔀</span>
                  <span class="min-w-0">
                    <span class="block text-sm font-bold">チェンジ</span>
                    <span class="mt-0.5 block text-[11px] font-normal opacity-75"
                    >手札を引き直す</span
                    >
                  </span>
                </button>
              </div>
            </section>

            <!-- Ride skills with declare -->
            <section v-if="showSkillBar" aria-label="宣言と一緒に使う">
              <p class="mb-1.5 px-1 text-[11px] font-medium text-sand-dim">
                宣言と一緒に使う
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="opt in skillOptions"
                  :key="opt.id"
                  type="button"
                  class="sheet-skill-btn"
                  :class="[
                    extraChoice === opt.id ? 'sheet-skill-btn--on' : '',
                    `sheet-skill-btn--${opt.id}`,
                  ]"
                  :title="opt.hint"
                  :aria-pressed="extraChoice === opt.id"
                  @click="selectSkillFromSheet(opt.id)"
                >
                  <span class="text-xl leading-none" aria-hidden="true">{{
                    opt.emoji
                  }}</span>
                  <span class="min-w-0">
                    <span class="block text-sm font-bold">{{ opt.label }}</span>
                    <span class="mt-0.5 block text-[11px] font-normal opacity-75">{{
                      opt.hint
                    }}</span>
                  </span>
                </button>
              </div>
            </section>

            <!-- Target picker -->
            <section v-if="needsTarget" aria-label="対象プレイヤー">
              <p class="mb-1.5 px-1 text-[11px] font-medium text-sand-dim">
                対象を選ぶ
              </p>
              <div class="flex flex-col gap-2">
                <button
                  v-for="t in targetOptions ?? []"
                  :key="t.id"
                  type="button"
                  class="sheet-skill-btn sheet-skill-btn--target w-full"
                  :class="targetId === t.id ? 'sheet-skill-btn--on' : ''"
                  :aria-pressed="targetId === t.id"
                  @click="selectTargetFromSheet(t.id)"
                >
                  <span class="text-sm font-bold">{{ t.name }}</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 9999px;
  border: 1px solid rgba(201, 168, 76, 0.28);
  background: rgba(18, 24, 38, 0.9);
  padding: 0.3rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.1;
  color: rgba(232, 220, 190, 0.92);
  white-space: nowrap;
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
  padding: 0.28rem 0.5rem;
  font-size: 0.68rem;
}
/* Desktop bid dock: roomy chips */
.skill-chip--lg {
  min-height: 2.5rem;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
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

/* Mobile specials bottom sheet — large touch rows */
.sheet-skill-btn {
  display: flex;
  min-height: 3.25rem;
  align-items: center;
  gap: 0.65rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(201, 168, 76, 0.28);
  background: rgba(12, 18, 30, 0.92);
  padding: 0.7rem 0.85rem;
  text-align: left;
  color: rgba(232, 220, 190, 0.95);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s ease;
}
.sheet-skill-btn:active {
  transform: scale(0.98);
}
.sheet-skill-btn--on {
  border-color: rgba(94, 200, 200, 0.55);
  background: linear-gradient(
    145deg,
    rgba(30, 70, 70, 0.55),
    rgba(18, 24, 38, 0.95)
  );
  color: #e8f7f5;
  box-shadow:
    0 0 0 1px rgba(94, 200, 200, 0.2),
    0 0 14px rgba(45, 212, 191, 0.15);
}
.sheet-skill-btn--solo {
  border-color: rgba(214, 199, 168, 0.4);
}
.sheet-skill-btn--change {
  border-color: rgba(251, 191, 36, 0.45);
}
.sheet-skill-btn--target {
  justify-content: center;
  min-height: 2.75rem;
}
.sheet-skill-btn--reverse.sheet-skill-btn--on {
  border-color: rgba(45, 212, 191, 0.55);
}
.sheet-skill-btn--shot.sheet-skill-btn--on {
  border-color: rgba(240, 215, 140, 0.6);
}
.sheet-skill-btn--draw1.sheet-skill-btn--on {
  border-color: rgba(167, 139, 250, 0.55);
}
.sheet-skill-btn--life_double.sheet-skill-btn--on {
  border-color: rgba(248, 113, 113, 0.55);
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

/* Number control cluster: steppers + hero value as one unit */
.bid-number-control {
  padding: 0.2rem 0.15rem;
}

.bid-value-readout {
  box-shadow:
    inset 0 0 0 1px rgba(232, 213, 163, 0.14),
    0 0 22px rgba(201, 168, 76, 0.16);
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
