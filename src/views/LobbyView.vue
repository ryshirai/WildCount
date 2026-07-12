<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mockLobby } from '@/data/mockLobby'
import { DEFAULT_PROFILES } from '@/localGame/profiles'
import { useLocalGameStore } from '@/stores/localGame'
import AppLogo from '@/components/common/AppLogo.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import PlayerAvatar from '@/components/game/PlayerAvatar.vue'
import type { LobbyPlayer } from '@/types/game'

const router = useRouter()
const route = useRoute()
const localGame = useLocalGameStore()

const toast = ref<string | null>(null)
const copied = ref(false)

/** Host when query host=1 or default mock */
const isHost = computed(() => {
  if (route.query.host === '0') return false
  if (route.query.host === '1') return true
  return mockLobby.isHost
})

const roomCode = computed(() => {
  const q = route.query.code
  if (typeof q === 'string' && q.length > 0) return q.toUpperCase()
  return mockLobby.roomCode
})

/** Local demo lobby: self + bots (engine lineup), not full mock list. */
const players = computed<LobbyPlayer[]>(() =>
  DEFAULT_PROFILES.map((p, i) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    avatarSrc: p.avatarSrc,
    isHost: i === 0,
    isSelf: i === 0,
    isReady: true,
  })),
)
const maxPlayers = 10
const readyCount = computed(() => players.value.filter((p) => p.isReady).length)
const canStart = computed(() => isHost.value && players.value.length >= 2)

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = null
  }, 2200)
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

function startGame() {
  if (!canStart.value) {
    showToast('ホストのみ開始できます（2人以上）')
    return
  }
  localGame.startLocalGame({
    roomCode: roomCode.value,
    initialLives: 3,
    deck: 'standard',
  })
  void router.push({ name: 'game' })
}

function leaveLobby() {
  void router.push({ name: 'home' })
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col desert-bg">
    <!-- Header -->
    <header
      class="flex items-center justify-between gap-3 border-b border-gold-400/15 bg-night-900/70 px-4 py-3 backdrop-blur-md sm:px-6"
    >
      <AppLogo size="sm" />
      <button type="button" class="btn-ghost text-xs" @click="leaveLobby">退出</button>
    </header>

    <div class="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:py-8">
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
            :class="p.isSelf ? 'ring-1 ring-teal-soft/50' : ''"
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
          v-if="isHost"
          type="button"
          class="btn-gold w-full sm:max-w-xs"
          :disabled="players.length < 2"
          @click="startGame"
        >
          ゲームを開始
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
