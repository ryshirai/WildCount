<script setup lang="ts">
/**
 * Game chrome header — AppHeader shell.
 * Left: brand. Right: 設定 / 説明 menus + leave (no room/round/connection chrome).
 */
import { onMounted, onUnmounted, ref } from 'vue'
import AppHeader from '@/components/common/AppHeader.vue'
import AppLogo from '@/components/common/AppLogo.vue'
import { useHapticSettings } from '@/composables/useHapticSettings'
import { useSfxSettings } from '@/composables/useSfxSettings'

withDefaults(
  defineProps<{
    mobile?: boolean
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

const {
  enabled: sfxEnabled,
  volume: sfxVolume,
  toggleEnabled: toggleSfx,
  setVolume: setSfxVolume,
} = useSfxSettings()
const {
  enabled: hapticEnabled,
  supported: hapticSupported,
  toggleEnabled: toggleHaptic,
} = useHapticSettings()

type MenuId = 'settings' | 'help' | null
const openMenu = ref<MenuId>(null)
const rootEl = ref<HTMLElement | null>(null)

function toggleMenu(id: Exclude<MenuId, null>) {
  openMenu.value = openMenu.value === id ? null : id
}

function closeMenu() {
  openMenu.value = null
}

function onHelp() {
  closeMenu()
  emit('help')
}

function onDeck() {
  closeMenu()
  emit('deck')
}

function onDocPointerDown(e: PointerEvent) {
  const t = e.target
  if (!(t instanceof Node)) return
  if (rootEl.value?.contains(t)) return
  closeMenu()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onKeydown)
})

function onVolumeInput(e: Event) {
  const el = e.target as HTMLInputElement
  const n = Number(el.value)
  if (!Number.isFinite(n)) return
  setSfxVolume(n / 100)
}
</script>

<template>
  <AppHeader :sticky="false" :safe-top="safeTop" :compact="mobile">
    <template #brand>
      <AppLogo size="sm" :show-wordmark="!mobile" />
    </template>

    <template #actions>
      <div ref="rootEl" class="flex items-center" :class="mobile ? 'gap-0.5' : 'gap-1.5'">
        <!-- 設定 -->
        <div class="relative">
          <button
            type="button"
            class="btn-ghost"
            :class="mobile ? 'btn-sm !px-2' : 'btn-sm'"
            :aria-expanded="openMenu === 'settings'"
            aria-haspopup="menu"
            title="設定"
            @click="toggleMenu('settings')"
          >
            設定
            <span class="text-[10px] text-sand-dim" aria-hidden="true">▾</span>
          </button>
          <div
            v-if="openMenu === 'settings'"
            role="menu"
            class="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-gold-400/25 bg-night-900 p-2 shadow-panel"
          >
            <div class="px-2 py-1.5">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-xs font-medium text-gold-200">効果音</p>
                  <p class="text-[10px] text-sand-dim">宣言・手番・コヨーテなど</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  class="btn-ghost btn-sm shrink-0 !px-2.5"
                  :aria-pressed="sfxEnabled"
                  @click="toggleSfx()"
                >
                  {{ sfxEnabled ? 'ON' : 'OFF' }}
                </button>
              </div>
              <label
                v-if="sfxEnabled"
                class="mt-2 block"
              >
                <span class="mb-1 block text-[10px] text-sand-dim">音量</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  class="w-full accent-gold-300"
                  :value="Math.round(sfxVolume * 100)"
                  @input="onVolumeInput"
                />
              </label>
            </div>
            <div class="my-1 border-t border-gold-400/10" />
            <div class="flex items-center justify-between gap-2 px-2 py-1.5">
              <div class="min-w-0">
                <p class="text-xs font-medium text-gold-200">触覚</p>
                <p class="text-[10px] text-sand-dim">
                  {{ hapticSupported ? 'バイブ（任意）' : 'この端末は非対応' }}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                class="btn-ghost btn-sm shrink-0 !px-2.5"
                :disabled="!hapticSupported"
                :aria-pressed="hapticEnabled"
                @click="toggleHaptic()"
              >
                {{ hapticEnabled && hapticSupported ? 'ON' : 'OFF' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 説明 -->
        <div class="relative">
          <button
            type="button"
            class="btn-ghost"
            :class="mobile ? 'btn-sm !px-2' : 'btn-sm'"
            :aria-expanded="openMenu === 'help'"
            aria-haspopup="menu"
            title="説明"
            @click="toggleMenu('help')"
          >
            説明
            <span class="text-[10px] text-sand-dim" aria-hidden="true">▾</span>
          </button>
          <div
            v-if="openMenu === 'help'"
            role="menu"
            class="absolute right-0 top-full z-40 mt-1.5 w-48 overflow-hidden rounded-xl border border-gold-400/25 bg-night-900 py-1 shadow-panel"
          >
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sand transition hover:bg-night-800/80"
              @click="onHelp"
            >
              <span class="w-5 text-center font-bold text-gold-200" aria-hidden="true">?</span>
              遊び方・ルール
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sand transition hover:bg-night-800/80"
              @click="onDeck"
            >
              <span class="w-5 text-center font-display text-xs font-bold text-gold-200" aria-hidden="true">山</span>
              この対戦の山札
            </button>
          </div>
        </div>

        <button
          type="button"
          class="btn-ghost"
          :class="mobile ? 'btn-sm !px-2' : 'btn-sm'"
          title="ゲームを終了して退出"
          aria-label="ゲームを終了して退出"
          @click="emit('leave')"
        >
          退出
        </button>
      </div>
    </template>
  </AppHeader>
</template>
