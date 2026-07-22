<script setup lang="ts">
/**
 * Desktop / tablet game table layout (md+).
 * - md–lg (tablet): ellipse table, bottom nav for chat/log/stamps (no side rail)
 * - lg+: ellipse table + log/chat side rail
 * R3: extracted from GameView. R5: AppHeader shell, table felt, rail density.
 */
import { computed, ref, watch } from 'vue'
import type { GameRoomMock, RevealedCard } from '@/types/game'
import type { CoyoteBanner } from '@/composables/useChallengeReveal'
import type { ClientBidExtra, WireClockSnapshot } from '@/online/protocol'
import type { StampId } from '@/online/stamps'
import type { AvatarAssetId } from '@/localGame/avatarCatalog'
import type { ChatMessage } from '@/online/protocol'
import type { GameViewModel } from '@/mappers/toGameView'
import type { TableDramaState } from '@/composables/useGameSession'
import {
  useIsShortDesktop,
  useIsTabletWidth,
  useIsVeryShortDesktop,
  useShowSideRail,
} from '@/composables/useBreakpoint'
import GameHeader from '@/components/game/GameHeader.vue'
import TurnClockDisplay from '@/components/game/TurnClockDisplay.vue'
import PlayerCircle from '@/components/game/PlayerCircle.vue'
import CurrentBidDisplay from '@/components/game/CurrentBidDisplay.vue'
import EventLog from '@/components/game/EventLog.vue'
import ChatPanel from '@/components/game/ChatPanel.vue'
import BidControls from '@/components/game/BidControls.vue'
import CoyoteRevealPanel from '@/components/game/CoyoteRevealPanel.vue'

/** ≥1100px: permanent side rail. Below that: bottom-nav drawers. */
const showSideRailMq = useShowSideRail()
const isTabletWidth = useIsTabletWidth()
/** FHD / landscape tablet / short laptop: denser chrome. */
const isShortDesktop = useIsShortDesktop()
const isVeryShortDesktop = useIsVeryShortDesktop()

const draftBid = defineModel<number>('draftBid', { required: true })
const desktopSideTab = defineModel<'log' | 'chat'>('desktopSideTab', {
  required: true,
})

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
  waitingForResultPeers: boolean
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
  /** D1 table drama (HEAT / RALLY) */
  tableDrama?: TableDramaState | null
}>()

/**
 * Compact chrome: short height OR tablet width (ellipse without rail needs room).
 */
const isCompactChrome = computed(
  () => isShortDesktop.value || isTabletWidth.value,
)

const bidDensity = computed((): 'roomy' | 'compact' | 'tight' => {
  if (isVeryShortDesktop.value) return 'tight'
  if (isCompactChrome.value) return 'compact'
  return 'roomy'
})

/** Side rail only when width is comfortable for ellipse + rail. */
const showSideRail = computed(() => showSideRailMq.value)

/** Tablet / narrow desktop: bottom sheet for chat / log. */
const tabletDrawer = ref<'chat' | 'log' | null>(null)
const tabletSheetOpen = computed(() => tabletDrawer.value != null)

watch(showSideRailMq, (rail) => {
  if (rail) tabletDrawer.value = null
})

function toggleTabletDrawer(id: 'chat' | 'log') {
  tabletDrawer.value = tabletDrawer.value === id ? null : id
}

function closeTabletDrawer() {
  tabletDrawer.value = null
}

/**
 * Top strip progress only — not the center “あとN人” turn countdown.
 * Special phases + short self-turn cue; seat + bid area own turn detail.
 */
const topProgress = computed(() => {
  if (
    props.awaitingResultView ||
    props.botsRunning ||
    props.showForfeitEnd ||
    props.pendingLobbyReturn ||
    props.waitingForResultPeers ||
    props.coyoteBanner
  ) {
    return props.paceHint
  }
  if (props.gameView?.isSelfTurn) return 'あなたの手番'
  // Steady opponent turn is shown on seats / center bid — avoid duplicate line
  return null
})

const showBidDock = computed(
  () =>
    !props.awaitingResultView &&
    !props.waitingForResultPeers &&
    !props.showForfeitEnd &&
    !props.pendingLobbyReturn,
)

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
  openStampSheet: []
}>()
</script>

<template>
  <!-- Mounted only at md+ by GameView; always flex when present. -->
  <div class="flex h-full min-h-0 flex-1 flex-col">
    <div
      v-if="showOnlineDisconnect"
      class="flex shrink-0 items-center justify-between gap-2 border-b border-red-400/25 bg-red-950/50 px-4 py-2 text-sm text-red-100 safe-top"
      :class="isCompactChrome ? 'px-3 py-1.5 text-xs' : ''"
    >
      <span>
        {{
          reconnecting
            ? `再接続中…（試行 ${reconnectAttempt}）`
            : lastError ?? '接続が切れました'
        }}
      </span>
      <button
        v-if="canAttemptResume"
        type="button"
        class="btn-ghost shrink-0 text-xs"
        :disabled="reconnecting"
        @click="emit('reconnect')"
      >
        再接続
      </button>
    </div>
    <GameHeader
      class="shrink-0"
      :safe-top="!showOnlineDisconnect"
      :mobile="isCompactChrome"
      @help="emit('help')"
      @deck="emit('deck')"
      @leave="emit('leave')"
    />

    <!-- Meta strip: round · deck · progress (turn detail lives on board) -->
    <div
      v-if="!coyoteBanner"
      class="flex shrink-0 flex-wrap items-center justify-center border-b border-gold-400/12 bg-night-900/80 text-center"
      :class="[
        isCompactChrome
          ? 'gap-x-2 gap-y-0.5 px-2 py-1'
          : 'gap-x-3 gap-y-1 px-3 py-2',
        awaitingResultView
          ? 'border-teal-soft/25 bg-teal-deep/25'
          : botsRunning
            ? 'border-gold-400/20'
            : gameView?.isSelfTurn
              ? 'border-gold-400/30 bg-gold-400/8'
              : '',
        gameView?.isSelfTurn && !awaitingResultView && !botsRunning
          ? 'turn-arrive'
          : '',
      ]"
      role="status"
      aria-live="polite"
    >
      <span
        class="shrink-0 rounded-full border border-gold-400/25 bg-night-950/45 font-semibold tabular-nums text-gold-100"
        :class="isCompactChrome ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'"
      >
        第{{ room.round }}ラウンド
      </span>
      <button
        type="button"
        class="shrink-0 rounded-full border border-gold-400/20 bg-night-950/40 font-medium tabular-nums text-sand transition hover:border-gold-400/40 hover:text-gold-100"
        :class="isCompactChrome ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'"
        :aria-label="`山札 残り${room.deckRemaining}枚。内容を見る`"
        @click="emit('deck')"
      >
        山札
        <span class="font-semibold text-gold-100">{{ room.deckRemaining }}</span>
        <span class="text-sand-dim">枚</span>
      </button>
      <template v-if="topProgress">
        <span
          class="hidden h-3 w-px shrink-0 bg-gold-400/25 sm:block"
          aria-hidden="true"
        />
        <span
          class="inline-flex min-w-0 max-w-[min(100%,20rem)] items-center gap-2 truncate font-semibold"
          :class="[
            isCompactChrome ? 'text-xs' : 'text-sm',
            awaitingResultView
              ? 'text-teal-soft'
              : botsRunning || gameView?.isSelfTurn
                ? 'text-gold-50'
                : 'text-sand',
          ]"
        >
          <span
            v-if="botsRunning || gameView?.isSelfTurn"
            class="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-gold-300"
            aria-hidden="true"
          />
          <span
            v-else-if="awaitingResultView"
            class="inline-flex h-2 w-2 shrink-0 rounded-full bg-teal-soft"
            aria-hidden="true"
          />
          {{ topProgress }}
        </span>
      </template>
    </div>

    <!-- Card reveal (main body under header) -->
    <CoyoteRevealPanel
      v-if="coyoteBanner"
      variant="desktop"
      :banner="coyoteBanner"
      :reveal-cards="revealCards"
      :revealed-count="revealedCount"
      :cards-reveal-done="cardsRevealDone"
      @skip="emit('skipReveal')"
      @open-result="emit('openResult')"
    />

    <!-- Normal play area -->
    <div v-else class="relative flex min-h-0 flex-1">
      <main class="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          class="relative flex min-h-0 flex-1 items-center justify-center px-0.5 py-0 sm:px-1"
        >
          <!-- Table felt: primary stage under seats / bid -->
          <div
            class="game-table-felt pointer-events-none absolute z-0"
            :class="
              tableDrama && tableDrama.heat !== 'none'
                ? `game-table-felt--heat-${tableDrama.heat}`
                : ''
            "
            aria-hidden="true"
          />

          <div
            class="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center"
          >
            <TurnClockDisplay
              v-if="turnClock && !awaitingResultView"
              :clock="turnClock"
              :is-self-turn="!!gameView?.isSelfTurn"
              :prominent="!isVeryShortDesktop"
              class="mb-1"
            />
            <CurrentBidDisplay
              :current-bid="room.currentBid"
              :turns-until-self="room.turnsUntilSelf"
              :bid-count="tableDrama?.bidCount ?? 0"
              :heat="tableDrama?.heat ?? 'none'"
              :show-turns-hint="!gameView?.isSelfTurn"
              :compact="isCompactChrome"
            />
          </div>

          <PlayerCircle
            :players="room.players"
            :last-bidder-id="tableDrama?.lastBidderId"
            :current-turn-player-id="tableDrama?.currentTurnPlayerId"
            :trail-key="tableDrama?.bidCount"
            class="relative z-10 h-full w-full"
          />

          <!-- Tablet: soft scrim while drawer open -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <button
              v-if="!showSideRail && tabletSheetOpen"
              type="button"
              class="absolute inset-0 z-[15] bg-night-950/25"
              aria-label="閉じる"
              @click="closeTabletDrawer"
            />
          </Transition>

          <!-- Tablet chat sheet -->
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="translate-y-full"
            enter-to-class="translate-y-0"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="translate-y-0"
            leave-to-class="translate-y-full"
          >
            <div
              v-if="!showSideRail && tabletDrawer === 'chat'"
              class="absolute inset-x-0 bottom-0 z-20 flex h-[min(42%,20rem)] max-h-[22rem] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gold-400/30 bg-night-900/98 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
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
                  @click="closeTabletDrawer"
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

          <!-- Tablet log sheet -->
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="translate-y-full"
            enter-to-class="translate-y-0"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="translate-y-0"
            leave-to-class="translate-y-full"
          >
            <div
              v-if="!showSideRail && tabletDrawer === 'log'"
              class="absolute inset-x-0 bottom-0 z-20 flex h-[min(42%,20rem)] max-h-[22rem] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gold-400/30 bg-night-900/98 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
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
                <p class="pt-1 text-xs font-semibold text-gold-200">対戦ログ</p>
                <button
                  type="button"
                  class="btn-ghost !px-2 !py-0.5 text-[11px]"
                  @click="closeTabletDrawer"
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

        <div
          v-if="showForfeitEnd || pendingLobbyReturn"
          class="mx-4 mb-2 shrink-0 rounded-xl border border-gold-400/30 bg-night-900/90 px-4 py-3 text-center"
        >
          <template v-if="pendingLobbyReturn">
            <p class="font-display text-base font-bold text-teal-soft">
              ルームがロビーに戻りました
            </p>
            <p class="mt-1 text-xs leading-relaxed text-sand-dim">
              誰かが「もう一度遊ぶ」を押しました。準備ができたらロビーへどうぞ。
            </p>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                class="btn-gold sm:min-w-[10rem]"
                @click="emit('goLobbyRematch')"
              >
                ロビーへ
              </button>
            </div>
          </template>
          <template v-else>
            <p class="font-display text-base font-bold text-gold-100">
              {{ forfeitEndTitle }}
            </p>
            <p class="mt-1 text-xs leading-relaxed text-sand-dim">
              {{ forfeitEndDetail }}
            </p>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                class="btn-gold sm:min-w-[10rem]"
                @click="emit('playAgain')"
              >
                もう一度遊ぶ
              </button>
              <button
                type="button"
                class="btn-ghost sm:min-w-[8rem]"
                @click="emit('leave')"
              >
                退出
              </button>
            </div>
          </template>
        </div>
        <div
          v-else-if="waitingForResultPeers"
          class="mx-4 mb-2 shrink-0 rounded-xl border border-teal-soft/30 bg-night-900/90 px-4 py-3 text-center text-sm text-teal-soft"
        >
          みんなの結果確認が終わるまで、次のラウンドは始まりません
        </div>

        <!-- Full bid dock (hidden while tablet drawer open — mini bar below) -->
        <div
          v-show="showSideRail || !tabletSheetOpen"
          class="flex shrink-0 flex-col"
          :class="showSideRail ? 'safe-bottom' : ''"
        >
          <BidControls
            v-if="showBidDock"
            v-model="draftBid"
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
            :density="bidDensity"
            @declare="(v, e) => emit('declare', v, e)"
            @challenge="emit('challenge')"
            @same="emit('same')"
            @change="emit('change')"
          />
        </div>

        <!-- Tablet: mini declare while chat/log open -->
        <div
          v-if="!showSideRail && tabletSheetOpen && showBidDock"
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

        <!-- Tablet bottom nav (stamp / chat / log) -->
        <nav
          v-if="!showSideRail"
          class="relative z-30 flex shrink-0 border-t border-gold-400/15 bg-night-950/95 safe-bottom"
          aria-label="タブレットメニュー"
        >
          <button
            type="button"
            class="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition"
            :class="'text-sand-dim active:text-gold-200'"
            @click="emit('openStampSheet')"
          >
            <span class="text-lg leading-none" aria-hidden="true">😀</span>
            スタンプ
          </button>
          <button
            type="button"
            class="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition"
            :class="
              tabletDrawer === 'chat' ? 'text-gold-200' : 'text-sand-dim'
            "
            @click="toggleTabletDrawer('chat')"
          >
            <span class="text-lg leading-none" aria-hidden="true">💬</span>
            チャット
          </button>
          <button
            type="button"
            class="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition"
            :class="
              tabletDrawer === 'log' ? 'text-gold-200' : 'text-sand-dim'
            "
            @click="toggleTabletDrawer('log')"
          >
            <span class="text-lg leading-none" aria-hidden="true">☰</span>
            ログ
          </button>
        </nav>
      </main>

      <!-- Side rail: desktop width only -->
      <aside
        v-if="showSideRail"
        class="flex min-h-0 shrink-0 flex-col border-l border-white/5 bg-night-950/10"
        :class="
          isShortDesktop
            ? 'w-52 p-1 xl:w-56'
            : 'w-60 p-1.5 xl:w-64 xl:p-2'
        "
      >
        <div
          class="mb-1.5 flex shrink-0 gap-0.5 rounded-lg bg-transparent p-0.5"
          role="tablist"
          aria-label="サイドパネル"
        >
          <button
            type="button"
            role="tab"
            class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition"
            :class="
              desktopSideTab === 'log'
                ? 'bg-night-800/70 text-sand'
                : 'text-sand-dim/80 hover:bg-night-900/40 hover:text-sand-dim'
            "
            :aria-selected="desktopSideTab === 'log'"
            @click="desktopSideTab = 'log'"
          >
            ログ
          </button>
          <button
            type="button"
            role="tab"
            class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition"
            :class="
              desktopSideTab === 'chat'
                ? 'bg-night-800/70 text-sand'
                : 'text-sand-dim/80 hover:bg-night-900/40 hover:text-sand-dim'
            "
            :aria-selected="desktopSideTab === 'chat'"
            @click="desktopSideTab = 'chat'"
          >
            チャット
          </button>
        </div>
        <EventLog
          v-if="desktopSideTab === 'log'"
          :items="room.eventLog"
          class="min-h-0 flex-1"
        />
        <ChatPanel
          v-else
          class="min-h-0 flex-1"
          compact
          :messages="isOnline ? chatMessages : []"
          :self-player-id="selfPlayerId"
          :avatar-for-player="avatarForPlayer"
          :self-avatar-id="selfStampAvatarId"
          :disabled="!isOnline || !chatConnectionOpen"
          @send="(t) => emit('sendChat', t)"
          @reaction="(id) => emit('reaction', id)"
        />
      </aside>
    </div>
  </div>
</template>
