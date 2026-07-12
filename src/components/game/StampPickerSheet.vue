<script setup lang="ts">
import type { StampId } from '@/online/stamps'
import { STAMP_CATALOG } from '@/online/stamps'

const props = withDefaults(
  defineProps<{
    open: boolean
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  close: []
  pick: [stampId: StampId]
}>()

function onPick(id: StampId) {
  if (props.disabled) return
  emit('pick', id)
  emit('close')
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
        class="fixed inset-0 z-[70] flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="スタンプを選ぶ"
      >
        <button
          type="button"
          class="absolute inset-0 bg-night-950/55 backdrop-blur-[2px]"
          aria-label="閉じる"
          @click="emit('close')"
        />
        <div
          class="relative z-10 mx-auto w-full max-w-lg rounded-t-2xl border border-gold-400/25 border-b-0 bg-night-900/98 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-panel"
          @click.stop
        >
          <div class="mb-1 flex justify-center pt-1" aria-hidden="true">
            <div class="h-1 w-10 rounded-full bg-gold-400/30" />
          </div>
          <div class="mb-2 flex items-center justify-between px-1">
            <p class="text-sm font-semibold text-gold-200">スタンプ</p>
            <button
              type="button"
              class="btn-ghost !px-2 !py-1 text-[11px]"
              @click="emit('close')"
            >
              閉じる
            </button>
          </div>
          <p
            v-if="disabled"
            class="mb-2 px-1 text-center text-xs text-sand-dim"
          >
            接続中のみ送れます
          </p>
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="s in STAMP_CATALOG"
              :key="s.id"
              type="button"
              class="flex flex-col items-center rounded-2xl border border-gold-400/15 bg-night-950/70 px-1 py-2.5 transition active:scale-95 enabled:hover:border-gold-400/40 enabled:hover:bg-teal-deep/35 disabled:opacity-40"
              :disabled="disabled"
              :title="s.label"
              :aria-label="s.label"
              @click="onPick(s.id)"
            >
              <span class="text-3xl leading-none">{{ s.emoji }}</span>
              <span class="mt-1 max-w-full truncate text-[10px] text-sand-dim">{{
                s.label
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
