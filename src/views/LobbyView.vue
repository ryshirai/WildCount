<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'
import { mockLobby } from '@/data/mockLobby'
import { AVATAR_ASSETS, avatarSrc } from '@/localGame/avatarCatalog'
import { buildDemoLineup, DEFAULT_PROFILES } from '@/localGame/profiles'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'
import type { LobbyPlayer } from '@/types/game'

const router = useRouter()
const route = useRoute()
const localGame = useLocalGameStore()
const onlineGame = useOnlineGameStore()

const toast = ref<string | null>(null)
const copied = ref(false)
const starting = ref(false)
const resumeBusy = ref(false)
const resumeFailed = ref(false)

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
  const i = typeof index === 'number' ? index % AVATAR_ASSETS.length : 0
  const meta = AVATAR_ASSETS[i]!
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

const connectionLabel = computed(() => {
  if (onlineGame.reconnecting) return '再接続中…'
  switch (onlineGame.connection) {
    case 'open':
      return '接続中'
    case 'connecting':
      return '接続中…'
    case 'closed':
      return '切断'
    case 'error':
      return 'エラー'
    default:
      return ''
  }
})

const showDisconnectBanner = computed(
  () =>
    isOnline.value &&
    (onlineGame.connection === 'closed' ||
      onlineGame.connection === 'error' ||
      (onlineGame.reconnecting && onlineGame.connection !== 'open')),
)

const selfReady = computed(() => {
  const me = players.value.find((p) => p.isSelf)
  return me?.isReady ?? false
})

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = null
  }, 2200)
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
      showToast('ホストのみ・2人以上で開始できます')
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
</script>

<template>
  <div class="page-scroll desert-bg safe-x">
    <!-- Header -->
    <header
      class="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-gold-400/15 bg-night-900/90 px-4 py-3 backdrop-blur-md safe-top sm:px-6"
    >
      <AppLogo size="sm" />
      <div class="flex items-center gap-2">
        <span
          v-if="isOnline"
          class="chip text-[10px]"
          :class="
            onlineGame.connection === 'open'
              ? '!border-teal-soft/30 !text-teal-soft'
              : '!border-red-400/30 !text-red-200'
          "
        >
          {{ connectionLabel }}
        </span>
        <button type="button" class="btn-ghost text-xs" @click="leaveLobby">退出</button>
      </div>
    </header>

    <div
      class="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 safe-bottom sm:py-8"
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
          type="button"
          class="btn-ghost shrink-0 text-xs"
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
        ルームに接続できませんでした。ホームからコードで再参加するか、Worker を確認してください。
        <button type="button" class="btn-ghost mt-2 text-xs" @click="leaveLobby">
          ホームへ
        </button>
      </div>

      <!-- Room code block -->
      <section class="panel mb-6 p-5 text-center sm:p-6">
        <p class="mb-1 text-xs text-sand-dim">ルームコード</p>
        <div class="mb-3 flex items-center justify-center gap-2">
          <span
            class="font-mono text-3xl font-bold tracking-[0.25em] text-gold-200 sm:text-4xl"
          >
            {{ roomCode }}
          </span>
        </div>
        <button type="button" class="btn-ghost text-xs" @click="copyCode">
          {{ copied ? 'コピー済み' : 'コードをコピー' }}
        </button>
        <p class="mt-3 text-xs text-sand-dim">
          友達にこのコードを共有して参加してもらいましょう
        </p>
      </section>

      <!-- Participants -->
      <section class="panel mb-6 flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <div class="mb-4 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-gold-200">参加者</h2>
          <span class="chip">
            <span aria-hidden="true">👥</span>
            {{ players.length }} / {{ maxPlayers }}
          </span>
        </div>

        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <li
            v-for="p in players"
            :key="p.id"
            class="flex flex-col items-center rounded-xl border border-gold-400/15 bg-night-900/50 px-3 py-4"
            :class="[
              p.isSelf ? 'ring-1 ring-teal-soft/50' : '',
              isOnline && 'connected' in p && !p.connected ? 'opacity-50' : '',
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
                <div class="mt-0.5 flex flex-wrap items-center justify-center gap-1">
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
                    class="rounded px-1.5 py-0.5 text-[10px]"
                    :class="p.isReady ? 'bg-teal-deep/50 text-teal-soft' : 'bg-night-700 text-sand-dim'"
                  >
                    {{ p.isReady ? '準備OK' : '待機中' }}
                  </span>
                </div>
              </template>
            </PlayerAvatar>
          </li>

          <!-- Empty slots hint -->
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
          <span v-if="!isHost"> · ホストの開始を待っています</span>
        </p>
      </section>

      <!-- Actions -->
      <div class="flex flex-col gap-3 safe-bottom sm:flex-row sm:justify-center">
        <button
          v-if="isOnline"
          type="button"
          class="btn-ghost w-full sm:max-w-[10rem]"
          @click="toggleReady"
        >
          {{ selfReady ? '準備を取り消す' : '準備完了' }}
        </button>
        <button
          v-if="isHost"
          type="button"
          class="btn-gold w-full sm:max-w-xs"
          :disabled="!canStart || starting"
          @click="startGame"
        >
          {{ starting ? '開始中…' : 'ゲームを開始' }}
        </button>
        <div
          v-else
          class="w-full rounded-xl border border-gold-400/20 bg-night-800/60 px-5 py-3 text-center text-sm text-sand-dim sm:max-w-xs"
        >
          ホストの開始待ち…
        </div>
        <button type="button" class="btn-ghost w-full sm:w-auto" @click="leaveLobby">
          ロビーを退出
        </button>
      </div>
    </div>

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
        class="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-gold-400/30 bg-night-800/95 px-4 py-2 text-sm text-gold-100 shadow-panel"
      >
        {{ toast }}
      </div>
    </Transition>

    <MockBadge />
  </div>
</template>
