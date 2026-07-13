<script setup lang="ts">
/**
 * Center bid display with dopamine micro-fx:
 * number slam on change + floating delta (+N / −N)
 * + declare burst (ripple / echo). 「宣言！+N」badge sits OUTSIDE the frame.
 *
 * Layout stays fixed: font sizes / footer height never swap on burst.
 * Scale / opacity FX only (absolute overlays).
 */
import { computed, ref, watch } from 'vue'
import FxSparkleBurst from '@/components/common/FxSparkleBurst.vue'

const props = withDefaults(
  defineProps<{
    currentBid: number | null
    turnsUntilSelf?: number
    compact?: boolean
    showTurnsHint?: boolean
  }>(),
  {
    showTurnsHint: true,
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
} | null>(null)
let deltaSeq = 0
let burstSeq = 0
let burstTimer: ReturnType<typeof setTimeout> | null = null
let prevBid: number | null | undefined = undefined

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
      fireDeclareBurst(next, null)
    } else if (next == null) {
      popClass.value = 'bid-num--fade'
    } else if (from != null && next > from) {
      popClass.value = 'bid-num--up'
      spawnDelta(`+${next - from}`, 'up')
      fireDeclareBurst(next, next - from)
    } else if (from != null && next < from) {
      popClass.value = 'bid-num--down'
      spawnDelta(`${next - from}`, 'down')
    } else {
      popClass.value = 'bid-num--slam'
    }
  },
)

function fireDeclareBurst(value: number, delta: number | null) {
  if (burstTimer) clearTimeout(burstTimer)
  declareBurst.value = { key: ++burstSeq, value, delta }
  burstTimer = setTimeout(() => {
    declareBurst.value = null
    burstTimer = null
  }, 1100)
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
</script>

<template>
  <!--
    Outer wrapper allows 「宣言！+N」to sit outside the visual frame.
    Parent panels should use overflow-visible.
  -->
  <div class="relative flex flex-col items-center text-center">
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
          ]"
          aria-hidden="true"
        />

        <!-- Declare impact overlays (absolute only) -->
        <template v-if="declareBurst">
          <div
            :key="`ripple-a-${declareBurst.key}`"
            class="bid-declare-ripple pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            :class="compact ? 'h-32 w-32' : 'h-44 w-44 sm:h-52 sm:w-52'"
            aria-hidden="true"
          />
          <div
            :key="`ripple-b-${declareBurst.key}`"
            class="bid-declare-ripple bid-declare-ripple--delay pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            :class="compact ? 'h-32 w-32' : 'h-44 w-44 sm:h-52 sm:w-52'"
            aria-hidden="true"
          />
          <div
            class="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 sm:h-32 sm:w-32"
            aria-hidden="true"
          >
            <FxSparkleBurst density="lg" palette="gold" />
          </div>
          <!-- Echo: same type size as number; grows via CSS scale only -->
          <span
            :key="`echo-${declareBurst.key}`"
            class="bid-declare-echo pointer-events-none absolute left-1/2 top-1/2 font-display font-bold tabular-nums text-gold-200"
            :class="numSizeClass"
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
      「宣言！+N」— outside the frame, below the whole block.
      Does not affect frame size; parent needs overflow-visible.
    -->
    <div
      v-if="declareBurst"
      :key="`badge-${declareBurst.key}`"
      class="bid-declare-badge pointer-events-none absolute left-1/2 top-full z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border-2 border-gold-400/55 bg-night-950/95 px-4 py-1.5 shadow-[0_0_28px_rgba(201,168,76,0.45)] backdrop-blur-sm sm:px-5 sm:py-2"
      :class="[
        compact ? 'mt-1.5 text-xs' : 'mt-2 text-sm sm:text-base',
      ]"
      role="status"
    >
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
    </div>
  </div>
</template>
