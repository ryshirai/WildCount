<script setup lang="ts">
import StatusChip from '@/components/common/StatusChip.vue'

defineProps<{
  roomCode: string
  playerCount: number
  round: number
  mobile?: boolean
  connectionStatus?: 'good' | 'reconnect' | 'offline'
}>()

const emit = defineEmits<{
  help: []
  deck: []
  leave: []
}>()

const connectionLabel: Record<string, string> = {
  good: '接続良好',
  reconnect: '再接続中',
  offline: 'オフライン',
}

function connectionVariant(
  status: 'good' | 'reconnect' | 'offline' | undefined,
): 'teal' | 'gold' | 'danger' {
  if (status === 'reconnect') return 'gold'
  if (status === 'offline') return 'danger'
  return 'teal'
}
</script>

<template>
  <!-- Desktop header -->
  <header
    v-if="!mobile"
    class="flex items-center justify-between gap-4 border-b border-gold-400/15 bg-night-900/70 px-4 py-3 backdrop-blur-md sm:px-6"
  >
    <div class="flex min-w-0 items-center gap-4">
      <div class="flex items-center gap-2.5">
        <div
          class="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-gold-400/40 shadow-gold-glow"
        >
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

      <StatusChip variant="muted">{{ playerCount }}人</StatusChip>
      <StatusChip variant="muted">ラウンド {{ round }}</StatusChip>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn-ghost btn-icon"
        title="遊び方・ルール"
        aria-label="遊び方・ルール"
        @click="emit('help')"
      >
        ?
      </button>
      <button
        type="button"
        class="btn-ghost btn-icon font-display text-sm font-bold"
        title="この対戦の山札"
        aria-label="この対戦の山札"
        @click="emit('deck')"
      >
        山
      </button>
      <button
        type="button"
        class="btn-ghost btn-sm"
        title="ゲームを終了して退出"
        aria-label="ゲームを終了して退出"
        @click="emit('leave')"
      >
        退出
      </button>
    </div>
  </header>

  <!-- Mobile: single row (R4) — no sub-row -->
  <header
    v-else
    class="flex items-center gap-1.5 border-b border-gold-400/15 bg-night-900/80 px-2 py-1.5 backdrop-blur-md"
  >
    <div
      class="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-gold-400/35"
    >
      <img
        src="/brand/logo-mark.webp"
        alt=""
        width="28"
        height="28"
        class="h-full w-full object-cover"
        decoding="async"
      />
    </div>

    <span
      class="chip !px-1.5 !py-0.5 font-mono text-[10px] tracking-wider"
      :title="`ルーム ${roomCode}`"
    >
      {{ roomCode }}
    </span>
    <StatusChip variant="muted" class="!px-1.5 !py-0.5 text-[10px]">
      R{{ round }}
    </StatusChip>
    <StatusChip
      v-if="connectionStatus"
      :variant="connectionVariant(connectionStatus)"
      class="!px-1.5 !py-0.5 text-[10px]"
    >
      {{ connectionLabel[connectionStatus] }}
    </StatusChip>

    <div class="ml-auto flex shrink-0 items-center gap-0">
      <button
        type="button"
        class="btn-ghost btn-icon !p-1.5 text-sm font-bold"
        title="遊び方・ルール"
        aria-label="遊び方・ルール"
        @click="emit('help')"
      >
        ?
      </button>
      <button
        type="button"
        class="btn-ghost btn-icon !p-1.5 font-display text-xs font-bold"
        title="この対戦の山札"
        aria-label="この対戦の山札"
        @click="emit('deck')"
      >
        山
      </button>
      <button
        type="button"
        class="btn-ghost !px-1.5 !py-1.5 text-[11px] font-medium"
        title="ゲームを終了して退出"
        aria-label="ゲームを終了して退出"
        @click="emit('leave')"
      >
        退出
      </button>
    </div>
  </header>
</template>
