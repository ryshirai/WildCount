<script setup lang="ts">
/**
 * Game chrome header — AppHeader shell (R5).
 * Desktop: brand + room/meta chips left, actions right.
 * Mobile: compact single row (R4) with connection StatusChip.
 */
import AppHeader from '@/components/common/AppHeader.vue'
import AppLogo from '@/components/common/AppLogo.vue'
import StatusChip from '@/components/common/StatusChip.vue'

withDefaults(
  defineProps<{
    roomCode: string
    playerCount: number
    round: number
    mobile?: boolean
    connectionStatus?: 'good' | 'reconnect' | 'offline'
    /** When false, parent banner owns safe-top (disconnect strip above). */
    safeTop?: boolean
  }>(),
  { mobile: false, safeTop: true },
)

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
  <AppHeader :sticky="false" :safe-top="safeTop" :compact="mobile">
    <template #brand>
      <!-- Desktop: logo + room meta near brand (scan left→right) -->
      <div
        v-if="!mobile"
        class="flex min-w-0 items-center gap-3 sm:gap-4"
      >
        <AppLogo size="sm" />
        <div class="hidden items-center gap-2 sm:flex">
          <span class="text-xs text-sand-dim">ルーム</span>
          <StatusChip class="font-mono tracking-wider" :label="roomCode" />
        </div>
        <StatusChip variant="muted" :label="`${playerCount}人`" />
        <StatusChip variant="muted" :label="`ラウンド ${round}`" />
      </div>

      <!-- Mobile: mark + code + round + connection -->
      <div v-else class="flex min-w-0 items-center gap-1.5">
        <AppLogo size="sm" :show-wordmark="false" />
        <StatusChip
          class="!px-1.5 !py-0.5 font-mono text-[10px] tracking-wider"
          :label="roomCode"
          :title="`ルーム ${roomCode}`"
        />
        <StatusChip
          variant="muted"
          class="!px-1.5 !py-0.5 text-[10px]"
          :label="`R${round}`"
        />
        <StatusChip
          v-if="connectionStatus"
          :variant="connectionVariant(connectionStatus)"
          class="!px-1.5 !py-0.5 text-[10px]"
          :label="connectionLabel[connectionStatus]"
        />
      </div>
    </template>

    <template #actions>
      <button
        type="button"
        class="btn-ghost btn-icon"
        :class="mobile ? '!p-1.5 text-sm font-bold' : 'text-sm font-bold'"
        title="遊び方・ルール"
        aria-label="遊び方・ルール"
        @click="emit('help')"
      >
        ?
      </button>
      <button
        type="button"
        class="btn-ghost btn-icon font-display font-bold"
        :class="mobile ? '!p-1.5 text-xs' : 'text-sm'"
        title="この対戦の山札"
        aria-label="この対戦の山札"
        @click="emit('deck')"
      >
        山
      </button>
      <button
        type="button"
        class="btn-ghost"
        :class="mobile ? '!px-1.5 !py-1.5 text-[11px] font-medium' : 'btn-sm'"
        title="ゲームを終了して退出"
        aria-label="ゲームを終了して退出"
        @click="emit('leave')"
      >
        退出
      </button>
    </template>
  </AppHeader>
</template>
