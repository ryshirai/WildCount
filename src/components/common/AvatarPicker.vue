<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { AVATAR_ASSETS, avatarSrc } from '@/localGame/avatarCatalog'

const model = defineModel<number>({ required: true })

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** Accessible group label */
    label?: string
    /**
     * `grid` — always show the full catalog (lobby).
     * `compact` — selected summary + “アイコンを変更” opens a modal.
     */
    variant?: 'grid' | 'compact'
  }>(),
  {
    disabled: false,
    label: 'アイコン',
    variant: 'grid',
  },
)

const pickerOpen = ref(false)
const closeBtnRef = ref<HTMLButtonElement | null>(null)

const selected = computed(() => AVATAR_ASSETS[model.value] ?? AVATAR_ASSETS[0]!)

function select(index: number) {
  if (props.disabled) return
  if (model.value !== index) {
    model.value = index
  }
  if (props.variant === 'compact' && pickerOpen.value) {
    closePicker()
  }
}

function openPicker() {
  if (props.disabled) return
  pickerOpen.value = true
}

function closePicker() {
  pickerOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (!pickerOpen.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    closePicker()
  }
}

watch(pickerOpen, (isOpen) => {
  if (isOpen) {
    requestAnimationFrame(() => {
      closeBtnRef.value?.focus()
    })
    document.documentElement.style.overflow = 'hidden'
  } else {
    document.documentElement.style.overflow = ''
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <!-- Compact: selected portrait + change action -->
  <div v-if="variant === 'compact'" class="min-w-0">
    <div class="flex items-center gap-3 sm:gap-4">
      <button
        type="button"
        class="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-teal-soft/60 bg-night-900/80 shadow-[0_0_14px_rgba(42,138,138,0.28)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50 sm:h-[4.5rem] sm:w-[4.5rem] lg:h-20 lg:w-20"
        :disabled="disabled"
        :aria-label="`${selected.name} — アイコンを変更`"
        @click="openPicker"
      >
        <img
          :src="avatarSrc(selected.id)"
          :alt="selected.name"
          class="h-full w-full object-cover"
          draggable="false"
        />
        <span
          class="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15"
          aria-hidden="true"
        />
      </button>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-sand lg:text-base">
          選択中：{{ selected.name }}
        </p>
        <button
          type="button"
          class="btn-ghost btn-sm mt-2"
          :disabled="disabled"
          @click="openPicker"
        >
          アイコンを変更
        </button>
      </div>
    </div>

    <!-- Modal picker -->
    <Teleport to="body">
      <div
        v-if="pickerOpen"
        class="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
      >
        <button
          type="button"
          class="absolute inset-0 bg-night-950/75"
          aria-label="閉じる"
          @click="closePicker"
        />
        <div
          class="relative z-10 flex max-h-[min(85dvh,36rem)] w-full max-w-md flex-col rounded-t-2xl border border-gold-400/25 bg-night-800 shadow-panel sm:mx-4 sm:rounded-2xl"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-3 border-b border-gold-400/15 px-4 py-3 sm:px-5"
          >
            <h2
              id="avatar-picker-title"
              class="text-sm font-semibold text-gold-200 sm:text-base"
            >
              アイコンを選ぶ
            </h2>
            <button
              ref="closeBtnRef"
              type="button"
              class="btn-ghost btn-sm"
              @click="closePicker"
            >
              閉じる
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div
              class="grid grid-cols-5 gap-2.5 sm:gap-3"
              role="listbox"
              :aria-label="label"
            >
              <button
                v-for="(asset, index) in AVATAR_ASSETS"
                :key="asset.id"
                type="button"
                role="option"
                class="relative flex aspect-square items-center justify-center overflow-hidden rounded-full border bg-night-900/80 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
                :class="
                  model === index
                    ? 'border-teal-soft ring-2 ring-teal-soft/70 shadow-[0_0_12px_rgba(42,138,138,0.35)]'
                    : 'border-gold-400/25 hover:border-gold-400/50'
                "
                :aria-selected="model === index"
                :aria-label="asset.name"
                :title="asset.name"
                @click="select(index)"
              >
                <img
                  :src="avatarSrc(asset.id)"
                  :alt="asset.name"
                  class="h-full w-full object-cover"
                  draggable="false"
                  loading="lazy"
                />
                <span
                  v-if="model === index"
                  class="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/20"
                  aria-hidden="true"
                />
              </button>
            </div>
            <p class="mt-3 text-center text-xs text-sand-dim">
              選択中：{{ selected.name }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- Grid: always-visible catalog (lobby) -->
  <fieldset v-else :disabled="disabled" class="min-w-0">
    <legend class="mb-1.5 text-xs text-sand-dim">{{ label }}</legend>
    <div
      class="grid grid-cols-5 gap-2 sm:gap-2.5"
      role="listbox"
      :aria-label="label"
    >
      <button
        v-for="(asset, index) in AVATAR_ASSETS"
        :key="asset.id"
        type="button"
        role="option"
        class="relative flex aspect-square items-center justify-center overflow-hidden rounded-full border bg-night-900/80 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50"
        :class="
          model === index
            ? 'border-teal-soft ring-2 ring-teal-soft/70 shadow-[0_0_12px_rgba(42,138,138,0.35)]'
            : 'border-gold-400/25 hover:border-gold-400/50'
        "
        :aria-selected="model === index"
        :aria-label="asset.name"
        :title="asset.name"
        @click="select(index)"
      >
        <img
          :src="avatarSrc(asset.id)"
          :alt="asset.name"
          class="h-full w-full object-cover"
          draggable="false"
          loading="lazy"
        />
        <span
          v-if="model === index"
          class="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/20"
          aria-hidden="true"
        />
      </button>
    </div>
    <p class="mt-1.5 text-[11px] text-sand-dim">
      選択中：{{ selected.name }}
    </p>
  </fieldset>
</template>
