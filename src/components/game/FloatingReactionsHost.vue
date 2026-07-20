<script setup lang="ts">
/**
 * Owns the floatingReactions store subscription so stamp TTL / chat floats
 * do not re-render GameView / LobbyView trees.
 */
import { storeToRefs } from 'pinia'
import { useOnlineGameStore } from '@/stores/onlineGame'
import ReactionOverlay from './ReactionOverlay.vue'

const { floatingReactions } = storeToRefs(useOnlineGameStore())
</script>

<template>
  <ReactionOverlay :reactions="floatingReactions" />
</template>
