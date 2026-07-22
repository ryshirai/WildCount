<script setup lang="ts">
/**
 * Face-up / face-down card tile (hand display on seats).
 * Indian poker: others show `label`; self uses `mystery` (?).
 * Special faces (×2 / M→0 / ? / 0* / 1/2) get tinted frames.
 *
 * Field UX: hover (fine pointer) or tap toggles a short effect popover.
 * Mystery never reveals face identity — only “非公開”.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  describeCardFace,
  MYSTERY_CARD_DESCRIPTION,
  type CardFaceDescription,
} from '@/data/cardDescriptions'

const props = withDefaults(
  defineProps<{
    /** Face text e.g. "+5", "×2", "M→0". Ignored when mystery. */
    label?: string | null
    /** @deprecated prefer `label` — kept for numeric bid call sites */
    value?: number | null
    mystery?: boolean
    /**
     * Own forehead card-back (not a face). Distinct from seat “self” teal
     * and from special redraw `?` faces.
     */
    selfHand?: boolean
    compact?: boolean
    /** Stronger frame for current turn (not self identity). */
    emphasized?: boolean
    /**
     * Show hover/tap description popover.
     * Off for pure decorative uses if needed.
     */
    describe?: boolean
  }>(),
  {
    label: null,
    value: null,
    mystery: false,
    selfHand: false,
    compact: false,
    emphasized: false,
    describe: true,
  },
)

/** Face string used for layout density (long specials like M→0 / 0*). */
const displayText = computed(() =>
  props.label != null ? props.label : props.value != null ? String(props.value) : '',
)

type FaceVariant =
  | 'mystery'
  | 'number'
  | 'double'
  | 'half'
  | 'max0'
  | 'redraw'
  | 'zeromix'
  | 'negative'

const faceVariant = computed<FaceVariant>(() => {
  if (props.mystery || (props.label == null && props.value == null)) return 'mystery'
  const t = displayText.value
  if (t === '×2' || t === 'x2' || t === 'X2') return 'double'
  if (t === '1/2') return 'half'
  if (t === 'M→0' || t === 'MAX→0') return 'max0'
  if (t === '?' || t === '？') return 'redraw'
  if (t === '0*' || t.startsWith('0*')) return 'zeromix'
  if (t.startsWith('-')) return 'negative'
  return 'number'
})

/** Slightly tighter type only for 3+ char faces (+10, +15, +20, -10). */
const isDense = computed(
  () =>
    displayText.value.length >= 3 &&
    faceVariant.value !== 'double' &&
    faceVariant.value !== 'mystery',
)

const isStackedMax = computed(() => faceVariant.value === 'max0')

const isMystery = computed(() => faceVariant.value === 'mystery')

const description = computed<CardFaceDescription | null>(() => {
  if (!props.describe) return null
  if (isMystery.value) return MYSTERY_CARD_DESCRIPTION
  return describeCardFace(displayText.value)
})

const canDescribe = computed(() => description.value != null)

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const tipRef = ref<HTMLElement | null>(null)
const popStyle = ref<Record<string, string>>({
  top: '0px',
  left: '0px',
  maxWidth: 'min(16rem, calc(100vw - 1.5rem))',
})

/** Sticky open from click/tap (vs hover-only). */
const stickyOpen = ref(false)

function prefersHover(): boolean {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  } catch {
    return false
  }
}

/** Visual viewport (mobile browser chrome) with edge padding. */
function viewportBox() {
  const vv = window.visualViewport
  const originL = vv?.offsetLeft ?? 0
  const originT = vv?.offsetTop ?? 0
  const width = vv?.width ?? window.innerWidth
  const height = vv?.height ?? window.innerHeight
  // Fixed pad keeps tips off screen edges (carousel seats + notches)
  const pad = 12
  return {
    left: originL + pad,
    top: originT + pad,
    right: originL + width - pad,
    bottom: originT + height - pad,
    width: width - pad * 2,
    height: height - pad * 2,
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/**
 * Position tip fully inside the viewport.
 * Mobile carousel seats sit near the top edge — prefer below when space is tight.
 * Horizontal: clamp so long Japanese lines don't clip at left/right.
 */
function placePopover() {
  const anchor = rootRef.value
  const tip = tipRef.value
  if (!anchor || !tip) return

  const r = anchor.getBoundingClientRect()
  const vp = viewportBox()
  const gap = 8

  // Measure after layout; fall back if still 0 (first paint)
  const tipW = tip.offsetWidth || Math.min(256, vp.width)
  const tipH = tip.offsetHeight || 64

  const spaceAbove = r.top - vp.top
  const spaceBelow = vp.bottom - r.bottom
  // Prefer the side with more room; bias slightly below on short screens
  const placeBelow =
    spaceBelow >= tipH + gap || spaceBelow >= spaceAbove || spaceAbove < tipH + gap

  let top = placeBelow ? r.bottom + gap : r.top - gap - tipH
  top = clamp(top, vp.top, Math.max(vp.top, vp.bottom - tipH))

  // Center on card, then clamp horizontally into viewport
  let left = r.left + r.width / 2 - tipW / 2
  left = clamp(left, vp.left, Math.max(vp.left, vp.right - tipW))

  popStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    maxWidth: `${Math.floor(vp.width)}px`,
    transform: 'none',
  }
}

async function showPopover(sticky: boolean) {
  if (!canDescribe.value) return
  stickyOpen.value = sticky
  open.value = true
  await nextTick()
  // Two frames: first paint sizes the tip, then clamp to viewport
  placePopover()
  requestAnimationFrame(() => {
    placePopover()
  })
}

function hidePopover() {
  open.value = false
  stickyOpen.value = false
}

function onPointerEnter() {
  if (!canDescribe.value) return
  if (!prefersHover()) return
  void showPopover(false)
}

function onPointerLeave() {
  if (!canDescribe.value) return
  if (!prefersHover()) return
  if (stickyOpen.value) return
  hidePopover()
}

function onActivate(e: Event) {
  if (!canDescribe.value) return
  e.stopPropagation()
  e.preventDefault()
  if (open.value && stickyOpen.value) {
    hidePopover()
    return
  }
  void showPopover(true)
}

function onDocPointerDown(e: Event) {
  if (!open.value) return
  const t = e.target
  if (!(t instanceof Node)) return
  if (rootRef.value?.contains(t)) return
  hidePopover()
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    hidePopover()
  }
}

function onScrollOrResize() {
  if (!open.value) return
  placePopover()
}

watch(
  () => [props.label, props.value, props.mystery, props.describe] as const,
  () => {
    if (open.value) hidePopover()
  },
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})

const ariaLabel = computed(() => {
  if (isMystery.value) {
    return props.selfHand ? '自分の札（非公開）' : '非公開'
  }
  const d = description.value
  if (d) return `${d.name}。${d.effect}`
  return displayText.value
})
</script>

<template>
  <div
    ref="rootRef"
    class="card-tile-wrap"
    :class="canDescribe ? 'card-tile-wrap--interactive' : ''"
  >
    <div
      class="card-tile"
      :class="[
        compact ? 'card-tile--compact' : '',
        isDense ? 'card-tile--dense' : '',
        emphasized ? 'card-tile--emphasized' : '',
        faceVariant === 'mystery' && selfHand ? 'card-tile--self-back' : '',
        faceVariant === 'mystery' && !selfHand ? 'card-tile--mystery' : '',
        faceVariant === 'double' ? 'card-tile--double' : '',
        faceVariant === 'half' ? 'card-tile--half' : '',
        faceVariant === 'max0' ? 'card-tile--max0' : '',
        faceVariant === 'redraw' ? 'card-tile--redraw' : '',
        faceVariant === 'zeromix' ? 'card-tile--zeromix' : '',
        faceVariant === 'negative' ? 'card-tile--negative' : '',
        faceVariant === 'number' ? 'card-tile--number' : '',
        open ? 'card-tile--tip-open' : '',
      ]"
      :role="canDescribe ? 'button' : 'img'"
      :tabindex="canDescribe ? 0 : undefined"
      :aria-label="ariaLabel"
      :aria-expanded="canDescribe ? open : undefined"
      :aria-haspopup="canDescribe ? 'dialog' : undefined"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      @click="onActivate"
      @keydown.enter="onActivate"
      @keydown.space="onActivate"
    >
      <!-- Decorative corner ticks -->
      <span class="card-tile__pip card-tile__pip--tl" aria-hidden="true" />
      <span class="card-tile__pip card-tile__pip--br" aria-hidden="true" />

      <!-- Soft sheen -->
      <span class="card-tile__sheen" aria-hidden="true" />

      <!-- Card-back pattern (own forehead only) -->
      <span
        v-if="faceVariant === 'mystery' && selfHand"
        class="card-tile__back-pattern"
        aria-hidden="true"
      />

      <template v-if="faceVariant === 'mystery'">
        <span class="card-tile__hero font-display">?</span>
        <span
          v-if="selfHand"
          class="card-tile__badge card-tile__badge--hidden"
          aria-hidden="true"
        >非公開</span>
      </template>

      <template v-else-if="faceVariant === 'double'">
        <span class="card-tile__hero font-display">×2</span>
        <span class="card-tile__badge" aria-hidden="true">DBL</span>
      </template>

      <template v-else-if="isStackedMax">
        <span class="card-tile__stack font-display">
          <span class="card-tile__stack-top">MAX</span>
          <span class="card-tile__stack-bot">→0</span>
        </span>
      </template>

      <!-- 0 捨て札→山札IN（通常 0 と区別: 暗い特殊枠 + 山IN） -->
      <template v-else-if="faceVariant === 'zeromix'">
        <svg class="card-tile__glyph" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path
            d="M12 16c1.8-3.2 5.2-5.2 9-5.2 4.6 0 8.5 3 9.8 7.2"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            opacity="0.55"
          />
          <path d="M28.5 14.2 L32.2 18.5 L26.5 19.2 Z" fill="currentColor" opacity="0.55" />
          <path
            d="M28 24c-1.8 3.2-5.2 5.2-9 5.2-4.6 0-8.5-3-9.8-7.2"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            opacity="0.55"
          />
          <path d="M11.5 25.8 L7.8 21.5 L13.5 20.8 Z" fill="currentColor" opacity="0.55" />
        </svg>
        <span class="card-tile__hero font-display tabular-nums">0</span>
        <span class="card-tile__badge card-tile__badge--mix" aria-hidden="true">山IN</span>
      </template>

      <template v-else>
        <span class="card-tile__hero font-display tabular-nums">
          {{ displayText }}
        </span>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="open && description"
        ref="tipRef"
        class="card-face-tip"
        :class="isMystery ? 'card-face-tip--mystery' : ''"
        role="tooltip"
        :style="popStyle"
      >
        <div class="card-face-tip__name">{{ description.name }}</div>
        <div class="card-face-tip__effect">{{ description.effect }}</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.card-tile-wrap {
  display: inline-flex;
  vertical-align: bottom;
  position: relative;
}

.card-tile-wrap--interactive .card-tile {
  cursor: help;
}

.card-tile-wrap--interactive .card-tile:focus-visible {
  outline: 2px solid rgba(201, 168, 76, 0.75);
  outline-offset: 2px;
}

.card-tile--tip-open {
  filter: brightness(1.06);
}
</style>

<style>
/* Teleported — not scoped; position set in JS (viewport-clamped) */
.card-face-tip {
  position: fixed;
  z-index: 90;
  box-sizing: border-box;
  width: max-content;
  max-width: min(16rem, calc(100vw - 1.25rem));
  padding: 0.5rem 0.65rem;
  border-radius: 0.65rem;
  border: 1px solid rgba(201, 168, 76, 0.35);
  background: rgba(15, 23, 42, 0.96);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(201, 168, 76, 0.08);
  color: #e8e0d0;
  pointer-events: none;
  text-align: left;
  line-height: 1.35;
  /* backdrop-filter disabled on coarse pointers via main.css (iOS black-screen) */
  /* Avoid transform-based centering (clips at screen edges on mobile) */
  transform: none;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.card-face-tip--mystery {
  border-color: rgba(42, 138, 138, 0.4);
}

.card-face-tip__name {
  font-family: var(--font-display, ui-sans-serif, system-ui, sans-serif);
  font-size: 0.8rem;
  font-weight: 700;
  color: #f0d78c;
  letter-spacing: 0.01em;
}

.card-face-tip--mystery .card-face-tip__name {
  color: #7dd3c7;
}

.card-face-tip__effect {
  margin-top: 0.2rem;
  font-size: 0.72rem;
  color: rgba(232, 224, 208, 0.88);
  font-weight: 500;
  white-space: normal;
}
</style>
