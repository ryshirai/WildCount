<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import AppToast from '@/components/common/AppToast.vue'
import AvatarPicker from '@/components/common/AvatarPicker.vue'
import HelpModal from '@/components/common/HelpModal.vue'
import MockBadge from '@/components/common/MockBadge.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { allowLocalPlay, allowUiMock, isDevBuild } from '@/config/runtime'
import {
  AVATAR_ASSETS,
  type AvatarAssetId,
} from '@/localGame/avatarCatalog'
import {
  buildDemoLineup,
  type DemoPlayerCount,
} from '@/localGame/profiles'
import {
  clearResumeToken,
  loadLastRoomCode,
  loadSavedAvatarIndex,
  loadSavedDisplayName,
  saveAvatarIndex,
} from '@/online/resumeStorage'
import { useHapticSettings } from '@/composables/useHapticSettings'
import { useSfxSettings } from '@/composables/useSfxSettings'
import { useLocalGameStore } from '@/stores/localGame'
import { useOnlineGameStore } from '@/stores/onlineGame'

const router = useRouter()
const localGame = useLocalGameStore()
const onlineGame = useOnlineGameStore()
const {
  enabled: sfxEnabled,
  volume: sfxVolume,
  setEnabled: setSfxEnabled,
  setVolume: setSfxVolume,
} = useSfxSettings()
const {
  enabled: hapticEnabled,
  supported: hapticSupported,
  setEnabled: setHapticEnabled,
} = useHapticSettings()

/** Dev-only surfaces (tree-shaken away from user-facing prod copy). */
const showLocalDemo = allowLocalPlay
const showDevMockNav = allowUiMock

const roomCode = ref('')
const playerName = ref(loadSavedDisplayName())
/** Preferred avatar; kept in sync with online store + localStorage. */
const playerAvatarIndex = ref(loadSavedAvatarIndex())
const toast = ref<string | null>(null)
const helpOpen = ref(false)
const onlineBusy = ref(false)
/** Brief press flash on primary CTAs */
const ctaFlash = ref<'create' | 'join' | 'demo' | 'resume' | null>(null)
let ctaFlashTimer: ReturnType<typeof setTimeout> | null = null

function flashCta(kind: 'create' | 'join' | 'demo' | 'resume') {
  ctaFlash.value = kind
  if (ctaFlashTimer) clearTimeout(ctaFlashTimer)
  ctaFlashTimer = setTimeout(() => {
    if (ctaFlash.value === kind) ctaFlash.value = null
  }, 350)
}
/** Room code with a saved resumeToken (reload recovery). */
const resumableCode = ref<string | null>(null)
const resumeBusy = ref(false)

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
}

function dismissToast() {
  toast.value = null
}

/** Half-width alphanumerics only; full-width (全角) common on JP iOS keyboards. */
function normalizeCode(raw: string) {
  const half = raw.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  )
  return half.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
}

/**
 * Room code field: controlled + uppercase/filter.
 * iOS Safari often drops keystrokes if we rewrite :value mid-composition or
 * leave the DOM value out of sync after filtering.
 */
function applyRoomCodeFromInput(el: HTMLInputElement) {
  const next = normalizeCode(el.value)
  roomCode.value = next
  // Force DOM sync when we stripped / uppercased (iOS controlled-input quirk)
  if (el.value !== next) {
    el.value = next
  }
}

function onCodeInput(e: Event) {
  // Don't fight Japanese IME while composing
  if (e instanceof InputEvent && e.isComposing) return
  applyRoomCodeFromInput(e.target as HTMLInputElement)
}

function onCodeCompositionEnd(e: Event) {
  applyRoomCodeFromInput(e.target as HTMLInputElement)
}

function persistAvatarChoice() {
  saveAvatarIndex(playerAvatarIndex.value)
  onlineGame.updateAvatarIndex(playerAvatarIndex.value)
}

watch(playerAvatarIndex, () => {
  persistAvatarChoice()
})

async function createRoom() {
  if (onlineBusy.value) return
  flashCta('create')
  onlineBusy.value = true
  try {
    // Leave any previous online session
    if (onlineGame.isOnlineSession) onlineGame.leave()
    persistAvatarChoice()
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
  flashCta('join')
  onlineBusy.value = true
  try {
    if (onlineGame.isOnlineSession) onlineGame.leave()
    persistAvatarChoice()
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
  if (!allowLocalPlay || demoStarting.value) return
  flashCta('demo')
  demoStarting.value = true
  try {
    // Ensure online session does not interfere
    if (onlineGame.isOnlineSession) onlineGame.leave()
    const assetId = AVATAR_ASSETS[playerAvatarIndex.value]?.id as
      | AvatarAssetId
      | undefined
    const profiles = buildDemoLineup({
      playerCount: demoPlayerCount.value,
      selfName: demoSelfName.value || undefined,
      selfAvatarId: assetId,
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

function refreshResumable() {
  resumableCode.value = loadLastRoomCode()
}

async function resumeLastRoom() {
  const code = resumableCode.value
  if (!code || resumeBusy.value) return
  flashCta('resume')
  resumeBusy.value = true
  try {
    if (onlineGame.isOnlineSession && onlineGame.roomCode !== code) {
      onlineGame.leave()
    }
    const ok = await onlineGame.ensureSession({
      code,
      name: playerName.value,
    })
    if (!ok) {
      const msg =
        onlineGame.lastError ||
        'ルームに戻れませんでした（解散されたか、すでに終わっているようです）'
      showToast(msg)
      clearResumeToken(code)
      refreshResumable()
      return
    }
    const phase = onlineGame.phase
    if (phase === 'playing' || phase === 'result') {
      await router.push({
        name: phase === 'result' && onlineGame.pendingResult ? 'result' : 'game',
        query: { online: '1', code },
      })
    } else {
      await router.push({ name: 'lobby', query: { code, online: '1' } })
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : '復帰に失敗しました')
    clearResumeToken(code)
    refreshResumable()
  } finally {
    resumeBusy.value = false
  }
}

function dismissResumable() {
  const code = resumableCode.value
  if (code) clearResumeToken(code)
  resumableCode.value = null
}

onMounted(() => {
  refreshResumable()
})

// Host dissolve / purge while guest lands on home
watch(
  () => onlineGame.lastErrorCode,
  (code) => {
    if (code === 'ROOM_CLOSED') {
      refreshResumable()
    }
  },
)

watch(
  () => onlineGame.roomCode,
  () => {
    refreshResumable()
  },
)
</script>

<template>
  <div class="page-scroll desert-bg safe-x">
    <!--
      Shell widths:
      - SP / tablet: single column, max-w-lg (readable phone width)
      - lg+: dedicated desktop home (~1080px), not a stretched phone column
    -->
    <div
      class="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-5 safe-bottom sm:py-6 lg:max-w-[1080px] lg:px-6 lg:py-8"
    >
      <!-- Hero: compact on SP so CTAs stay near first paint -->
      <header
        class="mb-5 flex flex-col items-center text-center sm:mb-6 lg:mb-8"
      >
        <AppLogo size="lg" />
        <p
          class="mt-2.5 max-w-md text-sm leading-relaxed text-sand-dim sm:mt-3 sm:text-base lg:max-w-lg"
        >
          見えている札だけで合計を読み合う、リアルタイムの推理ゲーム
        </p>
        <button
          type="button"
          class="btn-ghost btn-sm mt-3 lg:mt-4"
          @click="helpOpen = true"
        >
          <span class="font-bold text-gold-200" aria-hidden="true">?</span>
          遊び方・ルール
        </button>
      </header>

      <!-- Resume previous online seat (P1-4) -->
      <section
        v-if="resumableCode"
        class="panel mb-4 border border-teal-soft/25 p-4 ring-1 ring-teal-soft/20 sm:p-5"
      >
        <div class="mb-2 flex items-center gap-2">
          <StatusChip variant="teal" class="text-[10px]" label="再接続" />
          <h2 class="text-sm font-semibold text-gold-200 lg:text-base">
            前回のルームに戻る
          </h2>
        </div>
        <p class="mb-3 text-xs text-sand-dim lg:text-sm">
          ルーム
          <span class="font-mono tracking-wider text-gold-100">{{
            resumableCode
          }}</span>
          に、この端末からまた入れます（ページを閉じたあとも大丈夫）
        </p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            class="btn-teal flex-1"
            :class="ctaFlash === 'resume' ? 'btn-fx-press' : ''"
            :disabled="resumeBusy"
            @click="resumeLastRoom"
          >
            {{ resumeBusy ? '戻っています…' : 'ルームに戻る' }}
          </button>
          <button
            type="button"
            class="btn-ghost sm:w-auto"
            :disabled="resumeBusy"
            @click="dismissResumable"
          >
            表示しない
          </button>
        </div>
      </section>

      <!--
        Main IA
        - Mobile: compact profile → create/join CTAs (primary goals near fold)
        - PC: 2-col — profile left, room actions right
      -->
      <div
        class="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6"
      >
        <!-- Profile (compact) -->
        <section
          class="panel flex flex-col p-4 sm:p-5 lg:col-span-5 lg:p-6"
        >
          <h2 class="mb-1 text-sm font-semibold text-gold-200 lg:text-base">
            プロフィール
          </h2>
          <p class="mb-3 text-xs text-sand-dim lg:mb-4 lg:text-sm">
            席とチャットに表示されます。空欄のときは「プレイヤー」になります
          </p>

          <label class="mb-3 block lg:mb-4">
            <span class="field-label">表示名</span>
            <input
              v-model="playerName"
              type="text"
              maxlength="12"
              autocomplete="nickname"
              placeholder="例: コヨーテ"
              class="field"
            />
          </label>

          <AvatarPicker
            v-model="playerAvatarIndex"
            variant="compact"
            label="アイコン"
          />
        </section>

        <!-- Room CTAs (hero actions) -->
        <div
          class="flex flex-col gap-3 sm:gap-4 lg:col-span-7 lg:justify-center"
        >
          <!-- Create -->
          <section
            class="panel border-gold-400/30 p-4 shadow-gold sm:p-5 lg:p-6"
          >
            <div class="mb-1 flex flex-wrap items-center gap-2">
              <h2 class="text-sm font-semibold text-gold-200 lg:text-base">
                ルームを作る
              </h2>
              <StatusChip
                variant="muted"
                class="text-[10px]"
                label="最大10人"
              />
            </div>
            <p class="mb-3 text-xs text-sand-dim lg:mb-4 lg:text-sm">
              あなたがホストになります。6文字のコードを友だちに送ってください
            </p>
            <button
              type="button"
              class="btn-gold w-full lg:py-3.5 lg:text-base"
              :class="ctaFlash === 'create' ? 'btn-fx-press' : ''"
              :disabled="onlineBusy"
              @click="createRoom"
            >
              {{ onlineBusy ? '接続中…' : 'ルームを作る' }}
            </button>
            <p
              v-if="onlineBusy"
              class="mt-2 text-center text-[11px] text-sand-dim lg:text-xs"
            >
              <template v-if="isDevBuild">
                接続中…（進まないときは
                <code class="font-mono">npm run worker:dev</code> を確認）
              </template>
              <template v-else>サーバーにつないでいます…</template>
            </p>
            <p
              v-else-if="onlineGame.lastError"
              class="mt-2 text-center text-[11px] text-red-200 lg:text-xs"
            >
              {{ onlineGame.lastError }}
            </p>
          </section>

          <!-- Soft divider (SP only; PC stacks with gap) -->
          <div class="flex items-center gap-3 px-1 lg:hidden">
            <div class="h-px flex-1 bg-gold-400/15" />
            <span class="text-xs text-sand-dim">または</span>
            <div class="h-px flex-1 bg-gold-400/15" />
          </div>

          <!-- Join -->
          <section class="panel p-4 sm:p-5 lg:p-6">
            <h2 class="mb-1 text-sm font-semibold text-gold-200 lg:text-base">
              ルームに入る
            </h2>
            <p class="mb-3 text-xs text-sand-dim lg:mb-4 lg:text-sm">
              ホストからもらった6文字のコードを入力してください
            </p>
            <label class="mb-3 block">
              <span class="field-label">ルームコード</span>
              <input
                :value="roomCode"
                type="text"
                inputmode="text"
                enterkeyhint="go"
                autocomplete="off"
                autocapitalize="characters"
                autocorrect="off"
                spellcheck="false"
                lang="en"
                placeholder="例: AB7KQ2"
                maxlength="6"
                pattern="[A-Za-z0-9]*"
                class="field field-mono"
                @input="onCodeInput"
                @compositionend="onCodeCompositionEnd"
                @keydown.enter.prevent="joinRoom"
              />
            </label>
            <button
              type="button"
              class="btn-teal w-full lg:py-3.5 lg:text-base"
              :class="ctaFlash === 'join' ? 'btn-fx-press' : ''"
              :disabled="onlineBusy"
              @click="joinRoom"
            >
              {{ onlineBusy ? '接続中…' : 'ルームに入る' }}
            </button>
            <p
              v-if="!onlineBusy && onlineGame.lastError"
              class="mt-2 text-center text-[11px] text-red-200 lg:text-xs"
            >
              {{ onlineGame.lastError }}
            </p>
          </section>
        </div>
      </div>

      <!--
        Game settings — lower priority, collapsible, lighter chrome than CTA panels
      -->
      <details
        class="group mt-5 rounded-xl border border-gold-400/10 bg-night-900/35 open:bg-night-900/50 lg:mt-6"
      >
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-sand-dim transition marker:content-none hover:text-sand [&::-webkit-details-marker]:hidden lg:px-5 lg:py-3.5 lg:text-base"
        >
          <span class="font-medium text-gold-200/90">ゲーム設定</span>
          <span
            class="text-xs text-sand-dim transition group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>
        <div class="space-y-5 border-t border-gold-400/10 px-4 py-4 lg:px-5 lg:py-5">
          <!-- SFX -->
          <div>
            <div class="mb-2 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-sand lg:text-base">効果音</p>
                <p class="mt-0.5 text-xs text-sand-dim">
                  宣言・手番・コヨーテなどの短い音。ゲーム中もヘッダでミュートできます
                </p>
              </div>
              <button
                type="button"
                class="btn-ghost btn-sm shrink-0"
                :aria-pressed="sfxEnabled"
                @click="setSfxEnabled(!sfxEnabled)"
              >
                {{ sfxEnabled ? 'ON' : 'OFF' }}
              </button>
            </div>
            <label
              class="block"
              :class="sfxEnabled ? '' : 'pointer-events-none opacity-40'"
            >
              <span class="field-label">音量</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                class="w-full accent-gold-400"
                :disabled="!sfxEnabled"
                :value="Math.round(sfxVolume * 100)"
                @input="
                  setSfxVolume(
                    Number(($event.target as HTMLInputElement).value) / 100,
                  )
                "
              />
            </label>
          </div>

          <!-- Haptics -->
          <div>
            <div class="mb-1 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-sand lg:text-base">
                  触覚フィードバック
                </p>
                <p class="mt-0.5 text-xs text-sand-dim">
                  手番・WILD CALL・コヨーテ・ライフ喪失のみ短い振動。初期 OFF。ゲーム中もヘッダで切り替えできます
                </p>
              </div>
              <button
                type="button"
                class="btn-ghost btn-sm shrink-0"
                :aria-pressed="hapticEnabled"
                :disabled="!hapticSupported"
                :title="
                  hapticSupported
                    ? hapticEnabled
                      ? '触覚オン'
                      : '触覚オフ'
                    : 'この端末は振動に対応していません'
                "
                @click="setHapticEnabled(!hapticEnabled)"
              >
                {{
                  !hapticSupported
                    ? '非対応'
                    : hapticEnabled
                      ? 'ON'
                      : 'OFF'
                }}
              </button>
            </div>
            <p
              v-if="!hapticSupported"
              class="text-[11px] text-sand-dim"
            >
              対応ブラウザ（主に Android）でのみ使えます。iOS など非対応では何もしません
            </p>
          </div>
        </div>
      </details>

      <!-- Local bot demo — DEV builds only (not in production) -->
      <section
        v-if="showLocalDemo"
        class="panel mt-4 p-5 ring-1 ring-gold-400/25 sm:p-6"
      >
        <div class="mb-1 flex items-center justify-center gap-2">
          <StatusChip
            variant="teal"
            class="!bg-teal-deep/35 text-[10px]"
            label="DEV · ローカル"
          />
        </div>
        <h2 class="mb-1 text-center text-sm font-semibold text-gold-200">
          ローカル対戦
        </h2>
        <p class="mb-4 text-center text-xs text-sand-dim">
          開発用: Worker なし・ボットとブラウザだけで宣言 → コヨーテ → 結果
        </p>

        <label class="mb-3 block">
          <span class="field-label">表示名（任意）</span>
          <input
            v-model="demoSelfName"
            type="text"
            maxlength="12"
            placeholder="あなた"
            class="field"
          />
        </label>

        <fieldset class="mb-4">
          <legend class="mb-1.5 text-xs text-sand-dim">
            人数（あなた + ボット）
          </legend>
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
              <span class="mt-0.5 block text-[10px] font-normal opacity-80"
                >ボット2</span
              >
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
              <span class="mt-0.5 block text-[10px] font-normal opacity-80"
                >ボット3</span
              >
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
          <span class="field-label">乱数シード（任意・再現用の整数）</span>
          <input
            v-model="demoSeed"
            type="text"
            inputmode="numeric"
            placeholder="空欄で毎回ランダム"
            class="field font-mono"
          />
        </label>

        <button
          type="button"
          class="btn-gold w-full"
          :class="ctaFlash === 'demo' ? 'btn-fx-press' : ''"
          :disabled="demoStarting"
          @click="startLocalDemo"
        >
          {{ demoStarting ? '開始中…' : 'ローカルデモを開始' }}
        </button>
      </section>

      <!-- Dev mock nav — production builds omit entirely -->
      <details
        v-if="showDevMockNav"
        class="mt-3 rounded-2xl border border-gold-400/10 bg-night-900/40 p-4"
      >
        <summary
          class="cursor-pointer list-none text-center text-[11px] uppercase tracking-wider text-sand-dim marker:content-none [&::-webkit-details-marker]:hidden"
        >
          開発用 · UI モック導線
        </summary>
        <nav
          class="mt-3 flex flex-wrap items-center justify-center gap-2"
          aria-label="モック画面リンク"
        >
          <RouterLink to="/lobby" class="btn-ghost text-xs"
            >待機ロビー（オフライン）</RouterLink
          >
          <RouterLink to="/game" class="btn-ghost text-xs"
            >ゲーム（ローカル）</RouterLink
          >
          <RouterLink to="/game?mock=1" class="btn-ghost text-xs"
            >ゲーム（固定モック）</RouterLink
          >
          <RouterLink to="/result?mock=1" class="btn-ghost text-xs"
            >結果（固定モック）</RouterLink
          >
          <RouterLink to="/result?mock=1&fx=qopen" class="btn-ghost text-xs"
            >？オープン演出（確認）</RouterLink
          >
        </nav>
        <p class="mt-2 text-center text-[10px] text-sand-dim/80">
          本番ビルドではこの導線とローカル対戦は非表示。Worker:
          <code class="font-mono">npm run worker:dev</code>
          ／ 結果モック右下で「？のみ再生」可
        </p>
      </details>
    </div>

    <AppToast :message="toast" @dismiss="dismissToast" />

    <HelpModal :open="helpOpen" @close="helpOpen = false" />

    <MockBadge />
  </div>
</template>
