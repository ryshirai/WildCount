<script setup lang="ts">
import { AVATAR_ASSETS, avatarSrc } from '@/localGame/avatarCatalog'

const model = defineModel<number>({ required: true })

withDefaults(
  defineProps<{
    disabled?: boolean
    /** Accessible group label */
    label?: string
  }>(),
  {
    disabled: false,
    label: 'アイコン',
  },
)

function select(index: number) {
  if (model.value === index) return
  model.value = index
}
</script>

<template>
  <fieldset :disabled="disabled" class="min-w-0">
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
      {{ AVATAR_ASSETS[model]?.name ?? '—' }}
    </p>
  </fieldset>
</template>
