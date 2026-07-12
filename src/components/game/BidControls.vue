<script setup lang="ts">
import { ref } from 'vue'

const bid = defineModel<number>({ required: true })

const props = defineProps<{
  minBid?: number
  canChallenge?: boolean
  canDeclare?: boolean
  mobile?: boolean
}>()

const emit = defineEmits<{
  declare: [value: number]
  challenge: []
}>()

const tickKey = ref(0)
const declareFlash = ref(false)
const challengeFlash = ref(false)

function floor() {
  return props.minBid ?? 0
}

function adjust(delta: number) {
  const next = Math.max(floor(), bid.value + delta)
  if (next === bid.value && delta < 0) return
  bid.value = next
  tickKey.value += 1
}

function onDeclare() {
  if (props.canDeclare === false) return
  declareFlash.value = true
  window.setTimeout(() => {
    declareFlash.value = false
  }, 360)
  emit('declare', bid.value)
}

function onChallenge() {
  if (props.canChallenge === false) return
  challengeFlash.value = true
  window.setTimeout(() => {
    challengeFlash.value = false
  }, 360)
  emit('challenge')
}
</script>

<template>
  <div
    class="border-t border-gold-400/15 bg-night-900/85 backdrop-blur-md"
    :class="mobile ? 'px-2.5 py-1.5' : 'px-4 py-2.5 sm:py-3'"
  >
    <p v-if="!mobile" class="mb-1.5 text-xs text-sand-dim sm:mb-2">
      次の宣言を選択してください
    </p>
    <p v-else class="mb-1 text-center text-[10px] text-sand-dim">次の宣言</p>

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
        class="flex flex-1 flex-wrap gap-1.5"
        :class="mobile ? 'w-full basis-full' : 'min-w-[14rem] justify-end'"
      >
        <button
          type="button"
          class="btn-gold flex-1 sm:flex-none"
          :class="[
            declareFlash ? 'btn-fx-press' : '',
            mobile ? '!py-2 text-sm' : '',
          ]"
          :disabled="canDeclare === false"
          @click="onDeclare"
        >
          <template v-if="mobile">宣言する</template>
          <template v-else>{{ bid }}を宣言</template>
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
          <template v-if="mobile">コヨーテ！</template>
          <template v-else>コヨーテ！</template>
        </button>
      </div>
    </div>
  </div>
</template>
