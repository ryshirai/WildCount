<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Emoji fallback */
    avatar: string
    /** Portrait image URL (e.g. /avatars/owl.webp) */
    avatarSrc?: string | null
    name: string
    seatIndex?: number
    size?: 'sm' | 'md' | 'lg'
    highlighted?: boolean
    self?: boolean
    /** When true, only the face circle is shown (for logs / compact lists) */
    hideName?: boolean
  }>(),
  {
    size: 'md',
    hideName: false,
  },
)

const imgFailed = ref(false)

watch(
  () => props.avatarSrc,
  () => {
    imgFailed.value = false
  },
)

const showImage = computed(
  () => Boolean(props.avatarSrc) && !imgFailed.value,
)

const sizeClass = computed(() => {
  if (props.size === 'lg') return 'h-14 w-14 text-2xl'
  if (props.size === 'sm') return 'h-9 w-9 text-base'
  return 'h-11 w-11 text-xl'
})

const ringClass = computed(() => {
  if (props.highlighted) return 'ring-gold-300 shadow-gold-glow'
  if (props.self) return 'ring-teal-soft/80'
  return 'ring-gold-400/30'
})

function onImgError() {
  imgFailed.value = true
}
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <div class="relative">
      <div
        v-if="seatIndex != null"
        class="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-night-900 text-[10px] font-bold text-gold-300 ring-1 ring-gold-400/40"
      >
        {{ seatIndex }}
      </div>
      <div
        class="flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-night-600 to-night-800 ring-2"
        :class="[sizeClass, ringClass]"
      >
        <img
          v-if="showImage"
          :src="avatarSrc!"
          :alt="name"
          class="h-full w-full object-cover"
          draggable="false"
          @error="onImgError"
        />
        <span
          v-else
          class="select-none leading-none"
          aria-hidden="true"
        >{{ avatar }}</span>
      </div>
    </div>
    <div
      v-if="!hideName"
      class="max-w-[4.5rem] text-center leading-tight"
    >
      <div
        class="truncate text-xs font-semibold"
        :class="self ? 'text-teal-soft' : 'text-sand'"
      >
        {{ name }}
      </div>
      <slot name="status" />
    </div>
  </div>
</template>
