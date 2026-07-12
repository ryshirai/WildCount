<script setup lang="ts">
defineProps<{
  roomCode: string
  playerCount: number
  round: number
  mobile?: boolean
  connectionStatus?: 'good' | 'reconnect' | 'offline'
}>()

const emit = defineEmits<{
  help: []
  chat: []
  stamp: []
}>()

const connectionLabel: Record<string, string> = {
  good: '接続良好',
  reconnect: '再接続中',
  offline: 'オフライン',
}
</script>

<template>
  <!-- Desktop header -->
  <header
    v-if="!mobile"
    class="flex items-center justify-between gap-4 border-b border-gold-400/15 bg-night-900/70 px-4 py-3 backdrop-blur-md sm:px-6"
  >
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2.5">
        <div class="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-gold-400/40 shadow-gold-glow">
          <img
            src="/brand/logo-mark.webp"
            alt=""
            width="36"
            height="36"
            class="h-full w-full object-cover"
            decoding="async"
          />
        </div>
        <h1 class="font-display text-xl font-bold tracking-wide text-gold-200">
          Wild Count
        </h1>
      </div>

      <div class="hidden items-center gap-2 sm:flex">
        <span class="text-xs text-sand-dim">ルームコード</span>
        <span class="chip font-mono tracking-wider">{{ roomCode }}</span>
      </div>

      <span class="chip">
        <span aria-hidden="true">👥</span>
        {{ playerCount }} players
      </span>

      <span class="chip">
        <span aria-hidden="true">🔄</span>
        Round {{ round }}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn-ghost !p-2"
        title="遊び方・ルール"
        aria-label="遊び方・ルール"
        @click="emit('help')"
      >
        ?
      </button>
      <button
        type="button"
        class="btn-ghost !p-2"
        title="スタンプ"
        aria-label="スタンプ"
        @click="emit('stamp')"
      >
        😀
      </button>
      <button
        type="button"
        class="btn-ghost !p-2"
        title="チャット"
        aria-label="チャット"
        @click="emit('chat')"
      >
        💬
      </button>
      <button type="button" class="btn-ghost !p-2" title="退出" aria-label="退出">
        ↗
      </button>
    </div>
  </header>

  <!-- Mobile header -->
  <header
    v-else
    class="flex items-center justify-between border-b border-gold-400/15 bg-night-900/80 px-3 py-2.5 backdrop-blur-md"
  >
    <button
      type="button"
      class="btn-ghost !p-2 text-base font-bold"
      title="遊び方・ルール"
      aria-label="遊び方・ルール"
      @click="emit('help')"
    >
      ?
    </button>
    <div class="flex items-center gap-2">
      <div class="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-gold-400/35">
        <img
          src="/brand/logo-mark.webp"
          alt=""
          width="28"
          height="28"
          class="h-full w-full object-cover"
          decoding="async"
        />
      </div>
      <h1 class="font-display text-lg font-bold text-gold-200">Wild Count</h1>
    </div>
    <div class="flex items-center gap-0.5">
      <button
        type="button"
        class="btn-ghost !p-2 text-base"
        title="スタンプ"
        aria-label="スタンプ"
        @click="emit('stamp')"
      >
        😀
      </button>
      <button
        type="button"
        class="btn-ghost !p-2 text-base"
        title="チャット"
        aria-label="チャット"
        @click="emit('chat')"
      >
        💬
      </button>
    </div>
  </header>

  <div
    v-if="mobile"
    class="flex items-center justify-between gap-2 border-b border-gold-400/10 bg-night-900/50 px-3 py-2 text-xs"
  >
    <span class="chip !px-2.5 font-mono">{{ roomCode }}</span>
    <span class="chip !px-2.5">Round {{ round }}</span>
    <span
      class="chip !px-2.5"
      :class="
        connectionStatus === 'good'
          ? 'text-emerald-400'
          : connectionStatus === 'reconnect'
            ? 'text-amber-300'
            : 'text-red-300'
      "
    >
      {{ connectionLabel[connectionStatus ?? 'good'] }}
    </span>
  </div>
</template>
