<script setup lang="ts">
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

function floor() {
  return props.minBid ?? 0
}

function adjust(delta: number) {
  bid.value = Math.max(floor(), bid.value + delta)
}
</script>

<template>
  <div
    class="border-t border-gold-400/15 bg-night-900/85 backdrop-blur-md"
    :class="mobile ? 'px-3 py-3 safe-bottom' : 'px-5 py-4'"
  >
    <p v-if="!mobile" class="mb-3 text-sm text-sand-dim">
      次の宣言を選択してください
    </p>
    <p v-else class="mb-2 text-center text-xs text-sand-dim">次の宣言を選択</p>

    <div
      class="flex flex-wrap items-center gap-2"
      :class="mobile ? 'justify-center' : 'justify-start'"
    >
      <!-- Stepper -->
      <div
        class="flex items-center gap-1 rounded-xl border border-gold-400/25 bg-night-800/80 p-1"
      >
        <button
          type="button"
          class="btn-ghost !h-10 !w-10 !p-0 text-lg"
          aria-label="1減らす"
          @click="adjust(-1)"
        >
          −
        </button>
        <span
          class="min-w-[3rem] text-center font-display text-2xl font-bold text-gold-100"
        >
          {{ bid }}
        </span>
        <button
          type="button"
          class="btn-ghost !h-10 !w-10 !p-0 text-lg"
          aria-label="1増やす"
          @click="adjust(1)"
        >
          ＋
        </button>
      </div>

      <button type="button" class="btn-ghost !px-3 !py-2.5 font-semibold" @click="adjust(1)">
        +1
      </button>
      <button type="button" class="btn-ghost !px-3 !py-2.5 font-semibold" @click="adjust(5)">
        +5
      </button>

      <div class="flex flex-1 flex-wrap gap-2" :class="mobile ? 'w-full basis-full' : 'min-w-[16rem] justify-end'">
        <button
          type="button"
          class="btn-gold flex-1 sm:flex-none"
          :disabled="canDeclare === false"
          @click="emit('declare', bid)"
        >
          <template v-if="mobile">宣言する</template>
          <template v-else>{{ bid }}を宣言</template>
        </button>
        <button
          type="button"
          class="btn-teal flex-1 sm:flex-none"
          :disabled="canChallenge === false"
          @click="emit('challenge')"
        >
          <span aria-hidden="true">🐾</span>
          <template v-if="mobile">コヨーテ！（チャレンジ）</template>
          <template v-else>コヨーテ！</template>
        </button>
      </div>
    </div>
  </div>
</template>
