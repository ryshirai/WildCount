<script setup lang="ts">
defineProps<{
  roomCode: string
  playerCount: number
  round: number
  mobile?: boolean
  connectionStatus?: 'good' | 'reconnect' | 'offline'
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
        <div
          class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold-300/30 to-night-800 ring-1 ring-gold-400/40"
        >
          <span class="text-lg" aria-hidden="true">🐺</span>
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
      <button type="button" class="btn-ghost !p-2" title="チャット（MVP外）" aria-label="チャット">
        💬
      </button>
      <button type="button" class="btn-ghost !p-2" title="設定" aria-label="設定">
        ⚙️
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
    <button type="button" class="btn-ghost !p-2 text-base" aria-label="メニュー">☰</button>
    <h1 class="font-display text-lg font-bold text-gold-200">Wild Count</h1>
    <button type="button" class="btn-ghost !p-2 text-base" aria-label="設定">⚙️</button>
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
