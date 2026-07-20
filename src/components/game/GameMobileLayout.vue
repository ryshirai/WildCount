<script setup lang="ts">
/**
 * Mobile game table layout (&lt; lg).
 * R4: compressed chrome, specials fold, mini dock while chat/log open.
 */
import type { GameRoomMock, RevealedCard } from '@/types/game'
import type { CoyoteBanner } from '@/composables/useChallengeReveal'
import type { ClientBidExtra, WireClockSnapshot } from '@/online/protocol'
import type { StampId } from '@/online/stamps'
import type { AvatarAssetId } from '@/localGame/avatarCatalog'
import type { ChatMessage } from '@/online/protocol'
import type { GameViewModel } from '@/mappers/toGameView'
import { computed } from 'vue'
import GameHeader from '@/components/game/GameHeader.vue'
import TurnClockDisplay from '@/components/game/TurnClockDisplay.vue'
import CurrentBidDisplay from '@/components/game/CurrentBidDisplay.vue'
import EventLog from '@/components/game/EventLog.vue'
import ChatPanel from '@/components/game/ChatPanel.vue'
import BidControls from '@/components/game/BidControls.vue'
import MobilePlayerCarousel from '@/components/game/MobilePlayerCarousel.vue'
import CoyoteRevealPanel from '@/components/game/CoyoteRevealPanel.vue'

const draftBid = defineModel<number>('draftBid', { required: true })
const mobileTab = defineModel<'chat' | 'log' | null>('mobileTab', {
  required: true,
})
const stampSheetOpen = defineModel<boolean>('stampSheetOpen', { required: true })

const props = defineProps<{
  room: GameRoomMock
  gameView: GameViewModel | null
  showOnlineDisconnect: boolean
  reconnecting: boolean
  reconnectAttempt: number
  lastError: string | null
  canAttemptResume: boolean
  paceHint: string | null
  turnClock: WireClockSnapshot | null
  awaitingResultView: boolean
  botsRunning: boolean
  coyoteBanner: CoyoteBanner | null
  revealCards: readonly RevealedCard[]
  revealedCount: number
  cardsRevealDone: boolean
  showForfeitEnd: boolean
  pendingLobbyReturn: boolean
  forfeitEndTitle: string
  forfeitEndDetail: string
  minBid: number
  forbiddenBidValue: number | null
  canDeclare: boolean
  canChallenge: boolean
  canSame: boolean
  canChange: boolean
  extrasAllowed: boolean
  bidTargetOptions: { id: string; name: string }[]
  isOnline: boolean
  chatMessages: ChatMessage[]
  selfPlayerId: string | null
  selfStampAvatarId: AvatarAssetId | null | undefined
  chatConnectionOpen: boolean
  avatarForPlayer: (playerId: string) => {
    avatar: string
    avatarSrc?: string
    avatarId?: AvatarAssetId
  }
}>()

const emit = defineEmits<{
  help: []
  deck: []
  leave: []
  reconnect: []
  skipReveal: []
  openResult: []
  goLobbyRematch: []
  playAgain: []
  declare: [value: number, extra?: ClientBidExtra]
  challenge: []
  same: []
  change: []
  sendChat: [text: string]
  reaction: [stampId: StampId]
  toggleChat: []
  toggleLog: []
  closeDrawer: []
  openStampSheet: []
}>()

const sheetOpen = computed(
  () => mobileTab.value === 'chat' || mobileTab.value === 'log',
)

const declaredCount = computed(
  () => props.room.players.filter((p) => p.hasDeclared).length,
)

const showDock = computed(
  () =>
    !props.awaitingResultView &&
    !props.showForfeitEnd &&
    !props.pendingLobbyReturn,
)
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-1 flex-col lg:hidden">
    <div
      v-if="showOnlineDisconnect"
      class="flex shrink-0 items-center justify-between gap-2 border-b border-red-400/25 bg-red-950/50 px-3 py-2 text-xs text-red-100 safe-top"
    >
      <span class="min-w-0 truncate">
        {{
          reconnecting
            ? `再接続中…（${reconnectAttempt}）`
            : lastError ?? '切断されました'
        }}
      </span>
      <button
        v-if="canAttemptResume"
        type="button"
        class="btn-ghost shrink-0 !px-2 !py-1 text-[10px]"
        :disabled="reconnecting"
        @click="emit('reconnect')"
      >
        再接続
      </button>
    </div>
    <GameHeader
      class="shrink-0"
      mobile
      :room-code="room.roomCode"
      :player-count="room.playerCount"
      :round="room.round"
      :connection-status="room.connectionStatus"
      :safe-top="!showOnlineDisconnect"
      @help="emit('help')"
      @deck="emit('deck')"
      @leave="emit('leave')"
    />

    <!-- Pace + clock + declared (merged; no separate meta strip) -->
    <div
      v-if="paceHint || (turnClock && !awaitingResultView) || !coyoteBanner"
      class="flex shrink-0 items-center justify-center gap-2 border-b px-3 py-1.5 text-center text-xs font-medium backdrop-blur-md"
      :class="[
        awaitingResultView
          ? 'border-teal-soft/35 bg-teal-deep/40 text-teal-soft'
          : botsRunning
            ? 'border-gold-400/30 bg-night-800/90 text-gold-200'
            : 'border-gold-400/20 bg-night-900/90 text-teal-soft',
        gameView?.isSelfTurn && !awaitingResultView && !botsRunning
          ? 'turn-arrive'
          : '',
      ]"
      role="status"
      aria-live="polite"
    >
      <span
        v-if="!coyoteBanner && !awaitingResultView"
        class="chip !px-1.5 !py-0.5 !text-[10px] font-normal text-sand-dim"
      >
        {{ declaredCount }}/{{ room.playerCount }} 宣言
      </span>
      <span v-if="paceHint" class="min-w-0 truncate">{{ paceHint }}</span>
      <TurnClockDisplay
        v-if="turnClock && !awaitingResultView"
        :clock="turnClock"
        :is-self-turn="!!gameView?.isSelfTurn"
        compact
      />
    </div>

    <!-- Card reveal under header -->
    <CoyoteRevealPanel
      v-if="coyoteBanner"
      variant="mobile"
      :banner="coyoteBanner"
      :reveal-cards="revealCards"
      :revealed-count="revealedCount"
      :cards-reveal-done="cardsRevealDone"
      @skip="emit('skipReveal')"
      @open-result="emit('openResult')"
    />

    <!-- Normal mobile play -->
    <template v-else>
      <!-- Play column: bid stays; chat/log slide up into free space -->
      <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="shrink-0">
          <MobilePlayerCarousel :players="room.players" />
        </div>

        <main
          class="flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-visible px-3"
          :class="
            sheetOpen ? 'justify-start pt-1.5 pb-1' : 'justify-center py-2'
          "
        >
          <div
            class="panel relative z-[6] w-full max-w-[13rem] overflow-visible px-4 py-3 shadow-panel transition-transform duration-300"
            :class="sheetOpen ? 'scale-90 opacity-90' : ''"
          >
            <CurrentBidDisplay
              compact
              :show-turns-hint="false"
              :current-bid="room.currentBid"
            />
          </div>
        </main>

        <div
          v-if="showForfeitEnd || pendingLobbyReturn"
          class="mx-3 mb-2 shrink-0 rounded-xl border border-gold-400/30 bg-night-900/90 px-3 py-3 text-center"
        >
          <template v-if="pendingLobbyReturn">
            <p class="font-display text-sm font-bold text-teal-soft">
              ルームがロビーに戻りました
            </p>
            <p class="mt-1 text-[11px] leading-relaxed text-sand-dim">
              誰かが「もう一度遊ぶ」を押しました。準備ができたらロビーへ。
            </p>
            <div class="mt-2.5 flex flex-col gap-2">
              <button
                type="button"
                class="btn-gold w-full !py-2.5 text-sm"
                @click="emit('goLobbyRematch')"
              >
                ロビーへ
              </button>
            </div>
          </template>
          <template v-else>
            <p class="font-display text-sm font-bold text-gold-100">
              {{ forfeitEndTitle }}
            </p>
            <p class="mt-1 text-[11px] leading-relaxed text-sand-dim">
              {{ forfeitEndDetail }}
            </p>
            <div class="mt-2.5 flex flex-col gap-2">
              <button
                type="button"
                class="btn-gold w-full !py-2.5 text-sm"
                @click="emit('playAgain')"
              >
                もう一度遊ぶ
              </button>
              <button
                type="button"
                class="btn-ghost w-full !py-2 text-sm"
                @click="emit('leave')"
              >
                退出
              </button>
            </div>
          </template>
        </div>

        <!-- Full bid dock when no sheet -->
        <div
          v-show="!sheetOpen && showDock"
          class="shrink-0"
        >
          <BidControls
            v-model="draftBid"
            mobile
            :min-bid="minBid"
            :forbidden-value="forbiddenBidValue"
            :can-declare="canDeclare"
            :can-challenge="canChallenge"
            :can-same="canSame"
            :can-change="canChange"
            :extras-allowed="extrasAllowed"
            :allow-reverse="gameView?.allowReverse"
            :allow-shot="gameView?.allowShot"
            :allow-draw1="gameView?.allowDraw1"
            :allow-life-double="gameView?.allowLifeDouble"
            :target-options="bidTargetOptions"
            @declare="(v, e) => emit('declare', v, e)"
            @challenge="emit('challenge')"
            @same="emit('same')"
            @change="emit('change')"
          />
        </div>

        <!-- Soft scrim (tap to close); mini dock still above nav -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <button
            v-if="sheetOpen"
            type="button"
            class="absolute inset-0 z-[15] bg-night-950/25"
            aria-label="閉じる"
            @click="emit('closeDrawer')"
          />
        </Transition>

        <!-- Chat: bottom sheet — shorter so mini dock + seats stay visible -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="translate-y-full"
          enter-to-class="translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="translate-y-0"
          leave-to-class="translate-y-full"
        >
          <div
            v-if="mobileTab === 'chat'"
            class="absolute inset-x-0 bottom-0 z-20 flex h-[min(45%,18rem)] max-h-[20rem] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gold-400/30 bg-night-900/98 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
            role="dialog"
            aria-label="チャット"
            @click.stop
          >
            <div
              class="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-2"
            >
              <div
                class="pointer-events-none absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-gold-400/35"
                aria-hidden="true"
              />
              <p class="pt-1 text-xs font-semibold text-gold-200">チャット</p>
              <button
                type="button"
                class="btn-ghost !px-2 !py-0.5 text-[11px]"
                @click="emit('closeDrawer')"
              >
                閉じる
              </button>
            </div>
            <ChatPanel
              class="min-h-0 flex-1 !rounded-none !border-0 !shadow-none"
              compact
              embedded
              hide-header
              hide-stamp-picker
              :messages="isOnline ? chatMessages : []"
              :self-player-id="selfPlayerId"
              :avatar-for-player="avatarForPlayer"
              :self-avatar-id="selfStampAvatarId"
              :disabled="!isOnline || !chatConnectionOpen"
              @send="(t) => emit('sendChat', t)"
              @reaction="(id) => emit('reaction', id)"
            />
          </div>
        </Transition>

        <!-- Log: same bottom-sheet pattern -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="translate-y-full"
          enter-to-class="translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="translate-y-0"
          leave-to-class="translate-y-full"
        >
          <div
            v-if="mobileTab === 'log'"
            class="absolute inset-x-0 bottom-0 z-20 flex h-[min(45%,18rem)] max-h-[20rem] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gold-400/30 bg-night-900/98 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
            role="dialog"
            aria-label="対戦ログ"
            @click.stop
          >
            <div
              class="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-2"
            >
              <div
                class="pointer-events-none absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-gold-400/35"
                aria-hidden="true"
              />
              <p class="pt-1 text-xs font-semibold text-gold-200">
                対戦ログ
              </p>
              <button
                type="button"
                class="btn-ghost !px-2 !py-0.5 text-[11px]"
                @click="emit('closeDrawer')"
              >
                閉じる
              </button>
            </div>
            <EventLog
              :items="room.eventLog"
              class="min-h-0 flex-1"
              compact
              embedded
              hide-header
            />
          </div>
        </Transition>
      </div>

      <!-- Mini declare bar while chat/log open (above bottom nav) -->
      <div
        v-if="sheetOpen && showDock"
        class="relative z-30 shrink-0"
      >
        <BidControls
          v-model="draftBid"
          mini
          :min-bid="minBid"
          :forbidden-value="forbiddenBidValue"
          :can-declare="canDeclare"
          :can-challenge="canChallenge"
          @declare="(v, e) => emit('declare', v, e)"
          @challenge="emit('challenge')"
        />
      </div>

      <nav
        class="relative z-30 flex shrink-0 border-t border-gold-400/15 bg-night-950/95 safe-bottom"
        aria-label="モバイルメニュー"
      >
        <button
          type="button"
          class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition"
          :class="stampSheetOpen ? 'text-gold-200' : 'text-sand-dim'"
          @click="emit('openStampSheet')"
        >
          <span class="text-base">😀</span>
          スタンプ
        </button>
        <button
          type="button"
          class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition"
          :class="mobileTab === 'chat' ? 'text-gold-200' : 'text-sand-dim'"
          @click="emit('toggleChat')"
        >
          <span class="text-base">💬</span>
          チャット
        </button>
        <button
          type="button"
          class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition"
          :class="mobileTab === 'log' ? 'text-gold-200' : 'text-sand-dim'"
          @click="emit('toggleLog')"
        >
          <span class="text-base">☰</span>
          ログ
        </button>
      </nav>
    </template>
  </div>
</template>
