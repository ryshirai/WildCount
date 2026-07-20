<script setup lang="ts">
/**
 * Short impact banner for extra actions (特殊能力 / セイム / チェンジ).
 * Lighter than CoyoteCutIn — ~1.4s hold then fade.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'

export type ExtraFxKind =
  | 'reverse'
  | 'shot'
  | 'draw1'
  | 'life_double'
  | 'same'
  | 'change'

const props = withDefaults(
  defineProps<{
    kind: ExtraFxKind
    /** Actor display name */
    actorName?: string
    /** Target name (shot / draw1) */
    targetName?: string
    /** Bid value when relevant */
    bidValue?: number | null
    durationMs?: number
  }>(),
  {
    actorName: '',
    targetName: '',
    bidValue: null,
    durationMs: 1600,
  },
)

const emit = defineEmits<{
  done: []
}>()

const phase = ref<'in' | 'out'>('in')
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let outTimer: ReturnType<typeof setTimeout> | null = null

const meta = computed(() => {
  switch (props.kind) {
    case 'reverse':
      return {
        emoji: '🔄',
        title: 'リバース！',
        line: '手番が逆回りになった',
        tone: 'cyan' as const,
      }
    case 'shot':
      return {
        emoji: '🎯',
        title: 'ショット！',
        line: props.targetName
          ? `次は ${props.targetName} の番`
          : '次の手番を指名した',
        tone: 'gold' as const,
      }
    case 'draw1':
      return {
        emoji: '🃏',
        title: 'ドロー！',
        line: props.targetName
          ? `${props.targetName} に札が1枚増えた`
          : '誰かに札が1枚増えた',
        tone: 'violet' as const,
      }
    case 'life_double':
      return {
        emoji: '⚡',
        title: 'ダブル！',
        line: '次のコヨーテはライフ −2',
        tone: 'red' as const,
      }
    case 'same':
      return {
        emoji: '✋',
        title: 'セイム！',
        line:
          props.bidValue != null
            ? `宣言 ${props.bidValue} のままパス`
            : '宣言そのままでパス',
        tone: 'sand' as const,
      }
    case 'change':
      return {
        emoji: '🔀',
        title: 'チェンジ！',
        line: '直前の宣言を付け直し！',
        tone: 'amber' as const,
      }
    default:
      return {
        emoji: '✨',
        title: 'アクション！',
        line: '',
        tone: 'gold' as const,
      }
  }
})

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
  outTimer = setTimeout(finish, 280)
}

onMounted(() => {
  const hold = Math.max(600, props.durationMs - 280)
  dismissTimer = setTimeout(beginOut, hold)
})

onUnmounted(() => {
  clearTimers()
})
</script>

<template>
  <div
    class="extra-fx"
    :class="[
      phase === 'out' ? 'extra-fx--out' : 'extra-fx--in',
      `extra-fx--${meta.tone}`,
    ]"
    role="status"
    aria-live="polite"
    @click="beginOut"
  >
    <div class="extra-fx__scrim" aria-hidden="true" />
    <div class="extra-fx__slash" aria-hidden="true" />
    <div class="extra-fx__card">
      <span class="extra-fx__emoji" aria-hidden="true">{{ meta.emoji }}</span>
      <div class="extra-fx__text">
        <p v-if="actorName" class="extra-fx__actor">{{ actorName }}</p>
        <p class="extra-fx__title">{{ meta.title }}</p>
        <p v-if="meta.line" class="extra-fx__line">{{ meta.line }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.extra-fx {
  pointer-events: auto;
  position: fixed;
  inset: 0;
  z-index: 55;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.extra-fx__scrim {
  position: absolute;
  inset: 0;
  background: rgba(6, 10, 18, 0.55);
}

.extra-fx__slash {
  position: absolute;
  left: -10%;
  right: -10%;
  height: 7.5rem;
  transform: rotate(-6deg);
  opacity: 0.9;
}

.extra-fx--cyan .extra-fx__slash {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(45, 212, 191, 0.35),
    rgba(45, 212, 191, 0.55),
    rgba(45, 212, 191, 0.35),
    transparent
  );
}
.extra-fx--gold .extra-fx__slash {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(201, 168, 76, 0.35),
    rgba(240, 215, 140, 0.55),
    rgba(201, 168, 76, 0.35),
    transparent
  );
}
.extra-fx--violet .extra-fx__slash {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(167, 139, 250, 0.35),
    rgba(196, 181, 253, 0.5),
    rgba(167, 139, 250, 0.35),
    transparent
  );
}
.extra-fx--red .extra-fx__slash {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(248, 113, 113, 0.35),
    rgba(252, 165, 165, 0.5),
    rgba(248, 113, 113, 0.35),
    transparent
  );
}
.extra-fx--sand .extra-fx__slash {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(214, 199, 168, 0.28),
    rgba(232, 220, 190, 0.45),
    rgba(214, 199, 168, 0.28),
    transparent
  );
}
.extra-fx--amber .extra-fx__slash {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(251, 191, 36, 0.35),
    rgba(253, 224, 71, 0.5),
    rgba(251, 191, 36, 0.35),
    transparent
  );
}

.extra-fx__card {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: min(20rem, 88vw);
  max-width: 24rem;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  border: 1px solid rgba(201, 168, 76, 0.35);
  background: linear-gradient(
    145deg,
    rgba(20, 28, 44, 0.96),
    rgba(10, 14, 24, 0.98)
  );
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 16px 40px rgba(0, 0, 0, 0.45),
    0 0 32px rgba(201, 168, 76, 0.12);
}

.extra-fx__emoji {
  flex-shrink: 0;
  font-size: 2.25rem;
  line-height: 1;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
}

.extra-fx__text {
  min-width: 0;
  flex: 1;
}

.extra-fx__actor {
  margin: 0 0 0.15rem;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: rgba(214, 199, 168, 0.85);
}

.extra-fx__title {
  margin: 0;
  font-family: var(--font-display, ui-sans-serif), system-ui, sans-serif;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.1;
  color: #f5e6b8;
  text-shadow: 0 0 18px rgba(201, 168, 76, 0.35);
}

.extra-fx--cyan .extra-fx__title {
  color: #5eead4;
  text-shadow: 0 0 18px rgba(45, 212, 191, 0.4);
}
.extra-fx--violet .extra-fx__title {
  color: #ddd6fe;
  text-shadow: 0 0 18px rgba(167, 139, 250, 0.4);
}
.extra-fx--red .extra-fx__title {
  color: #fecaca;
  text-shadow: 0 0 18px rgba(248, 113, 113, 0.4);
}
.extra-fx--amber .extra-fx__title {
  color: #fde68a;
  text-shadow: 0 0 18px rgba(251, 191, 36, 0.4);
}

.extra-fx__line {
  margin: 0.3rem 0 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: rgba(232, 220, 190, 0.9);
}

/* enter / leave */
.extra-fx--in .extra-fx__scrim {
  animation: extra-fx-scrim-in 0.28s ease-out both;
}
.extra-fx--in .extra-fx__slash {
  animation: extra-fx-slash-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.extra-fx--in .extra-fx__card {
  animation: extra-fx-card-in 0.45s 0.05s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.extra-fx--in .extra-fx__emoji {
  animation: extra-fx-emoji-pop 0.5s 0.12s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.extra-fx--out {
  pointer-events: none;
}
.extra-fx--out .extra-fx__scrim {
  animation: extra-fx-scrim-out 0.28s ease-in both;
}
.extra-fx--out .extra-fx__slash,
.extra-fx--out .extra-fx__card {
  animation: extra-fx-out 0.28s ease-in both;
}

@keyframes extra-fx-scrim-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes extra-fx-scrim-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes extra-fx-slash-in {
  from {
    opacity: 0;
    transform: rotate(-6deg) scaleX(0.4);
  }
  to {
    opacity: 0.9;
    transform: rotate(-6deg) scaleX(1);
  }
}
@keyframes extra-fx-card-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.88);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes extra-fx-emoji-pop {
  0% {
    transform: scale(0.4) rotate(-20deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.15) rotate(6deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0);
  }
}
@keyframes extra-fx-out {
  to {
    opacity: 0;
    transform: scale(0.94) translateY(-8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .extra-fx--in .extra-fx__scrim,
  .extra-fx--in .extra-fx__slash,
  .extra-fx--in .extra-fx__card,
  .extra-fx--in .extra-fx__emoji,
  .extra-fx--out .extra-fx__scrim,
  .extra-fx--out .extra-fx__slash,
  .extra-fx--out .extra-fx__card {
    animation: none !important;
  }
}
</style>
