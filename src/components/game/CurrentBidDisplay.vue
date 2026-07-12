<script setup lang="ts">
/**
 * Center bid display with dopamine micro-fx:
 * number slam on change + floating delta (+N / −N).
 */
import { computed, ref, watch } from 'vue'

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
let deltaSeq = 0
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
    } else if (next == null) {
      popClass.value = 'bid-num--fade'
    } else if (from != null && next > from) {
      popClass.value = 'bid-num--up'
      spawnDelta(`+${next - from}`, 'up')
    } else if (from != null && next < from) {
      popClass.value = 'bid-num--down'
      spawnDelta(`${next - from}`, 'down')
    } else {
      popClass.value = 'bid-num--slam'
    }
  },
)

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
</script>

<template>
  <div class="relative flex flex-col items-center text-center">
    <p
      class="font-medium tracking-[0.12em] text-gold-300/90"
      :class="compact ? 'text-[10px]' : 'text-xs'"
    >
      現在の宣言
    </p>

    <div class="relative mt-0.5 sm:mt-1">
      <!-- Soft glow ring on pop -->
      <div
        v-if="popClass"
        :key="`glow-${popKey}`"
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        :class="[
          compact ? 'h-14 w-14' : 'h-20 w-20 sm:h-24 sm:w-24',
          popClass.includes('down') ? 'bid-glow--down' : 'bid-glow--up',
        ]"
        aria-hidden="true"
      />

      <p
        :key="popKey"
        class="bid-num font-display font-bold leading-none text-gold-100 tabular-nums"
        :class="[
          compact
            ? 'text-3xl sm:text-4xl'
            : 'text-4xl sm:text-5xl xl:text-6xl',
          popClass,
        ]"
        style="text-shadow: 0 0 28px rgba(201, 168, 76, 0.35), 0 0 8px rgba(201, 168, 76, 0.2)"
      >
        {{ display }}
      </p>

      <!-- Floating deltas -->
      <span
        v-for="d in floatDeltas"
        :key="d.id"
        class="bid-delta pointer-events-none absolute left-1/2 top-0 font-display font-bold tabular-nums"
        :class="[
          compact ? 'text-sm' : 'text-base sm:text-lg',
          d.sign === 'up' ? 'bid-delta--up' : 'bid-delta--down',
        ]"
        aria-hidden="true"
      >
        {{ d.text }}
      </span>
    </div>

    <p
      v-if="showTurnsHint && turnsUntilSelf != null"
      class="mt-2 rounded-full border border-gold-400/25 bg-night-800/70 px-2.5 py-0.5 text-sand-dim shadow-sm backdrop-blur-sm"
      :class="compact ? 'text-[10px]' : 'text-xs'"
    >
      あなたまであと
      <span class="font-semibold text-gold-200">{{ turnsUntilSelf }}人</span>
    </p>
  </div>
</template>
