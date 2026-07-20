<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    confirmLabel?: string
    cancelLabel?: string
    /** Use btn-danger for the primary confirm button */
    danger?: boolean
  }>(),
  {
    confirmLabel: '確認',
    cancelLabel: 'キャンセル',
    danger: false,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:open': [value: boolean]
}>()

const titleId = useId()

function onCancel() {
  emit('cancel')
  emit('update:open', false)
}

function onConfirm() {
  emit('confirm')
  emit('update:open', false)
}
</script>

<template>
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
        v-if="open"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-night-950/75 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.self="onCancel"
      >
        <div class="panel w-full max-w-sm space-y-4 p-5 shadow-panel" @click.stop>
          <h2 :id="titleId" class="font-display text-lg font-bold text-gold-200">
            {{ title }}
          </h2>
          <div class="text-sm leading-relaxed text-sand-dim">
            <slot />
          </div>
          <div class="flex flex-col gap-2">
            <slot name="actions">
              <button
                type="button"
                class="w-full"
                :class="danger ? 'btn-danger' : 'btn-gold'"
                @click="onConfirm"
              >
                {{ confirmLabel }}
              </button>
              <button type="button" class="btn-ghost w-full" @click="onCancel">
                {{ cancelLabel }}
              </button>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
