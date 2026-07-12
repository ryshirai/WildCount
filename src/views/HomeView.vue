<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import MockBadge from '@/components/common/MockBadge.vue'

const router = useRouter()

const roomCode = ref('')
const playerName = ref('')
const toast = ref<string | null>(null)

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = null
  }, 2200)
}

function normalizeCode(raw: string) {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

function onCodeInput(e: Event) {
  const el = e.target as HTMLInputElement
  roomCode.value = normalizeCode(el.value)
}

function createRoom() {
  // Mock: always go to lobby as host
  showToast('（モック）ルームを作成しました')
  void router.push({ name: 'lobby', query: { host: '1' } })
}

function joinRoom() {
  const code = roomCode.value.trim()
  if (code.length < 4) {
    showToast('ルームコードを入力してください')
    return
  }
  showToast(`（モック）${code} に参加`)
  void router.push({ name: 'lobby', query: { code, host: '0' } })
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col desert-bg">
    <div class="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8 sm:py-12">
      <!-- Hero -->
      <header class="mb-8 flex flex-col items-center text-center sm:mb-10">
        <AppLogo size="lg" />
        <p class="mt-3 max-w-sm text-sm text-sand-dim sm:text-base">
          数字推理・ブラフのリアルタイム対戦
        </p>
      </header>

      <!-- Create -->
      <section class="panel mb-4 p-5 sm:p-6">
        <h2 class="mb-1 text-sm font-semibold text-gold-200">ルームを作成</h2>
        <p class="mb-4 text-xs text-sand-dim">ホストとして新しいルームを開き、コードを共有します</p>
        <label class="mb-3 block">
          <span class="mb-1.5 block text-xs text-sand-dim">表示名（任意・モック）</span>
          <input
            v-model="playerName"
            type="text"
            maxlength="12"
            placeholder="あなた"
            class="w-full rounded-xl border border-gold-400/25 bg-night-900/80 px-4 py-3 text-sm text-sand outline-none transition placeholder:text-sand-dim/50 focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
          />
        </label>
        <button type="button" class="btn-gold w-full" @click="createRoom">
          ルームを作成する
        </button>
      </section>

      <!-- Divider -->
      <div class="mb-4 flex items-center gap-3 px-1">
        <div class="h-px flex-1 bg-gold-400/15" />
        <span class="text-xs text-sand-dim">または</span>
        <div class="h-px flex-1 bg-gold-400/15" />
      </div>

      <!-- Join -->
      <section class="panel p-5 sm:p-6">
        <h2 class="mb-1 text-sm font-semibold text-gold-200">ルームに参加</h2>
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
            class="w-full rounded-xl border border-gold-400/25 bg-night-900/80 px-4 py-3 font-mono text-lg tracking-[0.2em] text-gold-100 outline-none transition placeholder:tracking-normal placeholder:text-sand-dim/50 focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/30"
            @input="onCodeInput"
            @keydown.enter="joinRoom"
          />
        </label>
        <button type="button" class="btn-teal w-full" @click="joinRoom">
          参加する
        </button>
      </section>

      <!-- Mock nav shortcuts -->
      <nav
        class="mt-8 rounded-2xl border border-gold-400/10 bg-night-900/40 p-4 text-center"
        aria-label="モック画面リンク"
      >
        <p class="mb-3 text-[11px] uppercase tracking-wider text-sand-dim">UI モック導線</p>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <RouterLink to="/lobby" class="btn-ghost text-xs">待機ロビー</RouterLink>
          <RouterLink to="/game" class="btn-ghost text-xs">ゲーム画面</RouterLink>
          <RouterLink to="/result" class="btn-ghost text-xs">結果・公開</RouterLink>
        </div>
      </nav>
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
