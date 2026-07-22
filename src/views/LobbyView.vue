<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppConfirmDialog from '@/components/common/AppConfirmDialog.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import AppToast from '@/components/common/AppToast.vue'
import AvatarPicker from '@/components/common/AvatarPicker.vue'
import FxSparkleBurst from '@/components/common/FxSparkleBurst.vue'
import HelpModal from '@/components/common/HelpModal.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import ChatPanel from '@/components/game/ChatPanel.vue'
import FloatingReactionsHost from '@/components/game/FloatingReactionsHost.vue'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'
import DeckSettingsPanel from '@/components/lobby/DeckSettingsPanel.vue'
import ExtraRulesPanel from '@/components/lobby/ExtraRulesPanel.vue'
import TimeControlPanel from '@/components/lobby/TimeControlPanel.vue'
import WinConditionPanel from '@/components/lobby/WinConditionPanel.vue'
import type { StampId } from '@/online/stamps'
import type {
  WireDeckComposition,
  WireExtraRules,
  WireTimeControl,
  WireWinCondition,
} from '@/online/protocol'
import { allowLocalPlay } from '@/config/runtime'
import { mockLobby } from '@/data/mockLobby'
import {
  AVATAR_ASSETS,
  avatarByIndex,
  avatarSrc,
  sanitizeAvatarIndex,
} from '@/localGame/avatarCatalog'
import { buildDemoLineup, DEFAULT_PROFILES } from '@/localGame/profiles'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'
import type { LobbyPlayer } from '@/types/game'

/**
 * Room settings detail: modal only (not inline accordion).
 * Keeps PC right column height stable; chat stays visible.
 */
const settingsOpen = ref(false)
/** Compact profile: full edit (name + icon catalog) only in modal */
const profileEditOpen = ref(false)

const router = useRouter()
const route = useRoute()
const localGame = useLocalGameStore()
const onlineGame = useOnlineGameStore()

const toast = ref<string | null>(null)
const helpOpen = ref(false)
const copied = ref(false)
const starting = ref(false)
const resumeBusy = ref(false)
const resumeFailed = ref(false)
/** Editable display name while waiting in online lobby */
const nameDraft = ref(onlineGame.displayName || '')
/** Editable avatar while waiting in online lobby */
const avatarDraft = ref(sanitizeAvatarIndex(onlineGame.avatarIndex, 0))

const isOnline = computed(
  () =>
    onlineGame.isOnlineSession ||
    route.query.online === '1' ||
    onlineGame.view != null,
)

const isHost = computed(() => {
  if (isOnline.value) return onlineGame.isHost
  if (route.query.host === '0') return false
  if (route.query.host === '1') return true
  return mockLobby.isHost
})

const roomCode = computed(() => {
  if (isOnline.value && onlineGame.roomCode) return onlineGame.roomCode
  const q = route.query.code
  if (typeof q === 'string' && q.length > 0) return q.toUpperCase()
  return mockLobby.roomCode
})

function avatarForIndex(index: number | undefined) {
  const meta = avatarByIndex(index)
  return { emoji: meta.emoji, src: avatarSrc(meta.id) }
}

/** Online lobby from server view; offline uses demo lineup mock. */
const players = computed<LobbyPlayer[]>(() => {
  if (isOnline.value && onlineGame.view) {
    const selfId = onlineGame.playerId
    return onlineGame.view.players.map((p) => {
      const av = avatarForIndex(p.avatarIndex)
      return {
        id: p.id,
        name: p.displayName,
        avatar: av.emoji,
        avatarSrc: av.src,
        isHost: p.isHost,
        isSelf: p.id === selfId,
        isReady: p.ready,
        connected: p.connected,
      }
    })
  }
  return DEFAULT_PROFILES.map((p, i) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    avatarSrc: p.avatarSrc,
    isHost: i === 0,
    isSelf: i === 0,
    isReady: true,
  }))
})

const maxPlayers = computed(() => onlineGame.view?.maxPlayers ?? 10)
const readyCount = computed(() => players.value.filter((p) => p.isReady).length)
const emptySeatCount = computed(() =>
  Math.max(0, maxPlayers.value - players.value.length),
)
const canStart = computed(() => {
  if (isOnline.value) return onlineGame.canStart
  return isHost.value && players.value.length >= 2
})

const showDisconnectBanner = computed(
  () =>
    isOnline.value &&
    !onlineGame.isRoomClosed &&
    (onlineGame.connection === 'closed' ||
      onlineGame.connection === 'error' ||
      (onlineGame.reconnecting && onlineGame.connection !== 'open')),
)

const selfReady = computed(() => {
  const me = players.value.find((p) => p.isSelf)
  return me?.isReady ?? false
})

const selfPlayer = computed(() => players.value.find((p) => p.isSelf))

const selectedAvatarMeta = computed(
  () => AVATAR_ASSETS[avatarDraft.value] ?? AVATAR_ASSETS[0]!,
)

/** Tags for collapsed room settings (readable chips, not one long sentence). */
const settingsTags = computed((): string[] => {
  const view = onlineGame.view
  if (!view) return ['山札', '勝利条件', 'ルール', '制限時間']
  const tags: string[] = []
  const deck = view.deck
  if (deck) {
    tags.push(deck.label?.trim() || '山札')
    const num = deck.numbers.reduce((s, n) => s + n.count, 0)
    const sp = deck.specials
    const total =
      num +
      sp.double +
      (sp.half ?? 0) +
      sp.max_to_zero +
      sp.redraw +
      sp.zero_mix
    if (total > 0) tags.push(`${total}枚`)
  } else {
    tags.push('山札')
  }
  tags.push(view.winCondition === 'last_standing' ? '勝ち残り' : '一人脱落')
  const er = view.extraRules
  const extraKeys: (keyof WireExtraRules)[] = [
    'same',
    'change',
    'reverse',
    'shot',
    'draw1',
    'lifeDouble',
  ]
  const extraOn = er ? extraKeys.filter((k) => er[k]).length : 0
  tags.push(extraOn === 0 ? 'エクストラなし' : `エクストラ ${extraOn}`)
  const tc = view.timeControl
  if (tc) {
    const main =
      tc.mainSeconds >= 60 && tc.mainSeconds % 60 === 0
        ? `${tc.mainSeconds / 60}分`
        : `${tc.mainSeconds}秒`
    tags.push(`${main}+${tc.turnSeconds}秒`)
  } else {
    tags.push('制限なし')
  }
  return tags
})

/** Why the host cannot start yet (shown near the start button, not inside it). */
const startBlockedReason = computed((): string | null => {
  if (!isHost.value) return null
  if (players.value.length < 2) return '開始には2人以上必要です'
  if (isOnline.value && readyCount.value < players.value.length) {
    return `全員の準備完了が必要です（${readyCount.value}/${players.value.length}）`
  }
  if (!canStart.value) return 'まだ開始できません'
  return null
})

const allReady = computed(
  () =>
    players.value.length >= 2 &&
    readyCount.value >= players.value.length,
)

function showToast(msg: string) {
  toast.value = msg
}

function dismissToast() {
  toast.value = null
}

// Surface store errors / events (Japanese copy from errorMessages)
watch(
  () => onlineGame.lastError,
  (msg) => {
    if (msg && isOnline.value) showToast(msg)
  },
)
watch(
  () => onlineGame.lastEvent,
  (msg) => {
    if (msg && isOnline.value) showToast(msg)
  },
)

// When host starts → navigate all clients to game
watch(
  () => onlineGame.isPlaying,
  (playing) => {
    if (playing && isOnline.value) {
      const code = onlineGame.roomCode ?? roomCode.value
      void router.push({
        name: 'game',
        query: { online: '1', ...(code ? { code } : {}) },
      })
    }
  },
)

async function manualReconnect() {
  if (resumeBusy.value) return
  resumeBusy.value = true
  try {
    await onlineGame.reconnect()
    showToast('再接続しました')
  } catch (e) {
    showToast(e instanceof Error ? e.message : '再接続に失敗しました')
  } finally {
    resumeBusy.value = false
  }
}

onMounted(() => {
  void bootstrapOnline()
})

async function bootstrapOnline() {
  const wantsOnline =
    route.query.online === '1' ||
    typeof route.query.code === 'string' ||
    onlineGame.isOnlineSession

  // Production: offline lobby (fixed mock lineup) is not available
  if (!wantsOnline && !allowLocalPlay) {
    void router.replace({ name: 'home' })
    return
  }
  if (!wantsOnline) return

  // Already live
  if (onlineGame.connection === 'open' && onlineGame.view) {
    if (onlineGame.isPlaying) {
      const code = onlineGame.roomCode
      void router.replace({
        name: 'game',
        query: { online: '1', ...(code ? { code } : {}) },
      })
    }
    return
  }

  const qCode =
    typeof route.query.code === 'string' ? route.query.code : undefined
  resumeBusy.value = true
  resumeFailed.value = false
  try {
    const ok = await onlineGame.ensureSession({ code: qCode })
    if (!ok && !onlineGame.view) {
      resumeFailed.value = true
      showToast('ルームへの復帰に失敗しました')
      return
    }
    if (onlineGame.isPlaying) {
      const code = onlineGame.roomCode ?? qCode
      void router.replace({
        name: 'game',
        query: { online: '1', ...(code ? { code } : {}) },
      })
    }
  } catch (e) {
    resumeFailed.value = true
    showToast(e instanceof Error ? e.message : '接続に失敗しました')
  } finally {
    resumeBusy.value = false
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(roomCode.value)
    copied.value = true
    showToast('ルームコードをコピーしました')
    window.setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    showToast(`コード: ${roomCode.value}`)
  }
}

function toggleReady() {
  if (!isOnline.value) return
  onlineGame.setReady(!selfReady.value)
}

function startGame() {
  if (isOnline.value) {
    if (!canStart.value) {
      if (!isHost.value) {
        showToast('ホストのみ開始できます')
      } else if (players.value.length < 2) {
        showToast('開始には2人以上必要です')
      } else if (readyCount.value < players.value.length) {
        showToast('全員が準備完了してから開始できます')
      } else {
        showToast('まだ開始できません')
      }
      return
    }
    starting.value = true
    onlineGame.startGame()
    // Navigation via isPlaying watch; clear busy after a beat
    window.setTimeout(() => {
      starting.value = false
    }, 2000)
    return
  }

  if (!allowLocalPlay) {
    showToast('オンラインルームでのみ開始できます')
    void router.replace({ name: 'home' })
    return
  }
  if (!canStart.value) {
    showToast('ホストのみ開始できます（2人以上）')
    return
  }
  localGame.startLocalGame({
    profiles: buildDemoLineup({ playerCount: 4 }),
    roomCode: roomCode.value,
    initialLives: 3,
    deck: 'standard',
  })
  void router.push({ name: 'game' })
}

function leaveLobby() {
  if (isOnline.value) {
    onlineGame.leave()
  }
  void router.push({ name: 'home' })
}

const dissolveConfirmOpen = ref(false)

function requestDissolveRoom() {
  dissolveConfirmOpen.value = true
}

function cancelDissolveRoom() {
  dissolveConfirmOpen.value = false
}

/** Host: dissolve room for everyone still in lobby. */
function confirmDissolveRoom() {
  dissolveConfirmOpen.value = false
  if (!isOnline.value || !onlineGame.isHost) return
  onlineGame.endRoom()
  void router.push({ name: 'home' })
}

// Host ended room / idle purge while on lobby
watch(
  () => onlineGame.lastErrorCode,
  (code) => {
    if (code === 'ROOM_CLOSED') {
      dissolveConfirmOpen.value = false
      void router.replace({ name: 'home' })
    }
  },
)

function lobbyChatAvatar(playerId: string) {
  const p = players.value.find((x) => x.id === playerId)
  const fromView = onlineGame.view?.players.find((x) => x.id === playerId)
  const meta = fromView ? avatarByIndex(fromView.avatarIndex) : null
  if (p) {
    return {
      avatar: p.avatar,
      avatarSrc: p.avatarSrc,
      avatarId: meta?.id,
    }
  }
  if (meta) {
    return {
      avatar: meta.emoji,
      avatarSrc: avatarSrc(meta.id),
      avatarId: meta.id,
    }
  }
  return { avatar: '👤' }
}

const selfStampAvatarId = computed(
  () => avatarByIndex(avatarDraft.value).id,
)

function onSendChat(text: string) {
  if (!isOnline.value) return
  onlineGame.sendChat(text)
}

function onSendReaction(stampId: StampId) {
  if (!isOnline.value) return
  onlineGame.sendReaction(stampId)
}

function openProfileEdit() {
  if (!isOnline.value) return
  settingsOpen.value = false
  profileEditOpen.value = true
}

function closeProfileEdit() {
  profileEditOpen.value = false
}

function openSettings() {
  if (!isOnline.value) return
  profileEditOpen.value = false
  settingsOpen.value = true
}

function closeSettings() {
  settingsOpen.value = false
}

function onLobbyModalKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (profileEditOpen.value) {
    e.preventDefault()
    closeProfileEdit()
    return
  }
  if (settingsOpen.value) {
    e.preventDefault()
    closeSettings()
  }
}

const anyLobbyModalOpen = computed(
  () => profileEditOpen.value || settingsOpen.value,
)

watch(anyLobbyModalOpen, (isOpen) => {
  if (isOpen) {
    document.documentElement.style.overflow = 'hidden'
    window.addEventListener('keydown', onLobbyModalKeydown)
  } else {
    document.documentElement.style.overflow = ''
    window.removeEventListener('keydown', onLobbyModalKeydown)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onLobbyModalKeydown)
  if (anyLobbyModalOpen.value) {
    document.documentElement.style.overflow = ''
  }
})

function applyDisplayName() {
  if (!isOnline.value) return
  const next = nameDraft.value.trim().replace(/\s+/g, ' ').slice(0, 12)
  if (!next) {
    showToast('表示名を入力してください')
    return
  }
  nameDraft.value = next
  onlineGame.updateDisplayName(next)
  showToast(`表示名を「${next}」に変更しました`)
}

/** Lobby: apply avatar as soon as the player picks one. */
function onAvatarPick(index: number) {
  if (!isOnline.value) return
  if (onlineGame.connection !== 'open') {
    showToast('接続中のみ変更できます')
    return
  }
  const next = sanitizeAvatarIndex(index, 0)
  avatarDraft.value = next
  if (onlineGame.avatarIndex === next) {
    // Still re-send so seat stays in sync if store was ahead of server
    const self = onlineGame.view?.players.find((p) => p.id === onlineGame.playerId)
    if (self && self.avatarIndex === next) return
  }
  onlineGame.updateAvatarIndex(next)
  const label = AVATAR_ASSETS[next]?.name ?? 'アイコン'
  showToast(`アイコンを「${label}」に変更しました`)
}

function applyDeck(deck: WireDeckComposition) {
  if (!isOnline.value || !isHost.value) {
    showToast('山札を変えられるのはホストだけです')
    return
  }
  if (onlineGame.connection !== 'open') {
    showToast('接続中のみ変更できます')
    return
  }
  onlineGame.setDeck(deck)
}

function applyExtraRules(rules: WireExtraRules) {
  if (!isOnline.value || !isHost.value) {
    showToast('ルールを変えられるのはホストだけです')
    return
  }
  if (onlineGame.connection !== 'open') {
    showToast('接続中のみ変更できます')
    return
  }
  onlineGame.setExtraRules(rules)
  showToast('エクストラルールを反映しました')
}

function applyTimeControl(tc: WireTimeControl | null) {
  if (!isOnline.value || !isHost.value) {
    showToast('制限時間を変えられるのはホストだけです')
    return
  }
  if (onlineGame.connection !== 'open') {
    showToast('接続中のみ変更できます')
    return
  }
  onlineGame.setTimeControl(tc)
  showToast(
    tc == null
      ? '制限時間をオフにしました'
      : `制限時間を反映しました（${tc.mainSeconds >= 60 && tc.mainSeconds % 60 === 0 ? `${tc.mainSeconds / 60}分` : `${tc.mainSeconds}秒`} + ${tc.turnSeconds}秒）`,
  )
}

function applyWinCondition(condition: WireWinCondition) {
  if (!isOnline.value || !isHost.value) {
    showToast('勝利条件を変えられるのはホストだけです')
    return
  }
  if (onlineGame.connection !== 'open') {
    showToast('接続中のみ変更できます')
    return
  }
  onlineGame.setWinCondition(condition)
  showToast(
    condition === 'last_standing'
      ? '勝利条件を「勝ち残り」にしました'
      : '勝利条件を「一人脱落で終了」にしました',
  )
}

// Keep draft in sync when server view / store name updates (join, resume)
watch(
  () => onlineGame.displayName,
  (n) => {
    if (n && n !== nameDraft.value.trim()) {
      // Only overwrite if draft looks stale (empty or equal to previous store value)
      if (!nameDraft.value.trim()) nameDraft.value = n
    }
  },
)

watch(
  () => {
    const self = players.value.find((p) => p.isSelf)
    return self?.name
  },
  (n) => {
    if (n && !nameDraft.value.trim()) nameDraft.value = n
  },
  { immediate: true },
)

// Sync avatar draft from preferred store or server self seat
watch(
  () => onlineGame.avatarIndex,
  (i) => {
    avatarDraft.value = sanitizeAvatarIndex(i, 0)
  },
)

watch(
  () => {
    if (!isOnline.value || !onlineGame.view || !onlineGame.playerId) return null
    const self = onlineGame.view.players.find(
      (p) => p.id === onlineGame.playerId,
    )
    return self?.avatarIndex ?? null
  },
  (i) => {
    if (i != null) avatarDraft.value = sanitizeAvatarIndex(i, 0)
  },
  { immediate: true },
)
</script>

<template>
  <!--
    Lobby shell: fixed chrome (header + sticky CTA) + scrollable body.
    Priority: participants → ready → capacity → code → start → chat → settings → profile.
  -->
  <div class="page-fixed desert-bg safe-x">
    <AppHeader :sticky="false">
      <template #actions>
        <button
          type="button"
          class="btn-ghost btn-sm"
          title="遊び方・ルール"
          aria-label="遊び方・ルール"
          @click="helpOpen = true"
        >
          説明
        </button>
        <button type="button" class="btn-ghost btn-sm" @click="leaveLobby">
          退出
        </button>
      </template>
    </AppHeader>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        class="relative mx-auto w-full max-w-lg px-4 py-4 sm:max-w-2xl sm:py-5 lg:max-w-[1100px] lg:py-6"
      >
        <!-- Disconnect / reconnect (P1-4) -->
        <div
          v-if="showDisconnectBanner"
          class="mb-3 flex flex-col gap-2 rounded-2xl border border-red-400/30 bg-red-950/40 px-4 py-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-red-100">
            {{
              onlineGame.reconnecting
                ? `再接続中…（試行 ${onlineGame.reconnectAttempt}）`
                : onlineGame.lastError ?? '接続が切れました'
            }}
          </p>
          <button
            v-if="onlineGame.canAttemptResume"
            type="button"
            class="btn-ghost btn-sm shrink-0"
            :disabled="resumeBusy || onlineGame.reconnecting"
            @click="manualReconnect"
          >
            再接続
          </button>
        </div>

        <div
          v-if="isOnline && resumeFailed && !onlineGame.view"
          class="mb-3 rounded-2xl border border-gold-400/20 bg-night-900/60 px-4 py-3 text-center text-sm text-sand-dim sm:mb-4"
        >
          ルームにつなげませんでした。ホームからコードを入れ直すか、少し待ってからもう一度どうぞ。
          <button
            type="button"
            class="btn-ghost btn-sm mt-2"
            @click="leaveLobby"
          >
            ホームへ
          </button>
        </div>

        <!-- Compact room header: code + copy + capacity (one row on PC) -->
        <header
          class="mb-4 flex flex-col gap-2 rounded-2xl border border-gold-400/20 bg-night-800/70 px-3 py-2.5 sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3"
          aria-label="ルーム情報"
        >
          <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span class="shrink-0 text-[11px] text-sand-dim sm:text-xs">
              ルームコード
            </span>
            <span
              class="font-mono text-xl font-bold tracking-[0.22em] text-gold-200 sm:text-2xl sm:tracking-[0.28em]"
            >
              {{ roomCode }}
            </span>
            <button
              type="button"
              class="btn-ghost btn-sm relative shrink-0"
              :class="copied ? 'copy-flash' : ''"
              @click="copyCode"
            >
              <FxSparkleBurst v-if="copied" density="sm" palette="gold" />
              {{ copied ? 'コピー済み' : 'コピー' }}
            </button>
          </div>
          <div
            class="flex flex-wrap items-center gap-2 text-xs sm:justify-end sm:text-sm"
          >
            <span class="chip chip-muted !py-0.5">
              参加者 {{ players.length }}/{{ maxPlayers }}
            </span>
            <span
              class="chip !py-0.5"
              :class="allReady ? 'chip-teal' : 'chip-muted'"
            >
              準備 {{ readyCount }}/{{ players.length || 0 }}
            </span>
          </div>
        </header>

        <!--
          Main IA: lg 2-col (participants hero | settings + chat).
          SP: participants first, then settings, then chat.
        -->
        <div
          class="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)] lg:items-start lg:gap-5"
        >
          <!-- Left: participants (hero) -->
          <section class="order-1 min-w-0 lg:order-none" aria-label="参加者">
            <div class="mb-3 flex items-end justify-between gap-2">
              <h2 class="text-base font-semibold text-gold-200 sm:text-lg">
                参加者
              </h2>
              <p class="text-xs text-sand-dim sm:text-sm">
                <span class="font-semibold text-sand">{{ players.length }}</span>
                <span class="text-sand-dim"> / {{ maxPlayers }}人</span>
                <span class="mx-1.5 text-gold-400/40" aria-hidden="true">·</span>
                準備
                <span
                  class="font-semibold"
                  :class="allReady ? 'text-teal-soft' : 'text-sand'"
                >
                  {{ readyCount }}
                </span>
                / {{ players.length || 0 }}
              </p>
            </div>

            <ul
              class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3"
            >
              <li
                v-for="p in players"
                :key="p.id"
                class="lobby-join-in relative flex flex-col items-center rounded-xl border bg-night-900/45 px-2.5 py-3.5 sm:px-3 sm:py-4"
                :class="[
                  p.isReady
                    ? 'lobby-seat--ready border-teal-soft/45 shadow-[0_0_0_1px_rgba(42,138,138,0.18)]'
                    : 'border-gold-400/15',
                  p.isSelf && !p.isReady ? 'ring-1 ring-teal-soft/35' : '',
                  isOnline && 'connected' in p && !p.connected
                    ? 'opacity-50'
                    : '',
                ]"
              >
                <!-- Ready check badge on avatar -->
                <div class="relative mb-1">
                  <PlayerAvatar
                    :avatar="p.avatar"
                    :avatar-src="p.avatarSrc"
                    :name="p.name"
                    :self="p.isSelf"
                    :highlighted="false"
                    size="md"
                    hide-name
                  />
                  <span
                    v-if="p.isReady"
                    :key="`${p.id}-ready-badge-${p.isReady}`"
                    class="lobby-ready-pop absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-teal-deep text-[11px] font-bold text-gold-100 ring-2 ring-night-900"
                    aria-hidden="true"
                    title="準備完了"
                  >
                    ✓
                  </span>
                </div>

                <p
                  class="max-w-full truncate text-center text-sm font-semibold leading-tight"
                  :class="p.isSelf ? 'text-teal-soft' : 'text-sand'"
                >
                  {{ p.name }}
                </p>

                <div
                  class="mt-1.5 flex min-h-[1.25rem] flex-wrap items-center justify-center gap-1"
                >
                  <span
                    v-if="p.isHost"
                    class="rounded bg-gold-400/20 px-1.5 py-0.5 text-[10px] font-medium text-gold-200"
                  >
                    ホスト
                  </span>
                  <span
                    v-if="isOnline && 'connected' in p && !p.connected"
                    class="rounded bg-night-700 px-1.5 py-0.5 text-[10px] text-sand-dim"
                  >
                    切断
                  </span>
                  <span
                    :key="`${p.id}-ready-${p.isReady}`"
                    class="rounded px-1.5 py-0.5 text-[10px]"
                    :class="
                      p.isReady
                        ? 'lobby-ready-pop bg-teal-deep/45 text-teal-soft'
                        : 'bg-night-700/80 text-sand-dim'
                    "
                  >
                    {{ p.isReady ? '準備OK' : '待機中' }}
                  </span>
                </div>
              </li>

              <!-- Empty seats: waiting, not actionable “+” -->
              <li
                v-for="n in emptySeatCount"
                :key="`empty-${n}`"
                class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold-400/12 bg-night-900/15 px-2.5 py-4 text-center sm:py-5"
              >
                <span
                  class="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-gold-400/20 bg-night-900/30 text-sand-dim/50 sm:h-14 sm:w-14"
                  aria-hidden="true"
                >
                  <span class="text-lg opacity-60">·</span>
                </span>
                <span class="text-[11px] text-sand-dim/80">参加待ち</span>
              </li>
            </ul>
          </section>

          <!-- Right column: settings summary + chat (detail opens modal — no page stretch) -->
          <div
            v-if="isOnline"
            class="order-2 flex min-w-0 flex-col gap-3 lg:order-none lg:gap-4"
          >
            <!-- Room settings: tags only; full panels in modal -->
            <section
              class="overflow-hidden rounded-2xl border border-gold-400/20 bg-night-800/70"
              aria-label="ルーム設定"
            >
              <button
                type="button"
                class="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left sm:px-4 sm:py-3.5"
                :aria-expanded="settingsOpen"
                aria-haspopup="dialog"
                @click="openSettings"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-gold-200">ルーム設定</p>
                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    <span
                      v-for="(tag, i) in settingsTags"
                      :key="`${tag}-${i}`"
                      class="inline-flex rounded-full border border-gold-400/20 bg-night-900/50 px-2 py-0.5 text-[10px] font-medium text-sand-dim sm:text-[11px]"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
                <span class="shrink-0 pt-0.5 text-xs text-sand-dim">
                  {{ isHost ? '変更' : '設定を見る' }}
                </span>
              </button>
            </section>

            <!-- Chat (fills right column; not pushed by settings expand) -->
            <section
              class="h-48 min-h-[11rem] sm:h-56 lg:h-[min(28rem,52vh)] lg:min-h-[18rem]"
              aria-label="ルームチャット"
            >
              <ChatPanel
                class="h-full"
                compact
                :messages="onlineGame.chatMessages"
                :self-player-id="onlineGame.playerId"
                :avatar-for-player="lobbyChatAvatar"
                :self-avatar-id="selfStampAvatarId"
                :disabled="onlineGame.connection !== 'open'"
                @send="onSendChat"
                @reaction="onSendReaction"
              />
            </section>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky action bar: profile (aux) · ready · start · dissolve (danger, right) -->
    <div
      class="z-20 shrink-0 border-t border-gold-400/15 bg-night-900/95 backdrop-blur-md safe-bottom"
      role="region"
      aria-label="ロビー操作"
    >
      <div
        class="mx-auto flex w-full max-w-lg flex-col gap-2.5 px-4 py-2.5 sm:max-w-2xl sm:py-3 lg:max-w-[1100px] lg:flex-row lg:items-center lg:gap-4"
      >
        <!-- Compact profile summary (online only) — auxiliary, not hero -->
        <div
          v-if="isOnline"
          class="flex min-w-0 items-center gap-2.5 rounded-xl border border-gold-400/12 bg-night-900/40 px-2.5 py-1.5 lg:max-w-[14rem] lg:shrink-0"
        >
          <button
            type="button"
            class="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-teal-soft/50 bg-night-900/80 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="onlineGame.connection !== 'open'"
            :aria-label="`${selectedAvatarMeta.name} — プロフィールを変更`"
            @click="openProfileEdit"
          >
            <img
              :src="avatarSrc(selectedAvatarMeta.id)"
              :alt="selectedAvatarMeta.name"
              class="h-full w-full object-cover"
              draggable="false"
            />
          </button>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium leading-tight text-sand">
              {{ nameDraft.trim() || selfPlayer?.name || 'プレイヤー' }}
            </p>
            <p class="truncate text-[10px] text-sand-dim">
              {{ selectedAvatarMeta.name }}
            </p>
          </div>
          <button
            type="button"
            class="btn-ghost btn-sm shrink-0 !px-2"
            :disabled="onlineGame.connection !== 'open'"
            @click="openProfileEdit"
          >
            変更
          </button>
        </div>

        <div
          class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
        >
          <button
            v-if="isOnline"
            type="button"
            class="w-full sm:w-auto sm:min-w-[8.5rem]"
            :class="selfReady ? 'btn-ghost' : 'btn-teal'"
            :disabled="onlineGame.connection !== 'open'"
            @click="toggleReady"
          >
            {{ selfReady ? '✓ 準備OK' : '準備完了' }}
          </button>

          <div class="flex min-w-0 flex-1 flex-col gap-1 sm:items-stretch">
            <button
              v-if="isHost"
              type="button"
              class="w-full sm:min-w-[11rem]"
              :class="
                canStart && !starting
                  ? 'btn-gold'
                  : 'btn-ghost opacity-70'
              "
              :disabled="!canStart || starting"
              @click="startGame"
            >
              {{ starting ? '開始中…' : 'ゲームを開始' }}
            </button>
            <div
              v-else
              class="w-full rounded-xl border border-gold-400/20 bg-night-800/60 px-4 py-2.5 text-center text-sm text-sand-dim sm:min-w-[11rem]"
            >
              {{
                isOnline && readyCount < players.length
                  ? '全員の準備完了を待っています…'
                  : 'ホストの開始を待っています…'
              }}
            </div>
            <p
              v-if="isHost && startBlockedReason"
              class="text-center text-[11px] text-sand-dim sm:text-left"
            >
              {{ startBlockedReason }}
            </p>
            <p
              v-else-if="isHost && canStart"
              class="text-center text-[11px] text-teal-soft/90 sm:text-left"
            >
              全員準備完了 — 開始できます
            </p>
            <p
              v-else-if="isOnline && !isHost"
              class="text-center text-[11px] text-sand-dim sm:text-left"
            >
              準備 {{ readyCount }}/{{ players.length }}
            </p>
          </div>

          <button
            v-if="isOnline && isHost"
            type="button"
            class="btn-sm w-full border border-red-400/45 bg-transparent px-3 py-2 text-red-200 transition hover:border-red-400/65 hover:bg-red-950/35 sm:ml-auto sm:w-auto"
            @click="requestDissolveRoom"
          >
            ルームを解散
          </button>
        </div>
      </div>
    </div>

    <!-- Room settings modal (PC/SP: no inline expand, keeps lobby height stable) -->
    <Teleport to="body">
      <div
        v-if="settingsOpen && isOnline"
        class="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-settings-title"
      >
        <button
          type="button"
          class="absolute inset-0 bg-night-950/75"
          aria-label="閉じる"
          @click="closeSettings"
        />
        <div
          class="relative z-10 flex max-h-[min(88dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl border border-gold-400/25 bg-night-800 shadow-panel sm:mx-4 sm:rounded-2xl lg:max-w-xl"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-3 border-b border-gold-400/15 px-4 py-3 sm:px-5"
          >
            <div class="min-w-0">
              <h2
                id="lobby-settings-title"
                class="text-sm font-semibold text-gold-200 sm:text-base"
              >
                ルーム設定
              </h2>
              <p class="mt-0.5 text-[11px] text-sand-dim">
                {{
                  isHost
                    ? '山札・勝利条件・ルール・制限時間を変更できます'
                    : '閲覧のみ。変更できるのはホストだけです'
                }}
              </p>
            </div>
            <button
              type="button"
              class="btn-ghost btn-sm shrink-0"
              @click="closeSettings"
            >
              閉じる
            </button>
          </div>
          <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            <p
              v-if="!isHost"
              class="rounded-xl border border-gold-400/10 bg-night-900/50 px-3 py-2 text-[11px] text-sand-dim"
            >
              閲覧のみ。変更できるのはホストだけです
            </p>
            <DeckSettingsPanel
              :deck="onlineGame.view?.deck"
              :editable="isHost"
              :disabled="onlineGame.connection !== 'open'"
              @apply="applyDeck"
            />
            <WinConditionPanel
              :win-condition="onlineGame.view?.winCondition"
              :editable="isHost"
              :disabled="onlineGame.connection !== 'open'"
              @apply="applyWinCondition"
            />
            <ExtraRulesPanel
              :extra-rules="onlineGame.view?.extraRules"
              :editable="isHost"
              :disabled="onlineGame.connection !== 'open'"
              @apply="applyExtraRules"
            />
            <TimeControlPanel
              :time-control="onlineGame.view?.timeControl"
              :editable="isHost"
              :disabled="onlineGame.connection !== 'open'"
              @apply="applyTimeControl"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Profile edit modal (name + icon catalog) -->
    <Teleport to="body">
      <div
        v-if="profileEditOpen && isOnline"
        class="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-profile-edit-title"
      >
        <button
          type="button"
          class="absolute inset-0 bg-night-950/75"
          aria-label="閉じる"
          @click="closeProfileEdit"
        />
        <div
          class="relative z-10 flex max-h-[min(88dvh,40rem)] w-full max-w-md flex-col rounded-t-2xl border border-gold-400/25 bg-night-800 shadow-panel sm:mx-4 sm:rounded-2xl"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-3 border-b border-gold-400/15 px-4 py-3 sm:px-5"
          >
            <h2
              id="lobby-profile-edit-title"
              class="text-sm font-semibold text-gold-200 sm:text-base"
            >
              プロフィールを変更
            </h2>
            <button
              type="button"
              class="btn-ghost btn-sm"
              @click="closeProfileEdit"
            >
              閉じる
            </button>
          </div>
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <label class="block">
              <span class="field-label">表示名</span>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  v-model="nameDraft"
                  type="text"
                  maxlength="12"
                  autocomplete="nickname"
                  placeholder="例: コヨーテ"
                  class="field min-w-0 flex-1 !py-2.5"
                  :disabled="onlineGame.connection !== 'open'"
                  @keydown.enter.prevent="applyDisplayName"
                />
                <button
                  type="button"
                  class="btn-ghost btn-sm shrink-0"
                  :disabled="onlineGame.connection !== 'open'"
                  @click="applyDisplayName"
                >
                  名前を反映
                </button>
              </div>
              <p class="mt-1.5 text-[11px] text-sand-dim">
                最大12文字。席とチャットに表示されます
              </p>
            </label>

            <AvatarPicker
              v-model="avatarDraft"
              variant="grid"
              label="アイコン"
              :disabled="onlineGame.connection !== 'open'"
              @update:model-value="onAvatarPick"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <AppConfirmDialog
      v-model:open="dissolveConfirmOpen"
      title="ルームを解散しますか？"
      confirm-label="ルームを解散"
      danger
      @confirm="confirmDissolveRoom"
      @cancel="cancelDissolveRoom"
    >
      全員がホームに戻され、このルームコードでは再参加できなくなります。
    </AppConfirmDialog>

    <AppToast :message="toast" @dismiss="dismissToast" />

    <HelpModal :open="helpOpen" @close="helpOpen = false" />

    <FloatingReactionsHost v-if="isOnline" />

    <MockBadge />
  </div>
</template>
