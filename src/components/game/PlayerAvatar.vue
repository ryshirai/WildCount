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
/** One cache-bust retry when a stale SW/CDN entry returns a bad image. */
const retrySrc = ref<string | null>(null)

watch(
  () => props.avatarSrc,
  () => {
    imgFailed.value = false
    retrySrc.value = null
  },
)

const effectiveSrc = computed(() => retrySrc.value ?? props.avatarSrc)

const showImage = computed(
  () => Boolean(effectiveSrc.value) && !imgFailed.value,
)

const sizeClass = computed(() => {
  if (props.size === 'lg') return 'h-[4.5rem] w-[4.5rem] text-3xl sm:h-[4.75rem] sm:w-[4.75rem]'
  if (props.size === 'sm') return 'h-11 w-11 text-lg'
  /* md: ~1.2× prior seat portrait */
  return 'h-14 w-14 text-2xl sm:h-16 sm:w-16 sm:text-[1.65rem]'
})

const ringClass = computed(() => {
  if (props.highlighted) {
    return 'ring-[3px] ring-gold-200 shadow-turn-glow avatar-turn-ring'
  }
  if (props.self)
    return 'ring-[3px] ring-teal-soft/75 shadow-[0_0_22px_rgba(42,138,138,0.5),0_0_8px_rgba(94,200,200,0.35)]'
  return 'ring-2 ring-gold-400/30'
})

function onImgError() {
  const src = props.avatarSrc
  if (src && !retrySrc.value) {
    const sep = src.includes('?') ? '&' : '?'
    retrySrc.value = `${src}${sep}_=${Date.now()}`
    return
  }
  imgFailed.value = true
}
</script>

<template>
  <div class="flex flex-col items-center gap-1.5">
    <div class="relative">
      <div
        v-if="seatIndex != null"
        class="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-night-900 text-[10px] font-bold text-gold-300 ring-1 ring-gold-400/45 shadow-sm sm:h-6 sm:w-6 sm:text-[11px]"
      >
        {{ seatIndex }}
      </div>
      <div
        class="flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-night-600 to-night-800"
        :class="[sizeClass, ringClass]"
      >
        <img
          v-if="showImage"
          :src="effectiveSrc!"
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
      <!-- Turn badge: scannable "whose turn" without reading seat chips -->
      <div
        v-if="highlighted"
        class="avatar-turn-badge"
        :class="size === 'sm' ? 'avatar-turn-badge--sm' : ''"
        aria-hidden="true"
      >
        番
      </div>
    </div>
    <div
      v-if="!hideName"
      class="max-w-[6.5rem] text-center leading-tight sm:max-w-[7.5rem]"
    >
      <div
        class="truncate text-sm font-semibold sm:text-[0.95rem]"
        :class="[
          highlighted
            ? 'text-gold-50'
            : self
              ? 'text-teal-soft'
              : 'text-sand',
        ]"
      >
        {{ name }}
      </div>
      <slot name="status" />
    </div>
  </div>
</template>
