<script setup lang="ts">
/**
 * Game screen orchestrator.
 * R3: logic → useGameSession / useChallengeReveal;
 * PC/SP markup → GameDesktopLayout / GameMobileLayout;
 * coyote grid → CoyoteRevealPanel. FX mount points unchanged.
 */
import { useGameSession } from '@/composables/useGameSession'
import GameDesktopLayout from '@/components/game/GameDesktopLayout.vue'
import GameMobileLayout from '@/components/game/GameMobileLayout.vue'
import CoyoteCutIn from '@/components/game/CoyoteCutIn.vue'
import RoundStartBanner from '@/components/game/RoundStartBanner.vue'
import ExtraActionCutIn from '@/components/game/ExtraActionCutIn.vue'
import ReactionOverlay from '@/components/game/ReactionOverlay.vue'
import StampPickerSheet from '@/components/game/StampPickerSheet.vue'
import DeckInfoModal from '@/components/game/DeckInfoModal.vue'
import AppConfirmDialog from '@/components/common/AppConfirmDialog.vue'
import AppToast from '@/components/common/AppToast.vue'
import HelpModal from '@/components/common/HelpModal.vue'
import MockBadge from '@/components/common/MockBadge.vue'

const s = useGameSession()
const { onlineGame, allowUiMock } = s
</script>

<template>
  <div class="page-fixed desert-bg safe-x">
    <!-- Online: waiting for first view snapshot -->
    <div
      v-if="s.isOnline && !s.room"
      class="relative z-10 mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center gap-4 px-4 safe-top safe-bottom"
    >
      <p class="text-sm text-sand-dim">
        {{
          onlineGame.reconnecting || onlineGame.connection === 'connecting'
            ? 'ルームに再接続しています…'
            : 'ゲームの状態を読み込んでいます…'
        }}
      </p>
      <p v-if="onlineGame.lastError" class="text-center text-xs text-red-200">
        {{ onlineGame.lastError }}
      </p>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <button
          v-if="onlineGame.connection !== 'open' && onlineGame.canAttemptResume"
          type="button"
          class="btn-teal text-sm"
          :disabled="onlineGame.reconnecting"
          @click="s.manualReconnect"
        >
          再接続
        </button>
        <button type="button" class="btn-ghost" @click="s.requestLeaveGame">
          {{ onlineGame.isRoomClosed ? 'ホームへ' : '退出' }}
        </button>
      </div>
      <MockBadge />
    </div>

    <template v-else-if="s.room">
      <GameDesktopLayout
        v-model:draft-bid="s.draftBid"
        v-model:desktop-side-tab="s.desktopSideTab"
        :room="s.room"
        :game-view="s.gameView"
        :show-online-disconnect="s.showOnlineDisconnect"
        :reconnecting="onlineGame.reconnecting"
        :reconnect-attempt="onlineGame.reconnectAttempt"
        :last-error="onlineGame.lastError"
        :can-attempt-resume="onlineGame.canAttemptResume"
        :pace-hint="s.paceHint"
        :turn-clock="s.turnClock"
        :awaiting-result-view="s.awaitingResultView"
        :bots-running="s.botsRunning"
        :coyote-banner="s.coyoteBanner"
        :reveal-cards="s.revealCards"
        :revealed-count="s.revealedCount"
        :cards-reveal-done="s.cardsRevealDone"
        :show-forfeit-end="s.showForfeitEnd"
        :pending-lobby-return="!!(s.isOnline && onlineGame.pendingLobbyReturn)"
        :forfeit-end-title="s.forfeitEndTitle"
        :forfeit-end-detail="s.forfeitEndDetail"
        :waiting-for-result-peers="s.waitingForResultPeers"
        :min-bid="s.minBid"
        :forbidden-bid-value="s.forbiddenBidValue"
        :can-declare="s.canDeclare"
        :can-challenge="s.canChallenge"
        :can-same="s.canSame"
        :can-change="s.canChange"
        :extras-allowed="s.extrasAllowed"
        :bid-target-options="s.bidTargetOptions"
        :is-online="s.isOnline"
        :chat-messages="onlineGame.chatMessages"
        :self-player-id="onlineGame.playerId"
        :self-stamp-avatar-id="s.selfStampAvatarId"
        :chat-connection-open="onlineGame.connection === 'open'"
        :avatar-for-player="s.chatAvatarForPlayer"
        @help="s.openHelp"
        @deck="s.openDeckInfo"
        @leave="s.requestLeaveGame"
        @reconnect="s.manualReconnect"
        @skip-reveal="s.skipCardReveal"
        @open-result="s.openResult"
        @go-lobby-rematch="s.goToLobbyAfterRematch"
        @play-again="s.playAgainFromForfeit"
        @declare="s.onDeclare"
        @challenge="s.onChallenge"
        @same="s.onSame"
        @change="s.onChange"
        @send-chat="s.onSendChat"
        @reaction="s.onSendReaction"
      />

      <GameMobileLayout
        v-model:draft-bid="s.draftBid"
        v-model:mobile-tab="s.mobileTab"
        v-model:stamp-sheet-open="s.stampSheetOpen"
        :room="s.room"
        :game-view="s.gameView"
        :show-online-disconnect="s.showOnlineDisconnect"
        :reconnecting="onlineGame.reconnecting"
        :reconnect-attempt="onlineGame.reconnectAttempt"
        :last-error="onlineGame.lastError"
        :can-attempt-resume="onlineGame.canAttemptResume"
        :pace-hint="s.paceHint"
        :turn-clock="s.turnClock"
        :awaiting-result-view="s.awaitingResultView"
        :bots-running="s.botsRunning"
        :coyote-banner="s.coyoteBanner"
        :reveal-cards="s.revealCards"
        :revealed-count="s.revealedCount"
        :cards-reveal-done="s.cardsRevealDone"
        :show-forfeit-end="s.showForfeitEnd"
        :pending-lobby-return="!!(s.isOnline && onlineGame.pendingLobbyReturn)"
        :forfeit-end-title="s.forfeitEndTitle"
        :forfeit-end-detail="s.forfeitEndDetail"
        :min-bid="s.minBid"
        :forbidden-bid-value="s.forbiddenBidValue"
        :can-declare="s.canDeclare"
        :can-challenge="s.canChallenge"
        :can-same="s.canSame"
        :can-change="s.canChange"
        :extras-allowed="s.extrasAllowed"
        :bid-target-options="s.bidTargetOptions"
        :is-online="s.isOnline"
        :chat-messages="onlineGame.chatMessages"
        :self-player-id="onlineGame.playerId"
        :self-stamp-avatar-id="s.selfStampAvatarId"
        :chat-connection-open="onlineGame.connection === 'open'"
        :avatar-for-player="s.chatAvatarForPlayer"
        @help="s.openHelp"
        @deck="s.openDeckInfo"
        @leave="s.requestLeaveGame"
        @reconnect="s.manualReconnect"
        @skip-reveal="s.skipCardReveal"
        @open-result="s.openResult"
        @go-lobby-rematch="s.goToLobbyAfterRematch"
        @play-again="s.playAgainFromForfeit"
        @declare="s.onDeclare"
        @challenge="s.onChallenge"
        @same="s.onSame"
        @change="s.onChange"
        @send-chat="s.onSendChat"
        @reaction="s.onSendReaction"
        @toggle-chat="s.toggleMobileChat"
        @toggle-log="s.toggleMobileLog"
        @close-drawer="s.closeMobileDrawer"
        @open-stamp-sheet="s.openStampSheet"
      />
    </template>

    <div
      v-else
      class="flex flex-1 items-center justify-center text-sm text-sand-dim"
    >
      セッションを準備中…
    </div>

    <!-- Your-turn edge glow (wave-2 dopamine) -->
    <div
      v-if="s.showTurnEdge"
      class="turn-edge-glow"
      aria-hidden="true"
    />

    <!-- Round start slam -->
    <RoundStartBanner
      v-if="s.roundBannerVisible"
      :key="`round-${s.roundBannerNum}`"
      :round="s.roundBannerNum"
      @done="s.onRoundBannerDone"
    />

    <!-- Coyote cut-in overlay -->
    <CoyoteCutIn
      v-if="s.cutInPayload"
      :challenger-name="s.cutInPayload.challengerName"
      :challenger-avatar="s.cutInPayload.challengerAvatar"
      :challenger-avatar-src="s.cutInPayload.challengerAvatarSrc"
      :bidder-name="s.cutInPayload.bidderName"
      :bid-value="s.cutInPayload.bidValue"
      @done="s.onCutInDone"
    />

    <!-- 特殊能力 / セイム / チェンジ impact -->
    <ExtraActionCutIn
      v-if="s.extraFx && !s.cutInPayload"
      :key="s.extraFx.key"
      :kind="s.extraFx.kind"
      :actor-name="s.extraFx.actorName"
      :target-name="s.extraFx.targetName"
      :bid-value="s.extraFx.bidValue"
      @done="s.onExtraFxDone"
    />

    <AppToast :message="s.toast" @dismiss="s.dismissToast" />

    <nav
      v-if="allowUiMock"
      class="pointer-events-auto fixed bottom-3 right-3 z-30 hidden gap-1.5 lg:flex"
      aria-label="開発用画面リンク"
    >
      <RouterLink to="/" class="btn-ghost btn-sm text-[10px]">トップ</RouterLink>
      <RouterLink to="/lobby" class="btn-ghost btn-sm text-[10px]">ロビー</RouterLink>
    </nav>

    <AppConfirmDialog
      v-model:open="s.leaveConfirmOpen"
      :title="
        s.canHostEndRoom
          ? '退出するか、ルームを解散しますか？'
          : 'ゲームを終了しますか？'
      "
      @cancel="s.cancelLeaveGame"
    >
      <template v-if="s.canHostEndRoom">
        <strong class="text-sand">自分だけ退出</strong>すると、あなたは脱落してほかの人はそのまま続けます。
        <strong class="text-sand">ルームを解散</strong>すると、みんなの対戦が終わりルームが閉じます。
      </template>
      <template v-else-if="s.isOnline">
        退出するとこの対戦から<strong class="text-sand">脱落</strong>し、ホームに戻ります。
      </template>
      <template v-else>
        いまのゲームを終了して、ホームに戻ります。
      </template>
      <template #actions>
        <button
          v-if="s.canHostEndRoom"
          type="button"
          class="btn-danger w-full"
          @click="s.confirmEndRoom"
        >
          ルームを解散
        </button>
        <button type="button" class="btn-teal w-full" @click="s.confirmLeaveGame">
          {{ s.canHostEndRoom ? '自分だけ退出' : '終了して退出' }}
        </button>
        <button type="button" class="btn-ghost w-full" @click="s.cancelLeaveGame">
          キャンセル
        </button>
      </template>
    </AppConfirmDialog>

    <HelpModal :open="s.helpOpen" @close="s.helpOpen = false" />
    <DeckInfoModal
      :open="s.deckInfoOpen"
      :deck="s.roomDeck"
      @close="s.deckInfoOpen = false"
    />

    <ReactionOverlay
      v-if="s.isOnline"
      :reactions="onlineGame.floatingReactions"
    />

    <StampPickerSheet
      :open="s.stampSheetOpen"
      :disabled="!s.isOnline || onlineGame.connection !== 'open'"
      :self-avatar-id="s.selfStampAvatarId"
      @close="s.stampSheetOpen = false"
      @pick="s.onSendReaction"
    />

    <MockBadge />
  </div>
</template>
