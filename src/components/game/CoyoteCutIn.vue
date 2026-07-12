<script setup lang="ts">
/**
 * Full-screen "COYOTE!" cut-in when a challenge lands.
 * CSS-only drama: flash → slash banner → portrait slam → hold → fade.
 */
import { onMounted, onUnmounted, ref } from 'vue'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'

const props = withDefaults(
  defineProps<{
    challengerName: string
    challengerAvatar: string
    challengerAvatarSrc?: string | null
    bidderName?: string
    bidValue?: number | null
    /** Auto-dismiss after this many ms (default ~2.4s) */
    durationMs?: number
  }>(),
  {
    bidderName: '',
    bidValue: null,
    durationMs: 2400,
  },
)

const emit = defineEmits<{
  done: []
  skip: []
}>()

const phase = ref<'in' | 'out'>('in')
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let outTimer: ReturnType<typeof setTimeout> | null = null

function finish() {
  emit('done')
}

function clearTimers() {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  if (outTimer) {
    clearTimeout(outTimer)
    outTimer = null
  }
}

function beginOut() {
  if (phase.value === 'out') return
  phase.value = 'out'
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  outTimer = setTimeout(finish, 320)
}

function onSkip() {
  emit('skip')
  beginOut()
}

onMounted(() => {
  const hold = Math.max(800, props.durationMs - 320)
  dismissTimer = setTimeout(beginOut, hold)
})

onUnmounted(() => {
  clearTimers()
})
</script>

<template>
  <div
    class="coyote-cutin"
    :class="phase === 'out' ? 'coyote-cutin--out' : 'coyote-cutin--in'"
    role="dialog"
    aria-modal="true"
    aria-label="コヨーテ！"
    @click="onSkip"
  >
    <!-- Flash layers -->
    <div class="coyote-cutin__flash" aria-hidden="true" />
    <div class="coyote-cutin__vignette" aria-hidden="true" />
    <div class="coyote-cutin__speedlines" aria-hidden="true" />

    <!-- Diagonal slash band -->
    <div class="coyote-cutin__slash" aria-hidden="true">
      <div class="coyote-cutin__slash-inner" />
    </div>

    <!-- Content -->
    <div class="coyote-cutin__content">
      <p class="coyote-cutin__eyebrow">CHALLENGE</p>

      <div class="coyote-cutin__portrait">
        <div class="coyote-cutin__ring" aria-hidden="true" />
        <div class="coyote-cutin__avatar-scale">
          <PlayerAvatar
            :avatar="challengerAvatar"
            :avatar-src="challengerAvatarSrc"
            :name="challengerName"
            size="lg"
            hide-name
            highlighted
          />
        </div>
      </div>

      <h2 class="coyote-cutin__title">
        <span class="coyote-cutin__title-jp">コヨーテ！</span>
        <span class="coyote-cutin__title-en" aria-hidden="true">COYOTE</span>
      </h2>

      <p class="coyote-cutin__who">
        <span class="font-semibold text-gold-100">{{ challengerName }}</span>
        <template v-if="bidderName && bidValue != null">
          <span class="text-sand-dim"> が </span>
          <span class="font-semibold text-sand">{{ bidderName }}</span>
          <span class="text-sand-dim"> の </span>
          <span class="coyote-cutin__bid">{{ bidValue }}</span>
          <span class="text-sand-dim"> に挑戦</span>
        </template>
        <template v-else>
          <span class="text-sand-dim"> のチャレンジ</span>
        </template>
      </p>

      <p class="coyote-cutin__hint">タップでスキップ</p>
    </div>

    <!-- Impact corners -->
    <div class="coyote-cutin__corner coyote-cutin__corner--tl" aria-hidden="true" />
    <div class="coyote-cutin__corner coyote-cutin__corner--br" aria-hidden="true" />
  </div>
</template>
