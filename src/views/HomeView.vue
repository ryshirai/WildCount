<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import {
  buildDemoLineup,
  type DemoPlayerCount,
} from '@/localGame/profiles'
import { loadSavedDisplayName } from '@/online/resumeStorage'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'

const router = useRouter()
const localGame = useLocalGameStore()
const onlineGame = useOnlineGameStore()

const roomCode = ref('')
const playerName = ref(loadSavedDisplayName())
const toast = ref<string | null>(null)
const onlineBusy = ref(false)

/** Local demo options (B6) */
const demoPlayerCount = ref<DemoPlayerCount>(4)
const demoSelfName = ref('')
const demoSeed = ref('')
const showDemoAdvanced = ref(false)
const demoStarting = ref(false)

const demoSeedParsed = computed(() => {
  const raw = demoSeed.value.trim()
  if (!raw) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined
  return n >>> 0
})

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = null
  }, 2800)
}

function normalizeCode(raw: string) {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
}

function onCodeInput(e: Event) {
  const el = e.target as HTMLInputElement
  roomCode.value = normalizeCode(el.value)
}

async function createRoom() {
  if (onlineBusy.value) return
  onlineBusy.value = true
  try {
    // Leave any previous online session
    if (onlineGame.isOnlineSession) onlineGame.leave()
    const code = await onlineGame.createRoom(playerName.value)
    showToast(`ルーム ${code} を作成しました`)
    await router.push({ name: 'lobby', query: { code, online: '1' } })
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'ルーム作成に失敗しました')
  } finally {
    onlineBusy.value = false
  }
}

async function joinRoom() {
  if (onlineBusy.value) return
  const code = roomCode.value.trim()
  if (code.length < 4) {
    showToast('ルームコードを入力してください')
    return
  }
  onlineBusy.value = true
  try {
    if (onlineGame.isOnlineSession) onlineGame.leave()
    await onlineGame.joinRoom(code, playerName.value)
    showToast(`${code} に参加しました`)
    await router.push({
      name: 'lobby',
      query: { code: onlineGame.roomCode ?? code, online: '1' },
    })
  } catch (e) {
    showToast(e instanceof Error ? e.message : '参加に失敗しました')
  } finally {
    onlineBusy.value = false
  }
}

async function startLocalDemo() {
  if (demoStarting.value) return
  demoStarting.value = true
  try {
    // Ensure online session does not interfere
    if (onlineGame.isOnlineSession) onlineGame.leave()
    const profiles = buildDemoLineup({
      playerCount: demoPlayerCount.value,
      selfName: demoSelfName.value || undefined,
    })
    await localGame.startLocalGame({
      profiles,
      seed: demoSeedParsed.value,
      roomCode: 'LOCAL',
    })
    await router.push({ name: 'game' })
  } finally {
    demoStarting.value = false
  }
}
</script>

<template>
  <div class="page-scroll desert-bg safe-x">
    <div
      class="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8 safe-bottom sm:py-12"
    >
      <!-- Hero -->
      <header class="mb-8 flex flex-col items-center text-center sm:mb-10">
        <AppLogo size="lg" />
        <p class="mt-3 max-w-sm text-sm text-sand-dim sm:text-base">
          数字推理・ブラフのリアルタイム対戦
        </p>
      </header>

      <!-- Local engine demo (primary for solo demo) -->
      <section class="panel mb-4 p-5 ring-1 ring-gold-400/25 sm:p-6">
        <div class="mb-1 flex items-center justify-center gap-2">
          <span class="chip !border-teal-soft/30 !bg-teal-deep/35 !text-teal-soft text-[10px]">
            一人デモ
          </span>
        </div>
        <h2 class="mb-1 text-center text-sm font-semibold text-gold-200">
          ローカル対戦
        </h2>
        <p class="mb-4 text-center text-xs text-sand-dim">
          Worker なし・ボットとブラウザだけで宣言 → コヨーテ → 結果まで遊べます
        </p>

        <label class="mb-3 block">
          <span class="mb-1.5 block text-xs text-sand-dim">表示名（任意）</span>
          <input
            v-model="demoSelfName"
            type="text"
            maxlength="12"
            placeholder="あなた"
            class="w-full rounded-xl border border-gold-400/25 bg-night-900/80 px-4 py-3 text-sm text-sand outline-none transition placeholder:text-sand-dim/50 focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
          />
        </label>

        <fieldset class="mb-4">
          <legend class="mb-1.5 text-xs text-sand-dim">人数（あなた + ボット）</legend>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="rounded-xl border px-3 py-2.5 text-sm font-medium transition"
              :class="
                demoPlayerCount === 3
                  ? 'border-gold-400/50 bg-gold-400/15 text-gold-100'
                  : 'border-gold-400/20 bg-night-900/60 text-sand-dim hover:border-gold-400/35'
              "
              @click="demoPlayerCount = 3"
            >
              3人
              <span class="mt-0.5 block text-[10px] font-normal opacity-80">ボット2</span>
            </button>
            <button
              type="button"
              class="rounded-xl border px-3 py-2.5 text-sm font-medium transition"
              :class="
                demoPlayerCount === 4
                  ? 'border-gold-400/50 bg-gold-400/15 text-gold-100'
                  : 'border-gold-400/20 bg-night-900/60 text-sand-dim hover:border-gold-400/35'
              "
              @click="demoPlayerCount = 4"
            >
              4人
              <span class="mt-0.5 block text-[10px] font-normal opacity-80">ボット3</span>
            </button>
          </div>
        </fieldset>

        <button
          type="button"
          class="mb-2 w-full text-left text-[11px] text-sand-dim underline-offset-2 hover:text-sand hover:underline"
          @click="showDemoAdvanced = !showDemoAdvanced"
        >
          {{ showDemoAdvanced ? '詳細を閉じる' : '詳細（シード）' }}
        </button>
        <label v-if="showDemoAdvanced" class="mb-4 block">
          <span class="mb-1.5 block text-xs text-sand-dim">
            乱数シード（任意・再現用の整数）
          </span>
          <input
            v-model="demoSeed"
            type="text"
            inputmode="numeric"
            placeholder="空欄で毎回ランダム"
            class="w-full rounded-xl border border-gold-400/25 bg-night-900/80 px-4 py-2.5 font-mono text-sm text-sand outline-none transition placeholder:font-sans placeholder:text-sand-dim/50 focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
          />
        </label>

        <button
          type="button"
          class="btn-gold w-full"
          :disabled="demoStarting"
          @click="startLocalDemo"
        >
          {{ demoStarting ? '開始中…' : 'ローカルデモを開始' }}
        </button>
      </section>

      <!-- Create online room -->
      <section class="panel mb-4 p-5 sm:p-6">
        <div class="mb-1 flex items-center gap-2">
          <h2 class="text-sm font-semibold text-gold-200">ルームを作成</h2>
          <span class="chip text-[10px]">オンライン</span>
        </div>
        <p class="mb-4 text-xs text-sand-dim">
          ホストとしてルームを開き、6 文字コードを共有します（Worker 必要）
        </p>
        <label class="mb-3 block">
          <span class="mb-1.5 block text-xs text-sand-dim">表示名（任意）</span>
          <input
            v-model="playerName"
            type="text"
            maxlength="12"
            placeholder="あなた"
            class="w-full rounded-xl border border-gold-400/25 bg-night-900/80 px-4 py-3 text-sm text-sand outline-none transition placeholder:text-sand-dim/50 focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
          />
        </label>
        <button
          type="button"
          class="btn-gold w-full"
          :disabled="onlineBusy"
          @click="createRoom"
        >
          {{ onlineBusy ? '接続中…' : 'ルームを作成する' }}
        </button>
      </section>

      <!-- Divider -->
      <div class="mb-4 flex items-center gap-3 px-1">
        <div class="h-px flex-1 bg-gold-400/15" />
        <span class="text-xs text-sand-dim">または</span>
        <div class="h-px flex-1 bg-gold-400/15" />
      </div>

      <!-- Join online -->
      <section class="panel p-5 sm:p-6">
        <div class="mb-1 flex items-center gap-2">
          <h2 class="text-sm font-semibold text-gold-200">ルームに参加</h2>
          <span class="chip text-[10px]">オンライン</span>
        </div>
        <p class="mb-4 text-xs text-sand-dim">ホストから共有されたルームコードを入力</p>
        <label class="mb-3 block">
          <span class="mb-1.5 block text-xs text-sand-dim">ルームコード</span>
          <input
            :value="roomCode"
            type="text"
            inputmode="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="例: AB7KQ2"
            maxlength="6"
            class="w-full rounded-xl border border-gold-400/25 bg-night-900/80 px-4 py-3 font-mono text-lg tracking-[0.2em] text-gold-100 outline-none transition placeholder:tracking-normal placeholder:text-sand-dim/50 focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
            @input="onCodeInput"
            @keydown.enter="joinRoom"
          />
        </label>
        <button
          type="button"
          class="btn-teal w-full"
          :disabled="onlineBusy"
          @click="joinRoom"
        >
          {{ onlineBusy ? '接続中…' : '参加する' }}
        </button>
      </section>

      <!-- Dev mock nav -->
      <details
        class="mt-6 rounded-2xl border border-gold-400/10 bg-night-900/40 p-4"
      >
        <summary
          class="cursor-pointer list-none text-center text-[11px] uppercase tracking-wider text-sand-dim marker:content-none [&::-webkit-details-marker]:hidden"
        >
          開発用 · UI モック導線
        </summary>
        <nav class="mt-3 flex flex-wrap items-center justify-center gap-2" aria-label="モック画面リンク">
          <RouterLink to="/lobby" class="btn-ghost text-xs">待機ロビー（モック）</RouterLink>
          <RouterLink to="/game" class="btn-ghost text-xs">ゲーム（エンジン）</RouterLink>
          <RouterLink to="/game?mock=1" class="btn-ghost text-xs">ゲーム（固定モック）</RouterLink>
          <RouterLink to="/result?mock=1" class="btn-ghost text-xs">結果（固定モック）</RouterLink>
        </nav>
        <p class="mt-2 text-center text-[10px] text-sand-dim/80">
          オンラインは上の作成/参加。Worker: <code class="font-mono">npm run worker:dev</code>
        </p>
      </details>
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
