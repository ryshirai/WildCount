<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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

/** Room settings accordion (default collapsed — start without scrolling). */
const settingsOpen = ref(false)

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

/** One-line summary for the collapsed「ルーム設定」header. */
const settingsSummary = computed(() => {
  const view = onlineGame.view
  if (!view) return '山札・勝利条件・ルール・制限時間'
  const deck = view.deck
  let deckPart = '山札'
  if (deck) {
    const num = deck.numbers.reduce((s, n) => s + n.count, 0)
    const sp = deck.specials
    const total =
      num +
      sp.double +
      (sp.half ?? 0) +
      sp.max_to_zero +
      sp.redraw +
      sp.zero_mix
    const label = deck.label?.trim() || '山札'
    deckPart = `${label} ${total}枚`
  }
  const winPart =
    view.winCondition === 'last_standing' ? '勝ち残り' : '一人脱落'
  const er = view.extraRules
  const extraKeys: (keyof WireExtraRules)[] = [
    'same',
    'change',
    'reverse',
    'shot',
    'draw1',
    'lifeDouble',
  ]
  const extraOn = er
    ? extraKeys.filter((k) => er[k]).length
    : 0
  const extraPart =
    extraOn === 0 ? 'エクストラなし' : `エクストラ ${extraOn}`
  const tc = view.timeControl
  let timePart = '制限なし'
  if (tc) {
    const main =
      tc.mainSeconds >= 60 && tc.mainSeconds % 60 === 0
        ? `${tc.mainSeconds / 60}分`
        : `${tc.mainSeconds}秒`
    timePart = `${main}+${tc.turnSeconds}秒`
  }
  return `${deckPart} · ${winPart} · ${extraPart} · ${timePart}`
})

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
    showToast('つながっているときだけ変更できます')
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
    showToast('つながっているときだけ変更できます')
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
    showToast('つながっているときだけ変更できます')
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
    showToast('つながっているときだけ変更できます')
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
    showToast('つながっているときだけ変更できます')
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
    R2 shell: fixed chrome (header + sticky CTA) + scrollable body.
    Host can start without scrolling when settings stay collapsed.
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
        class="relative mx-auto w-full max-w-2xl px-4 py-5 lg:max-w-4xl lg:py-6"
      >
        <!-- Disconnect / reconnect (P1-4) -->
        <div
          v-if="showDisconnectBanner"
          class="mb-4 flex flex-col gap-2 rounded-2xl border border-red-400/30 bg-red-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-red-100">
            {{
              onlineGame.reconnecting
                ? `再接続中…（試行 ${onlineGame.reconnectAttempt}）`
                : onlineGame.lastError ?? '接続が切断されました'
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
          class="mb-4 rounded-2xl border border-gold-400/20 bg-night-900/60 px-4 py-3 text-center text-sm text-sand-dim"
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

        <!-- Room code hero -->
        <section class="panel mb-4 p-4 text-center sm:mb-5 sm:p-5">
          <p class="mb-1 text-xs text-sand-dim">ルームコード</p>
          <div class="mb-2 flex items-center justify-center gap-2">
            <span
              class="font-mono text-3xl font-bold tracking-[0.25em] text-gold-200 sm:text-4xl"
            >
              {{ roomCode }}
            </span>
          </div>
          <button
            type="button"
            class="btn-ghost btn-sm relative"
            :class="copied ? 'copy-flash' : ''"
            @click="copyCode"
          >
            <FxSparkleBurst v-if="copied" density="sm" palette="gold" />
            {{ copied ? 'コピー済み' : 'コードをコピー' }}
          </button>
          <p class="mt-2 text-xs text-sand-dim">
            このコードを友だちに送って、ルームに入ってもらいましょう
          </p>
        </section>

        <!-- Profile (online) — secondary to start/gather -->
        <section
          v-if="isOnline"
          class="panel mb-4 space-y-4 p-4 sm:mb-5 sm:p-5"
        >
          <label class="block">
            <span class="field-label !text-gold-200">表示名</span>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                v-model="nameDraft"
                type="text"
                maxlength="12"
                autocomplete="nickname"
                placeholder="例: コヨーテ"
                class="field min-w-0 flex-1 !py-2.5"
                @keydown.enter.prevent="applyDisplayName"
              />
              <button
                type="button"
                class="btn-ghost btn-sm shrink-0"
                :disabled="onlineGame.connection !== 'open'"
                @click="applyDisplayName"
              >
                変更する
              </button>
            </div>
            <p class="mt-1.5 text-[11px] text-sand-dim">
              最大12文字。席とチャットに表示されます
            </p>
          </label>

          <div>
            <AvatarPicker
              v-model="avatarDraft"
              label="アイコン"
              :disabled="onlineGame.connection !== 'open'"
              @update:model-value="onAvatarPick"
            />
            <p class="mt-1.5 text-[11px] text-sand-dim">
              タップですぐ反映。カタログ 15 種・他の人と被っても構いません
            </p>
          </div>
        </section>

        <!--
          Main IA: lg 2-col (players | chat + settings).
          SP: players first, then settings accordion, then chat.
        -->
        <div
          class="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5"
        >
          <!-- Left: participants (hero) -->
          <section class="panel order-1 p-4 sm:p-5 lg:order-none">
            <div class="mb-4 flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold text-gold-200">参加者</h2>
              <span class="chip chip-muted">
                {{ players.length }} / {{ maxPlayers }}人
              </span>
            </div>

            <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <li
                v-for="p in players"
                :key="p.id"
                class="lobby-join-in flex flex-col items-center rounded-xl border border-gold-400/15 bg-night-900/50 px-3 py-4"
                :class="[
                  p.isSelf ? 'ring-1 ring-teal-soft/50' : '',
                  isOnline && 'connected' in p && !p.connected
                    ? 'opacity-50'
                    : '',
                ]"
              >
                <PlayerAvatar
                  :avatar="p.avatar"
                  :avatar-src="p.avatarSrc"
                  :name="p.name"
                  :self="p.isSelf"
                  size="md"
                >
                  <template #status>
                    <div
                      class="mt-0.5 flex flex-wrap items-center justify-center gap-1"
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
                        :class="[
                          p.isReady
                            ? 'lobby-ready-pop bg-teal-deep/50 text-teal-soft'
                            : 'bg-night-700 text-sand-dim',
                        ]"
                      >
                        {{ p.isReady ? '✓ 準備OK' : '待機中' }}
                      </span>
                    </div>
                  </template>
                </PlayerAvatar>
              </li>

              <li
                v-for="n in Math.min(2, maxPlayers - players.length)"
                :key="`empty-${n}`"
                class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold-400/15 bg-night-900/20 px-3 py-6 text-center"
              >
                <span class="mb-1 text-2xl opacity-40" aria-hidden="true">＋</span>
                <span class="text-[11px] text-sand-dim">空き席</span>
              </li>
            </ul>

            <p class="mt-4 text-center text-xs text-sand-dim">
              準備完了 {{ readyCount }} / {{ players.length }}
              <template v-if="isOnline">
                <span v-if="isHost && readyCount < players.length">
                  · 全員の準備完了後に開始できます
                </span>
                <span v-else-if="!isHost"> · ホストの開始を待っています</span>
              </template>
              <span v-else-if="!isHost"> · ホストの開始を待っています</span>
            </p>
          </section>

          <!-- Right column: settings accordion + chat -->
          <div
            v-if="isOnline"
            class="order-2 flex flex-col gap-4 lg:order-none"
          >
            <!-- Room settings: single accordion (default collapsed) -->
            <section class="panel overflow-hidden p-0" aria-label="ルーム設定">
              <button
                type="button"
                class="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:px-5 sm:py-4"
                :aria-expanded="settingsOpen"
                @click="settingsOpen = !settingsOpen"
              >
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gold-200">ルーム設定</p>
                  <p class="mt-0.5 truncate text-[11px] text-sand-dim">
                    {{ settingsSummary }}
                  </p>
                </div>
                <span
                  class="shrink-0 text-xs text-sand-dim"
                  aria-hidden="true"
                >
                  {{ settingsOpen ? '閉じる' : '開く' }}
                </span>
              </button>

              <div
                v-if="settingsOpen"
                class="space-y-3 border-t border-gold-400/15 px-3 pb-4 pt-3 sm:px-4"
              >
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
            </section>

            <!-- Chat (fixed height; stamps via ChatPanel) -->
            <section
              class="h-52 min-h-[12rem] sm:h-60 lg:h-64"
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

    <!-- Sticky CTA bar: always visible (leave is header-only) -->
    <div
      class="z-20 shrink-0 border-t border-gold-400/15 bg-night-900/95 backdrop-blur-md safe-bottom"
      role="region"
      aria-label="ロビー操作"
    >
      <div
        class="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3 lg:max-w-4xl"
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

        <button
          v-if="isHost"
          type="button"
          class="btn-gold w-full sm:min-w-[12rem] sm:flex-1 sm:max-w-xs"
          :disabled="!canStart || starting"
          @click="startGame"
        >
          {{
            starting
              ? '開始中…'
              : isOnline && readyCount < players.length
                ? `開始（準備 ${readyCount}/${players.length}）`
                : 'ゲームを開始'
          }}
        </button>
        <div
          v-else
          class="w-full rounded-xl border border-gold-400/20 bg-night-800/60 px-4 py-3 text-center text-sm text-sand-dim sm:min-w-[12rem] sm:max-w-xs"
        >
          {{
            isOnline && readyCount < players.length
              ? '全員の準備完了待ち…'
              : 'ホストの開始待ち…'
          }}
        </div>

        <button
          v-if="isOnline && isHost"
          type="button"
          class="btn-danger btn-sm w-full sm:w-auto"
          @click="requestDissolveRoom"
        >
          ルームを解散
        </button>
      </div>
    </div>

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
