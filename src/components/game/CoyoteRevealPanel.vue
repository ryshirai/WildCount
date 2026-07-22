<script setup lang="ts">
/**
 * Post-coyote card reveal grid (desktop + mobile).
 * R3: unified from dual templates in GameView — class names preserved per variant.
 */
import type { CoyoteBanner } from '@/composables/useChallengeReveal'
import type { RevealedCard } from '@/types/game'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'
import RevealCardTile from '@/components/game/RevealCardTile.vue'
import { isExtremeNumber } from '@/utils/resultDrama'

withDefaults(
  defineProps<{
    banner: CoyoteBanner
    revealCards: readonly RevealedCard[]
    revealedCount: number
    cardsRevealDone: boolean
    /** `desktop` keeps lg grid breakpoints + avatar header; `mobile` is compact */
    variant?: 'desktop' | 'mobile'
  }>(),
  { variant: 'desktop' },
)

function cardEmphasis(card: RevealedCard) {
  // Still sealed as ? on this panel — open drama is on ResultView
  if (card.openedFromRedraw) return 'special' as const
  if (card.isSelf) return 'self' as const
  if (
    card.kind === 'double' ||
    card.kind === 'max_to_zero' ||
    card.kind === 'half' ||
    card.kind === 'redraw' ||
    card.kind === 'zero_mix'
  ) {
    return 'special' as const
  }
  if (card.kind === 'number' && isExtremeNumber(card.value)) {
    return 'extreme' as const
  }
  return 'none' as const
}

/** Coyote panel keeps ? sealed; ResultView runs the open animation. */
function tileKind(card: RevealedCard) {
  return card.openedFromRedraw ? ('redraw' as const) : card.kind
}

function tileLabel(card: RevealedCard) {
  return card.openedFromRedraw ? '?' : card.label
}

function tileValue(card: RevealedCard) {
  return card.openedFromRedraw ? null : card.value
}

const emit = defineEmits<{
  skip: []
  openResult: []
}>()
</script>

<template>
  <div
    class="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-teal-deep/35 to-night-950/80"
    :class="
      variant === 'mobile'
        ? 'px-3 py-4 safe-bottom'
        : 'px-4 py-5 sm:py-6'
    "
  >
    <div
      class="mx-auto flex w-full flex-col items-center text-center"
      :class="
        variant === 'mobile'
          ? 'max-w-md gap-3'
          : 'max-w-2xl gap-3.5'
      "
    >
      <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-sand-dim">
        札を公開
      </p>

      <!-- Desktop: avatar + names; Mobile: text-only line (snapshot-identical) -->
      <div
        v-if="variant === 'desktop'"
        class="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm text-sand-dim"
      >
        <!-- div not p: PlayerAvatar is a block; p+div breaks the line in some browsers -->
        <span class="inline-flex items-center gap-1.5 font-medium text-sand">
          <PlayerAvatar
            :avatar="banner.challengerAvatar"
            :avatar-src="banner.challengerAvatarSrc"
            :name="banner.challengerName"
            size="sm"
            hide-name
          />
          {{ banner.challengerName }}
        </span>
        <span class="inline-flex items-baseline gap-1 whitespace-nowrap">
          <span aria-hidden="true">→</span>
          <span class="font-display font-bold text-gold-200">{{
            banner.bid
          }}</span>
          <span>（{{ banner.bidderName }}）</span>
        </span>
      </div>
      <p v-else class="text-xs leading-relaxed text-sand-dim">
        <span class="font-medium text-sand">{{ banner.challengerName }}</span>
        →
        <span class="font-display font-bold text-gold-200">{{ banner.bid }}</span>
        （{{ banner.bidderName }}）
      </p>

      <ul
        class="grid w-full"
        :class="
          variant === 'mobile'
            ? [
                'gap-2',
                revealCards.length <= 4 ? 'grid-cols-2' : 'grid-cols-3',
              ]
            : [
                'gap-2.5',
                revealCards.length <= 4
                  ? 'grid-cols-2 sm:grid-cols-4'
                  : 'grid-cols-3 sm:grid-cols-5',
              ]
        "
      >
        <li
          v-for="(card, i) in revealCards"
          :key="`${card.playerId}-${i}`"
          class="flex flex-col items-center rounded-xl border border-gold-400/10 bg-night-900/50"
          :class="[
            variant === 'mobile' ? 'px-1 py-2' : 'px-1.5 py-2.5',
            card.isSelf ? 'ring-2 ring-teal-soft/55 reveal-seat--self' : '',
            i < revealedCount ? '' : 'opacity-40',
          ]"
        >
          <PlayerAvatar
            class="mb-0.5"
            :avatar="card.avatar"
            :avatar-src="card.avatarSrc"
            :name="card.playerName"
            :self="card.isSelf"
            size="sm"
            hide-name
          />
          <div
            class="mb-1 max-w-full truncate text-[10px] font-medium"
            :class="card.isSelf ? 'text-teal-soft' : 'text-sand-dim'"
          >
            {{ card.isSelf ? 'あなたの札' : card.playerName }}
          </div>
          <RevealCardTile
            :kind="tileKind(card)"
            :label="tileLabel(card)"
            :value="tileValue(card)"
            size="md"
            :revealed="i < revealedCount"
            :emphasis="cardEmphasis(card)"
            :opened-from-redraw="card.openedFromRedraw === true"
            :face-open="false"
          />
        </li>
      </ul>

      <p class="text-[11px] tabular-nums text-sand-dim">
        {{ Math.min(revealedCount, revealCards.length) }} / {{ revealCards.length }}
      </p>

      <div
        class="flex w-full max-w-xs flex-col gap-2"
        :class="variant === 'desktop' ? 'pb-4' : ''"
      >
        <button
          v-if="!cardsRevealDone"
          type="button"
          class="btn-ghost w-full !py-2.5 text-sm"
          @click="emit('skip')"
        >
          全部ひらく
        </button>
        <button
          type="button"
          class="btn-gold w-full !py-3.5 text-base shadow-gold-glow"
          :class="!cardsRevealDone ? 'opacity-50' : ''"
          :disabled="!cardsRevealDone"
          @click="emit('openResult')"
        >
          結果を見る
        </button>
        <p
          v-if="variant === 'desktop' && !cardsRevealDone"
          class="text-[10px] text-sand-dim"
        >
          札が全部開いたら、合計と勝敗を見られます
        </p>
      </div>
    </div>
  </div>
</template>
