<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    message: string | null
    /** Auto-dismiss delay in ms */
    duration?: number
  }>(),
  { duration: 2500 },
)

const emit = defineEmits<{
  dismiss: []
}>()

let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (timer != null) {
    clearTimeout(timer)
    timer = null
  }
}

watch(
  () => props.message,
  (msg) => {
    clearTimer()
    if (!msg) return
    timer = setTimeout(() => {
      timer = null
      emit('dismiss')
    }, props.duration)
  },
  { immediate: true },
)

onUnmounted(clearTimer)
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="message"
      class="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-gold-400/30 bg-night-800/95 px-4 py-2 text-sm text-gold-100 shadow-panel"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </div>
  </Transition>
</template>
