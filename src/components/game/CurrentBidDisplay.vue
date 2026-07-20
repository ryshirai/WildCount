<script setup lang="ts">
/**
 * Center bid display with dopamine micro-fx (D1):
 * number slam + floating delta + declare burst + HEAT / RALLY / RAISE labels.
 *
 * Layout stays fixed: font sizes / footer height never swap on burst.
 * Scale / opacity FX only (absolute overlays).
 */
import { computed, ref, watch } from 'vue'
import { pitchForBidLand, playSfx } from '@/audio'
import { playHaptic } from '@/haptics'
import FxSparkleBurst from '@/components/common/FxSparkleBurst.vue'
import type { RaiseIntensity } from '@/utils/resultDrama'
import {
  classifyRaise,
  heatStageLabel,
  raiseIntensityFromTier,
  raiseTierLabel,
  shouldShowRally,
  type HeatLevel,
  type RaiseClassification,
  type RaiseTier,
} from '@/utils/bidDrama'

const props = withDefaults(
  defineProps<{
    currentBid: number | null
    turnsUntilSelf?: number
    compact?: boolean
    showTurnsHint?: boolean
    /** Confirmed bids this round (HEAT / RALLY). */
    bidCount?: number
    heat?: HeatLevel
  }>(),
  {
    showTurnsHint: true,
    bidCount: 0,
    heat: 'none',
  },
)

const popKey = ref(0)
const popClass = ref('')
const floatDeltas = ref<{ id: number; text: string; sign: 'up' | 'down' }[]>([])
/** Full declare impact when bid is set / raised */
const declareBurst = ref<{
  key: number
  value: number
  delta: number | null
  intensity: RaiseIntensity
  tier: RaiseTier
  doubleRaise: boolean
  raiseLabel: string | null
} | null>(null)
/** Short RALLY flash on each consecutive bid ≥ 2 */
const rallyFlash = ref<{ key: number; n: number } | null>(null)
let deltaSeq = 0
let burstSeq = 0
let rallySeq = 0
let burstTimer: ReturnType<typeof setTimeout> | null = null
let rallyTimer: ReturnType<typeof setTimeout> | null = null
let prevBid: number | null | undefined = undefined

const heat = computed((): HeatLevel => props.heat ?? 'none')
const heatLabel = computed(() => heatStageLabel(heat.value))
const showRallyBadge = computed(
  () => shouldShowRally(props.bidCount ?? 0) && (props.bidCount ?? 0) >= 2,
)

watch(
  () => props.currentBid,
  (next) => {
    // Skip first paint / null→null
    if (prevBid === undefined) {
      prevBid = next
      return
    }
    if (next === prevBid) return

    const from = prevBid
    prevBid = next

    // Pop animation restart
    popKey.value += 1
    if (from == null && next != null) {
      popClass.value = 'bid-num--slam'
      fireDeclareBurst(next, classifyRaise(null, next))
    } else if (next == null) {
      popClass.value = 'bid-num--fade'
    } else if (from != null && next > from) {
      const raise = classifyRaise(from, next)
      const intensity = raiseIntensityFromTier(raise)
      popClass.value =
        raise.tier === 'wild' || raise.tier === 'big'
          ? 'bid-num--up bid-num--hard'
          : raise.tier === 'nice'
            ? 'bid-num--up bid-num--hard'
            : intensity === 'soft'
              ? 'bid-num--up bid-num--soft'
              : 'bid-num--up'
      spawnDelta(`+${next - from}`, 'up')
      fireDeclareBurst(next, raise)
      maybeFlashRally()
    } else if (from != null && next < from) {
      popClass.value = 'bid-num--down'
      spawnDelta(`${next - from}`, 'down')
    } else {
      popClass.value = 'bid-num--slam'
    }
  },
)

// Sync rally when bidCount jumps (reconnect / multi-hop) without bid value change
watch(
  () => props.bidCount,
  (n, prev) => {
    if (prev == null) return
    if (typeof n !== 'number' || n < 2) return
    if (n > prev) maybeFlashRally()
  },
)

function fireDeclareBurst(value: number, raise: RaiseClassification) {
  if (burstTimer) clearTimeout(burstTimer)
  const intensity = raiseIntensityFromTier(raise)
  declareBurst.value = {
    key: ++burstSeq,
    value,
    delta: raise.delta,
    intensity,
    tier: raise.tier,
    doubleRaise: raise.doubleRaise,
    raiseLabel: raiseTierLabel(raise),
  }
  // D2: land SFX — public bid only; pitch from HEAT + RAISE (no private info)
  const pitch = pitchForBidLand({
    heat: heat.value,
    tier: raise.tier,
  })
  const gain =
    raise.tier === 'wild' ? 1 : raise.tier === 'big' ? 0.92 : raise.tier === 'nice' ? 0.85 : 0.72
  playSfx('bid_land', { pitch, gain })
  // D4: haptic only on WILD CALL (limited wiring; not every bid land)
  if (raise.tier === 'wild') {
    playHaptic('wild_call')
  }
  const hold =
    raise.tier === 'wild'
      ? 1300
      : raise.tier === 'big'
        ? 1200
        : raise.tier === 'nice'
          ? 1100
          : intensity === 'soft'
            ? 700
            : 1050
  burstTimer = setTimeout(() => {
    declareBurst.value = null
    burstTimer = null
  }, hold)
}

function maybeFlashRally() {
  const n = props.bidCount ?? 0
  if (!shouldShowRally(n)) return
  if (rallyTimer) clearTimeout(rallyTimer)
  rallyFlash.value = { key: ++rallySeq, n }
  rallyTimer = setTimeout(() => {
    rallyFlash.value = null
    rallyTimer = null
  }, 900)
}

function spawnDelta(text: string, sign: 'up' | 'down') {
  const id = ++deltaSeq
  floatDeltas.value = [...floatDeltas.value.slice(-3), { id, text, sign }]
  window.setTimeout(() => {
    floatDeltas.value = floatDeltas.value.filter((d) => d.id !== id)
  }, 900)
}

const display = computed(() =>
  props.currentBid == null ? '—' : String(props.currentBid),
)

/** Fixed type scale — never changes during declare burst (bigger base sizes) */
const numSizeClass = computed(() =>
  props.compact
    ? 'text-5xl sm:text-6xl'
    : 'text-6xl sm:text-7xl xl:text-8xl',
)

const sparkleDensity = computed(() => {
  const b = declareBurst.value
  if (!b) return 'md' as const
  if (b.tier === 'wild' || b.tier === 'big' || b.intensity === 'open') return 'lg' as const
  return 'md' as const
})
</script>

<template>
  <!--
    Outer wrapper allows 「宣言！+N」to sit outside the visual frame.
    Parent panels should use overflow-visible.
  -->
  <div
    class="relative flex flex-col items-center text-center"
    :class="heat !== 'none' ? `bid-heat bid-heat--${heat}` : ''"
  >
    <!-- HEAT stage chip (persistent while elevated) -->
    <div
      v-if="heatLabel"
      class="bid-heat-chip pointer-events-none mb-0.5"
      :class="[
        compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]',
        `bid-heat-chip--${heat}`,
      ]"
      role="status"
      :aria-label="`卓の盛り上がり ${heatLabel}`"
    >
      {{ heatLabel }}
    </div>

    <!-- Frame content only: label + number + turns hint -->
    <div class="relative flex w-full flex-col items-center">
      <p
        class="font-medium tracking-[0.12em] text-gold-300/90"
        :class="compact ? 'text-[10px]' : 'text-xs'"
      >
        現在の宣言
      </p>

      <!-- Fixed stage: min size so transform FX don't reflow the table -->
      <div
        class="relative mt-0.5 flex items-center justify-center sm:mt-1"
        :class="
          compact
            ? 'min-h-[3.25rem] min-w-[5rem]'
            : 'min-h-[4.25rem] min-w-[6.5rem] sm:min-h-[5rem] xl:min-h-[5.5rem]'
        "
      >
        <!-- Soft glow ring on pop (absolute — no layout) -->
        <div
          v-if="popClass"
          :key="`glow-${popKey}`"
          class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          :class="[
            compact ? 'h-20 w-20' : 'h-28 w-28 sm:h-36 sm:w-36',
            popClass.includes('down') ? 'bid-glow--down' : 'bid-glow--up',
            heat !== 'none' ? `bid-glow--heat-${heat}` : '',
          ]"
          aria-hidden="true"
        />

        <!-- Declare impact overlays (absolute only) -->
        <template v-if="declareBurst">
          <div
            :key="`ripple-a-${declareBurst.key}`"
            class="bid-declare-ripple pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            :class="[
              compact ? 'h-32 w-32' : 'h-44 w-44 sm:h-52 sm:w-52',
              `bid-declare-ripple--${declareBurst.intensity}`,
              `bid-declare-ripple--tier-${declareBurst.tier}`,
              declareBurst.doubleRaise ? 'bid-declare-ripple--double' : '',
            ]"
            aria-hidden="true"
          />
          <div
            v-if="declareBurst.intensity !== 'soft'"
            :key="`ripple-b-${declareBurst.key}`"
            class="bid-declare-ripple bid-declare-ripple--delay pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            :class="[
              compact ? 'h-32 w-32' : 'h-44 w-44 sm:h-52 sm:w-52',
              `bid-declare-ripple--${declareBurst.intensity}`,
              `bid-declare-ripple--tier-${declareBurst.tier}`,
            ]"
            aria-hidden="true"
          />
          <!-- Double-raise extra ring -->
          <div
            v-if="declareBurst.doubleRaise"
            :key="`ripple-dbl-${declareBurst.key}`"
            class="bid-declare-ripple bid-declare-ripple--double-ring pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            :class="compact ? 'h-36 w-36' : 'h-48 w-48 sm:h-56 sm:w-56'"
            aria-hidden="true"
          />
          <div
            v-if="declareBurst.intensity !== 'soft'"
            class="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 sm:h-32 sm:w-32"
            aria-hidden="true"
          >
            <FxSparkleBurst :density="sparkleDensity" palette="gold" />
          </div>
          <!-- Echo: same type size as number; grows via CSS scale only -->
          <span
            :key="`echo-${declareBurst.key}`"
            class="bid-declare-echo pointer-events-none absolute left-1/2 top-1/2 font-display font-bold tabular-nums text-gold-200"
            :class="[
              numSizeClass,
              declareBurst.intensity === 'hard' ||
              declareBurst.intensity === 'open' ||
              declareBurst.tier === 'nice'
                ? 'bid-declare-echo--hard'
                : '',
              declareBurst.tier === 'wild' ? 'bid-declare-echo--wild' : '',
            ]"
            aria-hidden="true"
          >
            {{ declareBurst.value }}
          </span>
        </template>

        <!-- Stable number (fixed font size; pop via transform classes) -->
        <p
          :key="popKey"
          class="bid-num relative z-[1] font-display font-bold leading-none text-gold-100 tabular-nums"
          :class="[
            numSizeClass,
            popClass,
            declareBurst ? 'bid-num--declare' : '',
            heat === 'wild' ? 'bid-num--heat-wild' : '',
          ]"
          style="
            text-shadow:
              0 0 28px rgba(201, 168, 76, 0.35),
              0 0 8px rgba(201, 168, 76, 0.2);
          "
        >
          {{ display }}
        </p>

        <!-- Floating deltas (absolute, inside frame) -->
        <span
          v-for="d in floatDeltas"
          :key="d.id"
          class="bid-delta pointer-events-none absolute left-1/2 top-0 z-[2] font-display font-bold tabular-nums"
          :class="[
            compact ? 'text-base' : 'text-lg sm:text-xl',
            d.sign === 'up' ? 'bid-delta--up' : 'bid-delta--down',
          ]"
          aria-hidden="true"
        >
          {{ d.text }}
        </span>
      </div>

      <!-- Turns hint stays inside frame (stable height only when shown) -->
      <div
        v-if="showTurnsHint && turnsUntilSelf != null"
        class="relative mt-2 flex min-h-[1.5rem] items-center justify-center sm:min-h-[1.75rem]"
      >
        <p
          class="rounded-full border border-gold-400/25 bg-night-800/70 px-2.5 py-0.5 text-sand-dim shadow-sm backdrop-blur-sm"
          :class="compact ? 'text-[10px]' : 'text-xs'"
        >
          あなたまであと
          <span class="font-semibold text-gold-200">{{ turnsUntilSelf }}人</span>
        </p>
      </div>
    </div>

    <!--
      「宣言！」/ NICE·BIG·WILD / RALLY — outside the frame, below the block.
      Does not affect frame size; parent needs overflow-visible.
    -->
    <div
      v-if="declareBurst || rallyFlash || showRallyBadge"
      class="pointer-events-none absolute left-1/2 top-full z-20 flex -translate-x-1/2 flex-col items-center gap-1"
      :class="compact ? 'mt-1.5' : 'mt-2'"
    >
      <div
        v-if="declareBurst"
        :key="`badge-${declareBurst.key}`"
        class="bid-declare-badge flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-gold-400/55 bg-night-950/95 px-4 py-1.5 shadow-[0_0_28px_rgba(201,168,76,0.45)] backdrop-blur-sm sm:px-5 sm:py-2"
        :class="[
          compact ? 'text-xs' : 'text-sm sm:text-base',
          declareBurst.tier === 'wild'
            ? 'bid-declare-badge--wild'
            : declareBurst.tier === 'big'
              ? 'bid-declare-badge--big'
              : declareBurst.tier === 'nice'
                ? 'bid-declare-badge--nice'
                : '',
          declareBurst.doubleRaise ? 'bid-declare-badge--double' : '',
        ]"
        role="status"
      >
        <template v-if="declareBurst.raiseLabel">
          <span class="font-bold tracking-[0.12em] text-gold-50">
            {{ declareBurst.raiseLabel }}
          </span>
        </template>
        <template v-else>
          <span class="font-bold tracking-[0.16em] text-gold-50">宣言！</span>
          <span
            v-if="declareBurst.delta != null && declareBurst.delta > 0"
            class="font-display text-lg font-bold tabular-nums text-gold-100 sm:text-xl"
          >
            +{{ declareBurst.delta }}
          </span>
          <span
            v-else
            class="font-display text-lg font-bold tabular-nums text-gold-100 sm:text-xl"
          >
            {{ declareBurst.value }}
          </span>
        </template>
      </div>

      <!-- RALLY flash (2nd+ consecutive bid) -->
      <div
        v-if="rallyFlash || showRallyBadge"
        :key="rallyFlash ? `rally-${rallyFlash.key}` : 'rally-steady'"
        class="bid-rally-badge"
        :class="[
          compact ? 'text-[10px]' : 'text-xs',
          rallyFlash ? 'bid-rally-badge--flash' : 'bid-rally-badge--steady',
          heat === 'danger' || heat === 'wild' ? 'bid-rally-badge--hot' : '',
        ]"
        role="status"
        :aria-label="`連続宣言 ${rallyFlash?.n ?? bidCount} 回`"
      >
        RALLY ×{{ rallyFlash?.n ?? bidCount }}
      </div>
    </div>
  </div>
</template>
