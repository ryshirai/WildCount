<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { mockGameRoom } from '@/data/mockGame'
import { mockResult } from '@/data/mockResult'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'
import GameHeader from '@/components/game/GameHeader.vue'
import PlayerCircle from '@/components/game/PlayerCircle.vue'
import CurrentBidDisplay from '@/components/game/CurrentBidDisplay.vue'
import EventLog from '@/components/game/EventLog.vue'
import ChatPanel from '@/components/game/ChatPanel.vue'
import ReactionOverlay from '@/components/game/ReactionOverlay.vue'
import StampPickerSheet from '@/components/game/StampPickerSheet.vue'
import BidControls from '@/components/game/BidControls.vue'
import type { StampId } from '@/online/stamps'
import MobilePlayerCarousel from '@/components/game/MobilePlayerCarousel.vue'
import CoyoteCutIn from '@/components/game/CoyoteCutIn.vue'
import RevealCardTile from '@/components/game/RevealCardTile.vue'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'
import HelpModal from '@/components/common/HelpModal.vue'
import DeckInfoModal from '@/components/game/DeckInfoModal.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import { allowLocalPlay, allowUiMock } from '@/config/runtime'
import { STANDARD_DECK, type DeckComposition } from '@/domain/game'
import { AVATAR_ASSETS, avatarSrc } from '@/localGame/avatarCatalog'
import type { WireDeckComposition } from '@/online/protocol'
import type { GameRoomMock, RevealedCard } from '@/types/game'

const router = useRouter()
const route = useRoute()
const store = useLocalGameStore()
const onlineGame = useOnlineGameStore()
const {
  gameView: localGameView,
  pendingResult: localPendingResult,
  hasSession,
  botsRunning: localBotsRunning,
  statusMessage: localStatusMessage,
  awaitingResultView: localAwaitingResult,
} = storeToRefs(store)

/** Fixed mock only in DEV builds */
const useMock = computed(() => allowUiMock && route.query.mock === '1')
/** Online multiplayer session (Worker / DO). */
const isOnline = computed(
  () =>
    onlineGame.isOnlineSession ||
    route.query.online === '1' ||
    onlineGame.view != null,
)

const gameView = computed(() =>
  isOnline.value ? onlineGame.gameView : localGameView.value,
)
const pendingResult = computed(() =>
  isOnline.value ? onlineGame.pendingResult : localPendingResult.value,
)
const awaitingResultView = computed(() =>
  isOnline.value ? onlineGame.awaitingResultView : localAwaitingResult.value,
)
const botsRunning = computed(() =>
  isOnline.value ? false : localBotsRunning.value,
)
const statusMessage = computed(() => {
  if (isOnline.value) {
    // lastEvent is short-lived (auto-cleared in store); prefer turn / connection otherwise
    if (onlineGame.lastEvent) return onlineGame.lastEvent
    if (onlineGame.gameView?.isSelfTurn) return 'あなたの手番です'
    if (onlineGame.connection === 'closed' || onlineGame.connection === 'error') {
      return onlineGame.lastError ?? '接続が不安定です'
    }
    return null
  }
  return localStatusMessage.value
})

const toast = ref<string | null>(null)
const helpOpen = ref(false)
const deckInfoOpen = ref(false)
/** Mobile overlay: null = play table (no drawer) */
const mobileTab = ref<'chat' | 'log' | null>(null)
/** Mobile quick stamp sheet (no full chat) */
const stampSheetOpen = ref(false)
/** Desktop right rail: event log or chat */
const desktopSideTab = ref<'log' | 'chat'>('log')
const draftBid = ref(0)
const acting = ref(false)

function openHelp() {
  helpOpen.value = true
}

function openDeckInfo() {
  deckInfoOpen.value = true
}

/** Room recipe deck (totals only — not remaining draw pile). */
const roomDeck = computed((): WireDeckComposition | DeckComposition => {
  if (isOnline.value && onlineGame.view?.deck) {
    return onlineGame.view.deck
  }
  const local = store.state?.config.deck
  if (local) return local
  return STANDARD_DECK
})

function onHeaderChat() {
  desktopSideTab.value = 'chat'
  stampSheetOpen.value = false
  mobileTab.value = mobileTab.value === 'chat' ? null : 'chat'
}

function toggleMobileChat() {
  stampSheetOpen.value = false
  mobileTab.value = mobileTab.value === 'chat' ? null : 'chat'
}

function toggleMobileLog() {
  stampSheetOpen.value = false
  mobileTab.value = mobileTab.value === 'log' ? null : 'log'
}

function closeMobileDrawer() {
  mobileTab.value = null
}

function onSendChat(text: string) {
  if (!isOnline.value) {
    showToast('オンライン対戦でのみ利用できます')
    return
  }
  onlineGame.sendChat(text)
}

function onSendReaction(stampId: StampId) {
  if (!isOnline.value) {
    showToast('オンライン対戦でのみ利用できます')
    return
  }
  onlineGame.sendReaction(stampId)
  stampSheetOpen.value = false
}

function openStampSheet() {
  if (!isOnline.value) {
    showToast('オンライン対戦でのみ利用できます')
    return
  }
  // Prefer stamps over full-screen chat on small screens
  mobileTab.value = null
  stampSheetOpen.value = true
}

function chatAvatarForPlayer(playerId: string) {
  const fromGame = room.value?.players.find((p) => p.id === playerId)
  if (fromGame) {
    return { avatar: fromGame.avatar, avatarSrc: fromGame.avatarSrc }
  }
  const fromView = onlineGame.view?.players.find((p) => p.id === playerId)
  if (fromView) {
    const i = (fromView.avatarIndex ?? 0) % AVATAR_ASSETS.length
    const meta = AVATAR_ASSETS[i]!
    return { avatar: meta.emoji, avatarSrc: avatarSrc(meta.id) }
  }
  return { avatar: '👤' }
}

/**
 * Post-challenge beat:
 * cut-in → card reveal on game → “結果を見る” → ResultView (calc / verdict)
 */
const cutInVisible = ref(false)
const cutInPlayed = ref(false)
/** How many challenge cards have flipped open on the game screen */
const revealedCount = ref(0)
const cardsRevealDone = ref(false)

const CARD_STAGGER_MS = 100
const CARD_START_MS = 120
let cardTimers: ReturnType<typeof setTimeout>[] = []

/** Mock-only cut-in + optional card preview */
const mockCutIn = ref<{
  challengerName: string
  challengerAvatar: string
  challengerAvatarSrc?: string
  bidderName: string
  bidValue: number
} | null>(null)
const mockRevealCards = ref<RevealedCard[] | null>(null)

const cutInPayload = computed(() => {
  if (mockCutIn.value) return mockCutIn.value
  const r = pendingResult.value
  if (!r || !cutInVisible.value) return null
  return {
    challengerName: r.challengerName,
    challengerAvatar: r.challengerAvatar,
    challengerAvatarSrc: r.challengerAvatarSrc,
    bidderName: r.bidderName,
    bidValue: r.bidValue,
  }
})

const room = computed<GameRoomMock | null>(() => {
  if (useMock.value) return mockGameRoom
  return gameView.value
})

const busy = computed(
  () => !useMock.value && (botsRunning.value || acting.value || awaitingResultView.value),
)

const canDeclare = computed(() => {
  if (useMock.value) return true
  if (busy.value || isGameOver.value) return false
  return gameView.value?.canDeclare ?? false
})

const canChallenge = computed(() => {
  if (useMock.value) return true
  if (busy.value || isGameOver.value) return false
  return gameView.value?.canChallenge ?? false
})

const minBid = computed(() => {
  if (useMock.value) return mockGameRoom.draftBid
  return gameView.value?.minBid ?? 1
})

const isGameOver = computed(() => {
  if (useMock.value) return false
  if (isOnline.value) return onlineGame.isGameOver
  return gameView.value?.isGameOver ?? false
})

/**
 * Game ended without a challenge result (leave / disconnect forfeit / sole survivor).
 * Not the coyote card-reveal path — no ResultView.
 */
const showForfeitEnd = computed(
  () => isGameOver.value && !awaitingResultView.value,
)

const forfeitWinner = computed(() => {
  const id = gameView.value?.winnerId
  if (!id || !room.value) return null
  const p = room.value.players.find((x) => x.id === id)
  if (!p) return null
  return { id: p.id, name: p.name, isSelf: p.isSelf }
})

const forfeitEndTitle = computed(() => {
  const w = forfeitWinner.value
  if (w?.isSelf) return 'あなたの勝利'
  if (w) return `${w.name} の勝利`
  return 'ゲーム終了'
})

const forfeitEndDetail = computed(() => {
  const w = forfeitWinner.value
  if (w?.isSelf) {
    return '他のプレイヤーの退出・切断により、生き残りました'
  }
  if (w) {
    return '退出・切断により対戦が終了しました（コヨーテ結果画面はありません）'
  }
  return '退出・切断により対戦が終了しました'
})

const waitingForResultPeers = computed(() => {
  if (useMock.value || awaitingResultView.value) return false
  // After dismiss: engine stays at round_end until all connected peers close result
  return gameView.value?.phase === 'round_end'
})

const paceHint = computed(() => {
  if (useMock.value) return null
  if (showForfeitEnd.value) {
    return forfeitEndTitle.value
  }
  if (awaitingResultView.value) {
    if (cutInVisible.value) return statusMessage.value ?? 'コヨーテ！'
    if (!cardsRevealDone.value) return 'カードを公開しています…'
    return '合計と勝敗を確認しましょう'
  }
  if (waitingForResultPeers.value) {
    return '他のプレイヤーが結果を確認するまでお待ちください'
  }
  if (statusMessage.value) return statusMessage.value
  if (botsRunning.value) return 'ボット進行中…'
  if (gameView.value?.isSelfTurn) return 'あなたの手番です'
  if (isOnline.value && gameView.value) {
    const n = gameView.value.turnsUntilSelf
    if (n > 0) return `あなたまであと ${n} 人`
  }
  return null
})

/** Cards to flip on the game screen (live challenge or mock preview) */
const revealCards = computed<RevealedCard[]>(() => {
  if (mockRevealCards.value) return mockRevealCards.value
  return pendingResult.value?.cards ?? []
})

const coyoteBanner = computed(() => {
  // Live challenge after cut-in, or mock card-reveal preview
  if (cutInVisible.value) return null
  if (mockRevealCards.value) {
    const m = mockResult
    return {
      challengerName: m.challengerName,
      challengerAvatar: m.challengerAvatar,
      challengerAvatarSrc: m.challengerAvatarSrc,
      bidderName: m.bidderName,
      bidderAvatar: m.bidderAvatar,
      bidderAvatarSrc: m.bidderAvatarSrc,
      bid: m.bidValue,
      isMock: true as const,
    }
  }
  if (useMock.value || !pendingResult.value) return null
  const r = pendingResult.value
  return {
    challengerName: r.challengerName,
    challengerAvatar: r.challengerAvatar,
    challengerAvatarSrc: r.challengerAvatarSrc,
    bidderName: r.bidderName,
    bidderAvatar: r.bidderAvatar,
    bidderAvatarSrc: r.bidderAvatarSrc,
    bid: r.bidValue,
    isMock: false as const,
  }
})
function clearCardTimers() {
  for (const t of cardTimers) clearTimeout(t)
  cardTimers = []
}

function startCardReveal(cards: readonly RevealedCard[]) {
  clearCardTimers()
  revealedCount.value = 0
  cardsRevealDone.value = false
  const n = cards.length
  if (n === 0) {
    cardsRevealDone.value = true
    return
  }
  for (let i = 0; i < n; i++) {
    const t = setTimeout(() => {
      revealedCount.value = i + 1
      if (i + 1 >= n) cardsRevealDone.value = true
    }, CARD_START_MS + i * CARD_STAGGER_MS)
    cardTimers.push(t)
  }
}

function skipCardReveal() {
  clearCardTimers()
  revealedCount.value = revealCards.value.length
  cardsRevealDone.value = true
}

function resetPostChallengeUi() {
  clearCardTimers()
  cutInVisible.value = false
  cutInPlayed.value = false
  revealedCount.value = 0
  cardsRevealDone.value = false
  mockRevealCards.value = null
  mockCutIn.value = null
}

/** Fire cut-in only for a new challenge identity (not peer view broadcasts) */
watch(
  () => {
    const r = pendingResult.value
    if (!r) return null
    return `${r.round}:${r.bidValue}:${r.challengerName}:${r.finalTotal}`
  },
  (key, prevKey) => {
    if (key && key !== prevKey) {
      cutInVisible.value = true
      cutInPlayed.value = true
      revealedCount.value = 0
      cardsRevealDone.value = false
    }
    if (!key) {
      resetPostChallengeUi()
    }
  },
  { immediate: true },
)

function onCutInDone() {
  cutInVisible.value = false
  mockCutIn.value = null
  // After impact: flip cards on the game table, then offer “結果を見る”
  if (pendingResult.value) {
    startCardReveal(pendingResult.value.cards)
  } else if (mockRevealCards.value) {
    startCardReveal(mockRevealCards.value)
  }
}

watch(
  minBid,
  (v) => {
    if (draftBid.value < v) draftBid.value = v
  },
  { immediate: true },
)

watch(
  () => gameView.value?.draftBid,
  (v) => {
    if (v != null && !useMock.value) draftBid.value = v
  },
)

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = null
  }, 2200)
}

function openResult() {
  if (!cardsRevealDone.value) skipCardReveal()
  if (coyoteBanner.value?.isMock) {
    void router.push({ name: 'result', query: { mock: '1' } })
    return
  }
  const code = onlineGame.roomCode
  void router.push({
    name: 'result',
    query: isOnline.value
      ? { online: '1', ...(code ? { code } : {}) }
      : undefined,
  })
}

onMounted(() => {
  void bootstrap()
})

onUnmounted(() => {
  clearCardTimers()
})

async function bootstrap() {
  // Production: reject UI mock query
  if (!allowUiMock && route.query.mock === '1') {
    void router.replace({ name: 'home' })
    return
  }
  if (useMock.value) {
    draftBid.value = mockGameRoom.draftBid
    return
  }
  // Online: server is source of truth — do not start local bots
  if (isOnline.value || route.query.online === '1') {
    const qCode =
      typeof route.query.code === 'string' ? route.query.code : undefined
    if (onlineGame.connection !== 'open' || !onlineGame.view) {
      await onlineGame.ensureSession({ code: qCode })
    }
    // Mid-game reload while still in lobby phase → send to lobby
    if (
      onlineGame.view &&
      onlineGame.view.phase === 'lobby' &&
      onlineGame.view.status === 'open'
    ) {
      const code = onlineGame.roomCode ?? qCode
      void router.replace({
        name: 'lobby',
        query: { online: '1', ...(code ? { code } : {}) },
      })
      return
    }
    if (gameView.value) draftBid.value = gameView.value.draftBid
    return
  }
  // Production: no offline / local game surface
  if (!allowLocalPlay) {
    void router.replace({ name: 'home' })
    return
  }
  // Challenge already pending — stay here for cut-in / card reveal
  if (pendingResult.value) {
    if (gameView.value) draftBid.value = gameView.value.draftBid
    return
  }
  if (!hasSession.value) {
    await store.startLocalGame()
  } else {
    await store.resumeAfterResult()
  }
  if (gameView.value) {
    draftBid.value = gameView.value.draftBid
  }
}

watch(
  () => onlineGame.lastError,
  (msg) => {
    if (msg && isOnline.value) showToast(msg)
  },
)

// Rematch resets status to open → all clients return to lobby
watch(
  () => onlineGame.view?.status,
  (status) => {
    if (!isOnline.value) return
    if (status === 'open') {
      const code = onlineGame.roomCode
      void router.replace({
        name: 'lobby',
        query: { online: '1', ...(code ? { code } : {}) },
      })
    }
  },
)

async function manualReconnect() {
  try {
    await onlineGame.reconnect()
    showToast('再接続しました')
    if (gameView.value) draftBid.value = gameView.value.draftBid
  } catch (e) {
    showToast(e instanceof Error ? e.message : '再接続に失敗しました')
  }
}

/** Confirm before ending the session (forfeit online / drop local / host dissolve). */
const leaveConfirmOpen = ref(false)

const canHostEndRoom = computed(
  () => isOnline.value && onlineGame.isHost,
)

function requestLeaveGame() {
  leaveConfirmOpen.value = true
}

function cancelLeaveGame() {
  leaveConfirmOpen.value = false
}

function confirmLeaveGame() {
  leaveConfirmOpen.value = false
  if (isOnline.value) {
    onlineGame.leave()
  } else if (!useMock.value) {
    store.resetSession()
  }
  void router.push({ name: 'home' })
}

/** Host: dissolve room for everyone (server room_closed → all clients home). */
function confirmEndRoom() {
  leaveConfirmOpen.value = false
  if (!isOnline.value || !onlineGame.isHost) return
  onlineGame.endRoom()
  void router.push({ name: 'home' })
}

/** After forfeit / disconnect win — rematch (online) or local restart. */
async function playAgainFromForfeit() {
  if (useMock.value) return
  if (isOnline.value) {
    onlineGame.requestRematch()
    return
  }
  await store.restartLastGame()
  draftBid.value = gameView.value?.draftBid ?? minBid.value
}

// Online rematch from forfeit end → lobby
watch(
  () => onlineGame.view?.status,
  (status) => {
    if (!isOnline.value) return
    if (status === 'open' && showForfeitEnd.value) {
      const code = onlineGame.roomCode
      void router.replace({
        name: 'lobby',
        query: { online: '1', ...(code ? { code } : {}) },
      })
    }
  },
)

// Server dissolved room (host end / idle purge) while still on game screen
watch(
  () => onlineGame.lastErrorCode,
  (code) => {
    if (code === 'ROOM_CLOSED') {
      leaveConfirmOpen.value = false
      void router.replace({ name: 'home' })
    }
  },
)

const showOnlineDisconnect = computed(
  () =>
    isOnline.value &&
    !onlineGame.isRoomClosed &&
    (onlineGame.connection === 'closed' ||
      onlineGame.connection === 'error' ||
      onlineGame.reconnecting),
)

async function onDeclare(value: number) {
  if (useMock.value) {
    showToast(`（モック）宣言: ${value}`)
    return
  }
  if (isGameOver.value) {
    showToast('ゲームは終了しています')
    return
  }
  if (busy.value) return
  acting.value = true
  try {
    if (isOnline.value) {
      onlineGame.placeBid(value)
    } else {
      await store.placeBid(value)
      if (gameView.value) draftBid.value = gameView.value.draftBid
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : '宣言に失敗しました')
  } finally {
    acting.value = false
  }
}

async function onChallenge() {
  if (useMock.value) {
    // Preview: cut-in → card flip → 結果を見る
    mockRevealCards.value = mockResult.cards
    revealedCount.value = 0
    cardsRevealDone.value = false
    mockCutIn.value = {
      challengerName: mockResult.challengerName,
      challengerAvatar: mockResult.challengerAvatar,
      challengerAvatarSrc: mockResult.challengerAvatarSrc,
      bidderName: mockResult.bidderName,
      bidValue: mockResult.bidValue,
    }
    return
  }
  if (isGameOver.value) {
    showToast('ゲームは終了しています')
    return
  }
  if (busy.value) return
  acting.value = true
  try {
    if (isOnline.value) {
      onlineGame.challenge()
    } else {
      await store.challenge()
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'チャレンジに失敗しました')
  } finally {
    acting.value = false
  }
}
</script>

<template>
  <div class="page-fixed desert-bg safe-x">
    <!-- Online: waiting for first view snapshot -->
    <div
      v-if="isOnline && !room"
      class="relative z-10 mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center gap-4 px-4 safe-top safe-bottom"
    >
      <p class="text-sm text-sand-dim">
        {{
          onlineGame.reconnecting || onlineGame.connection === 'connecting'
            ? 'ルームに再接続中…'
            : 'ゲーム状態を同期中…'
        }}
      </p>
      <p v-if="onlineGame.lastError" class="text-center text-xs text-red-200">
        {{ onlineGame.lastError }}
      </p>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <button
          v-if="onlineGame.connection !== 'open' && onlineGame.canAttemptResume"
          type="button"
          class="btn-teal text-sm"
          :disabled="onlineGame.reconnecting"
          @click="manualReconnect"
        >
          再接続
        </button>
        <button type="button" class="btn-ghost" @click="requestLeaveGame">
          {{ onlineGame.isRoomClosed ? 'ホームへ' : '退出' }}
        </button>
      </div>
      <MockBadge />
    </div>

    <template v-else-if="room">
      <!-- ========== Desktop / tablet ========== -->
      <div class="hidden h-full min-h-0 flex-1 flex-col lg:flex">
        <div
          v-if="showOnlineDisconnect"
          class="flex shrink-0 items-center justify-between gap-2 border-b border-red-400/25 bg-red-950/50 px-4 py-2 text-sm text-red-100 safe-top"
        >
          <span>
            {{
              onlineGame.reconnecting
                ? `再接続中…（試行 ${onlineGame.reconnectAttempt}）`
                : onlineGame.lastError ?? '接続が切断されました'
            }}
          </span>
          <button
            v-if="onlineGame.canAttemptResume"
            type="button"
            class="btn-ghost shrink-0 text-xs"
            :disabled="onlineGame.reconnecting"
            @click="manualReconnect"
          >
            再接続
          </button>
        </div>
        <div class="shrink-0" :class="showOnlineDisconnect ? '' : 'safe-top'">
          <GameHeader
            :room-code="room.roomCode"
            :player-count="room.playerCount"
            :round="room.round"
            @help="openHelp"
            @deck="openDeckInfo"
            @chat="onHeaderChat"
            @stamp="openStampSheet"
            @leave="requestLeaveGame"
          />
        </div>

        <!-- Status under header -->
        <div
          v-if="paceHint"
          class="flex shrink-0 items-center justify-center gap-2.5 border-b px-3 py-2.5 text-center text-sm font-medium backdrop-blur-md"
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
            v-if="botsRunning"
            class="inline-flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-gold-300 shadow-[0_0_8px_rgba(201,168,76,0.7)]"
            aria-hidden="true"
          />
          <span
            v-else-if="awaitingResultView"
            class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-teal-soft shadow-[0_0_8px_rgba(42,138,138,0.6)]"
            aria-hidden="true"
          />
          <span
            v-else
            class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-teal-soft/80"
            aria-hidden="true"
          />
          {{ paceHint }}
        </div>

        <!-- Card reveal (main body under header) -->
        <div
          v-if="coyoteBanner"
          class="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-teal-deep/35 to-night-950/80 px-4 py-5 sm:py-6"
        >
          <div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-3.5 text-center">
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-sand-dim">
              カード公開
            </p>
            <!-- div not p: PlayerAvatar is a block; p+div breaks the line in some browsers -->
            <div
              class="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm text-sand-dim"
            >
              <span class="inline-flex items-center gap-1.5 font-medium text-sand">
                <PlayerAvatar
                  :avatar="coyoteBanner.challengerAvatar"
                  :avatar-src="coyoteBanner.challengerAvatarSrc"
                  :name="coyoteBanner.challengerName"
                  size="sm"
                  hide-name
                />
                {{ coyoteBanner.challengerName }}
              </span>
              <span class="inline-flex items-baseline gap-1 whitespace-nowrap">
                <span aria-hidden="true">→</span>
                <span class="font-display font-bold text-gold-200">{{
                  coyoteBanner.bid
                }}</span>
                <span>（{{ coyoteBanner.bidderName }}）</span>
              </span>
            </div>

            <ul
              class="grid w-full gap-2.5"
              :class="
                revealCards.length <= 4
                  ? 'grid-cols-2 sm:grid-cols-4'
                  : 'grid-cols-3 sm:grid-cols-5'
              "
            >
              <li
                v-for="(card, i) in revealCards"
                :key="card.playerId"
                class="flex flex-col items-center rounded-xl border border-gold-400/10 bg-night-900/50 px-1.5 py-2.5"
                :class="[
                  card.isSelf ? 'ring-1 ring-teal-soft/40' : '',
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
                  {{ card.playerName }}
                </div>
                <RevealCardTile
                  :kind="card.kind"
                  :label="card.label"
                  :value="card.value"
                  size="md"
                  :revealed="i < revealedCount"
                />
              </li>
            </ul>

            <p class="text-[11px] tabular-nums text-sand-dim">
              {{ Math.min(revealedCount, revealCards.length) }} / {{ revealCards.length }}
            </p>

            <div class="flex w-full max-w-xs flex-col gap-2 pb-4">
              <button
                v-if="!cardsRevealDone"
                type="button"
                class="btn-ghost w-full !py-2.5 text-sm"
                @click="skipCardReveal"
              >
                すべて公開
              </button>
              <button
                type="button"
                class="btn-gold w-full !py-3.5 text-base shadow-gold-glow"
                :class="!cardsRevealDone ? 'opacity-50' : ''"
                :disabled="!cardsRevealDone"
                @click="openResult"
              >
                結果を見る
              </button>
              <p v-if="!cardsRevealDone" class="text-[10px] text-sand-dim">
                札が開いたら合計と勝敗へ
              </p>
            </div>
          </div>
        </div>

        <!-- Normal play area -->
        <div v-else class="relative flex min-h-0 flex-1">
          <main class="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              class="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2 sm:px-4 sm:py-3"
            >
              <div
                class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
              >
                <CurrentBidDisplay
                  :current-bid="room.currentBid"
                  :turns-until-self="room.turnsUntilSelf"
                />
              </div>

              <PlayerCircle :players="room.players" class="relative z-10 h-full w-full" />
            </div>

            <div
              v-if="showForfeitEnd"
              class="mx-4 mb-2 shrink-0 rounded-xl border border-gold-400/30 bg-night-900/90 px-4 py-3 text-center"
            >
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
                  @click="playAgainFromForfeit"
                >
                  もう一度遊ぶ
                </button>
                <button
                  type="button"
                  class="btn-ghost sm:min-w-[8rem]"
                  @click="requestLeaveGame"
                >
                  退出
                </button>
              </div>
            </div>
            <div
              v-else-if="waitingForResultPeers"
              class="mx-4 mb-2 shrink-0 rounded-xl border border-teal-soft/30 bg-night-900/90 px-4 py-3 text-center text-sm text-teal-soft"
            >
              他のプレイヤーが結果を確認するまで、次ラウンドは始まりません
            </div>

            <div class="shrink-0">
              <BidControls
                v-if="!awaitingResultView && !waitingForResultPeers && !showForfeitEnd"
                v-model="draftBid"
                :min-bid="minBid"
                :can-declare="canDeclare"
                :can-challenge="canChallenge"
                @declare="onDeclare"
                @challenge="onChallenge"
              />
            </div>
          </main>

          <div
            class="flex w-72 min-h-0 shrink-0 flex-col border-l border-gold-400/10 p-3 xl:w-80"
          >
            <div
              class="mb-2 flex shrink-0 gap-1 rounded-xl border border-gold-400/15 bg-night-900/50 p-1"
              role="tablist"
              aria-label="サイドパネル"
            >
              <button
                type="button"
                role="tab"
                class="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition"
                :class="
                  desktopSideTab === 'log'
                    ? 'bg-night-700 text-gold-200'
                    : 'text-sand-dim hover:text-sand'
                "
                :aria-selected="desktopSideTab === 'log'"
                @click="desktopSideTab = 'log'"
              >
                ログ
              </button>
              <button
                type="button"
                role="tab"
                class="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition"
                :class="
                  desktopSideTab === 'chat'
                    ? 'bg-night-700 text-gold-200'
                    : 'text-sand-dim hover:text-sand'
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
              :messages="isOnline ? onlineGame.chatMessages : []"
              :self-player-id="onlineGame.playerId"
              :avatar-for-player="chatAvatarForPlayer"
              :disabled="!isOnline || onlineGame.connection !== 'open'"
              @send="onSendChat"
              @reaction="onSendReaction"
            />
          </div>
        </div>
      </div>

      <!-- ========== Mobile ========== -->
      <div class="relative flex h-full min-h-0 flex-1 flex-col lg:hidden">
        <div
          v-if="showOnlineDisconnect"
          class="flex shrink-0 items-center justify-between gap-2 border-b border-red-400/25 bg-red-950/50 px-3 py-2 text-xs text-red-100 safe-top"
        >
          <span class="min-w-0 truncate">
            {{
              onlineGame.reconnecting
                ? `再接続中…（${onlineGame.reconnectAttempt}）`
                : onlineGame.lastError ?? '切断されました'
            }}
          </span>
          <button
            v-if="onlineGame.canAttemptResume"
            type="button"
            class="btn-ghost shrink-0 !px-2 !py-1 text-[10px]"
            :disabled="onlineGame.reconnecting"
            @click="manualReconnect"
          >
            再接続
          </button>
        </div>
        <div class="shrink-0" :class="showOnlineDisconnect ? '' : 'safe-top'">
          <GameHeader
            mobile
            :room-code="room.roomCode"
            :player-count="room.playerCount"
            :round="room.round"
            :connection-status="room.connectionStatus"
            @help="openHelp"
            @deck="openDeckInfo"
            @chat="onHeaderChat"
            @stamp="openStampSheet"
            @leave="requestLeaveGame"
          />
        </div>

        <div
          v-if="paceHint"
          class="flex shrink-0 items-center justify-center gap-2 border-b px-3 py-2 text-center text-xs font-medium backdrop-blur-md"
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
          {{ paceHint }}
        </div>

        <!-- Card reveal under header -->
        <div
          v-if="coyoteBanner"
          class="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-teal-deep/35 to-night-950/80 px-3 py-4 safe-bottom"
        >
          <div class="mx-auto flex w-full max-w-md flex-col items-center gap-3 text-center">
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-sand-dim">
              カード公開
            </p>
            <p class="text-xs leading-relaxed text-sand-dim">
              <span class="font-medium text-sand">{{ coyoteBanner.challengerName }}</span>
              →
              <span class="font-display font-bold text-gold-200">{{ coyoteBanner.bid }}</span>
              （{{ coyoteBanner.bidderName }}）
            </p>

            <ul
              class="grid w-full gap-2"
              :class="
                revealCards.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'
              "
            >
              <li
                v-for="(card, i) in revealCards"
                :key="card.playerId"
                class="flex flex-col items-center rounded-xl border border-gold-400/10 bg-night-900/50 px-1 py-2"
                :class="[
                  card.isSelf ? 'ring-1 ring-teal-soft/40' : '',
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
                  {{ card.playerName }}
                </div>
                <RevealCardTile
                  :kind="card.kind"
                  :label="card.label"
                  :value="card.value"
                  size="md"
                  :revealed="i < revealedCount"
                />
              </li>
            </ul>

            <p class="text-[11px] tabular-nums text-sand-dim">
              {{ Math.min(revealedCount, revealCards.length) }} / {{ revealCards.length }}
            </p>

            <div class="flex w-full max-w-xs flex-col gap-2">
              <button
                v-if="!cardsRevealDone"
                type="button"
                class="btn-ghost w-full !py-2.5 text-sm"
                @click="skipCardReveal"
              >
                すべて公開
              </button>
              <button
                type="button"
                class="btn-gold w-full !py-3.5 text-base shadow-gold-glow"
                :class="!cardsRevealDone ? 'opacity-50' : ''"
                :disabled="!cardsRevealDone"
                @click="openResult"
              >
                結果を見る
              </button>
            </div>
          </div>
        </div>

        <!-- Normal mobile play -->
        <template v-else>
          <!-- Play column: bid stays; chat/log slide up into its free space -->
          <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div class="shrink-0">
              <MobilePlayerCarousel :players="room.players" />
            </div>

            <div
              class="flex shrink-0 items-center justify-between gap-2 border-b border-gold-400/10 bg-night-950/30 px-4 py-1.5 text-xs text-sand-dim"
            >
              <span class="chip !px-2 !py-0.5 !text-[10px]">
                {{ room.players.filter((p) => p.hasDeclared).length }}/{{
                  room.playerCount
                }}
                宣言
              </span>
              <span>
                あなたまであと
                <span class="font-semibold text-gold-200"
                  >{{ room.turnsUntilSelf }}人</span
                >
              </span>
              <span class="text-[10px] text-sand-dim/80">自分の札は？</span>
            </div>

            <main
              class="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-3"
              :class="
                mobileTab === 'chat' || mobileTab === 'log'
                  ? 'justify-start pt-2 pb-1'
                  : 'justify-center py-2'
              "
            >
              <div
                class="panel w-full max-w-[12rem] px-4 py-2.5 shadow-panel transition-transform duration-300"
                :class="
                  mobileTab === 'chat' || mobileTab === 'log'
                    ? 'scale-90 opacity-90'
                    : ''
                "
              >
                <CurrentBidDisplay
                  compact
                  :show-turns-hint="false"
                  :current-bid="room.currentBid"
                />
              </div>
            </main>

            <div
              v-if="showForfeitEnd"
              class="mx-3 mb-2 shrink-0 rounded-xl border border-gold-400/30 bg-night-900/90 px-3 py-3 text-center"
            >
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
                  @click="playAgainFromForfeit"
                >
                  もう一度遊ぶ
                </button>
                <button
                  type="button"
                  class="btn-ghost w-full !py-2 text-sm"
                  @click="requestLeaveGame"
                >
                  退出
                </button>
              </div>
            </div>

            <div
              v-show="mobileTab !== 'chat' && mobileTab !== 'log' && !showForfeitEnd"
              class="shrink-0"
            >
              <BidControls
                v-if="!awaitingResultView"
                v-model="draftBid"
                mobile
                :min-bid="minBid"
                :can-declare="canDeclare"
                :can-challenge="canChallenge"
                @declare="onDeclare"
                @challenge="onChallenge"
              />
            </div>

            <!-- Soft scrim (tap to close); bid still peeking above the sheet -->
            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <button
                v-if="mobileTab === 'chat' || mobileTab === 'log'"
                type="button"
                class="absolute inset-0 z-[15] bg-night-950/25"
                aria-label="閉じる"
                @click="closeMobileDrawer"
              />
            </Transition>

            <!-- Chat: bottom sheet using bid-area free space -->
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
                class="absolute inset-x-0 bottom-0 z-20 flex h-[min(58%,22rem)] max-h-[24rem] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gold-400/30 bg-night-900/98 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
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
                    @click="closeMobileDrawer"
                  >
                    閉じる
                  </button>
                </div>
                <ChatPanel
                  class="min-h-0 flex-1 !rounded-none !border-0 !shadow-none"
                  compact
                  embedded
                  hide-header
                  :messages="isOnline ? onlineGame.chatMessages : []"
                  :self-player-id="onlineGame.playerId"
                  :avatar-for-player="chatAvatarForPlayer"
                  :disabled="!isOnline || onlineGame.connection !== 'open'"
                  @send="onSendChat"
                  @reaction="onSendReaction"
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
                class="absolute inset-x-0 bottom-0 z-20 flex h-[min(58%,22rem)] max-h-[24rem] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gold-400/30 bg-night-900/98 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
                role="dialog"
                aria-label="イベントログ"
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
                    イベントログ
                  </p>
                  <button
                    type="button"
                    class="btn-ghost !px-2 !py-0.5 text-[11px]"
                    @click="closeMobileDrawer"
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

          <nav
            class="relative z-30 flex shrink-0 border-t border-gold-400/15 bg-night-950/95 safe-bottom"
            aria-label="モバイルメニュー"
          >
            <button
              type="button"
              class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition"
              :class="stampSheetOpen ? 'text-gold-200' : 'text-sand-dim'"
              @click="openStampSheet"
            >
              <span class="text-base">😀</span>
              スタンプ
            </button>
            <button
              type="button"
              class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition"
              :class="mobileTab === 'chat' ? 'text-gold-200' : 'text-sand-dim'"
              @click="toggleMobileChat"
            >
              <span class="text-base">💬</span>
              チャット
            </button>
            <button
              type="button"
              class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition"
              :class="mobileTab === 'log' ? 'text-gold-200' : 'text-sand-dim'"
              @click="toggleMobileLog"
            >
              <span class="text-base">☰</span>
              ログ
            </button>
          </nav>
        </template>
      </div>
    </template>

    <div
      v-else
      class="flex flex-1 items-center justify-center text-sm text-sand-dim"
    >
      セッションを準備中…
    </div>

    <!-- Coyote cut-in overlay -->
    <CoyoteCutIn
      v-if="cutInPayload"
      :challenger-name="cutInPayload.challengerName"
      :challenger-avatar="cutInPayload.challengerAvatar"
      :challenger-avatar-src="cutInPayload.challengerAvatarSrc"
      :bidder-name="cutInPayload.bidderName"
      :bid-value="cutInPayload.bidValue"
      @done="onCutInDone"
    />

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast"
        class="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-gold-400/30 bg-night-800/95 px-4 py-2 text-sm text-gold-100 shadow-panel lg:bottom-28"
      >
        {{ toast }}
      </div>
    </Transition>

    <nav
      v-if="allowUiMock"
      class="pointer-events-auto fixed bottom-3 right-3 z-30 hidden gap-1.5 lg:flex"
      aria-label="開発用画面リンク"
    >
      <RouterLink to="/" class="btn-ghost !px-2 !py-1 text-[10px]">トップ</RouterLink>
      <RouterLink to="/lobby" class="btn-ghost !px-2 !py-1 text-[10px]">ロビー</RouterLink>
    </nav>

    <!-- Leave / end session / host dissolve confirm -->
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
          v-if="leaveConfirmOpen"
          class="fixed inset-0 z-[60] flex items-center justify-center bg-night-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-confirm-title"
          @click.self="cancelLeaveGame"
        >
          <div
            class="panel w-full max-w-sm space-y-4 p-5 shadow-panel"
            @click.stop
          >
            <h2
              id="leave-confirm-title"
              class="font-display text-lg font-bold text-gold-200"
            >
              {{ canHostEndRoom ? '退出・ルーム解散' : 'ゲームを終了しますか？' }}
            </h2>
            <p class="text-sm leading-relaxed text-sand-dim">
              <template v-if="canHostEndRoom">
                <strong class="text-sand">自分だけ退出</strong>するとあなたは即脱落し、他の人は続きます。
                <strong class="text-sand">ルームを解散</strong>すると全員の対戦が終わり、ルームが閉じます。
              </template>
              <template v-else-if="isOnline">
                退出するとこの対戦から<strong class="text-sand">即脱落</strong>します。ホームに戻ります。
              </template>
              <template v-else>
                現在のゲームを終了してホームに戻ります。
              </template>
            </p>
            <div class="flex flex-col gap-2">
              <button
                v-if="canHostEndRoom"
                type="button"
                class="btn-gold w-full"
                @click="confirmEndRoom"
              >
                ルームを解散
              </button>
              <button
                type="button"
                class="btn-teal w-full"
                @click="confirmLeaveGame"
              >
                {{ canHostEndRoom ? '自分だけ退出' : '終了して退出' }}
              </button>
              <button
                type="button"
                class="btn-ghost w-full"
                @click="cancelLeaveGame"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <HelpModal :open="helpOpen" @close="helpOpen = false" />
    <DeckInfoModal
      :open="deckInfoOpen"
      :deck="roomDeck"
      @close="deckInfoOpen = false"
    />

    <ReactionOverlay
      v-if="isOnline"
      :reactions="onlineGame.floatingReactions"
    />

    <StampPickerSheet
      :open="stampSheetOpen"
      :disabled="!isOnline || onlineGame.connection !== 'open'"
      @close="stampSheetOpen = false"
      @pick="onSendReaction"
    />

    <MockBadge />
  </div>
</template>
