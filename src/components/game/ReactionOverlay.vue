<script setup lang="ts">
import type { FloatingReaction } from '@/stores/onlineGame'

defineProps<{
  reactions: FloatingReaction[]
}>()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    aria-hidden="true"
  >
    <div
      v-for="r in reactions"
      :key="r.key"
      class="reaction-float absolute bottom-[28%] flex flex-col items-center sm:bottom-[18%]"
      :class="r.kind === 'stamp' ? 'reaction-float--stamp' : ''"
      :style="{ left: `${r.x}%`, transform: 'translateX(-50%)' }"
    >
      <!-- Stamp: character art or large emoji + radial burst -->
      <template v-if="r.kind === 'stamp'">
        <span class="reaction-burst" aria-hidden="true" />
        <img
          v-if="r.stampSrc"
          :src="r.stampSrc"
          alt=""
          class="relative h-20 w-20 select-none rounded-full object-cover shadow-[0_4px_16px_rgba(0,0,0,0.55)] ring-2 ring-gold-400/40 md:h-24 md:w-24"
          draggable="false"
        />
        <span
          v-else
          class="relative select-none text-6xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.55)] md:text-7xl"
          >{{ r.body }}</span
        >
        <span
          class="mt-1.5 max-w-[9rem] truncate rounded-full bg-night-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-gold-100 shadow-md backdrop-blur-sm"
        >
          {{ r.displayName }}
        </span>
      </template>

      <!-- Text chat: bubble + name -->
      <template v-else>
        <div
          class="max-w-[min(16rem,72vw)] rounded-2xl border border-gold-400/30 bg-night-900/92 px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <p
            class="break-words text-center text-sm font-medium leading-snug text-sand"
          >
            {{ r.body }}
          </p>
        </div>
        <span
          class="mt-1.5 max-w-[9rem] truncate rounded-full bg-night-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-gold-100 shadow-md backdrop-blur-sm"
        >
          {{ r.displayName }}
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Text chat bubble float; stamps use global .reaction-float--stamp */
.reaction-float:not(.reaction-float--stamp) {
  animation: reaction-rise 3.2s ease-out forwards;
}

@keyframes reaction-rise {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(32px) scale(0.45);
  }
  10% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1.08);
  }
  28% {
    transform: translateX(-50%) translateY(-16px) scale(1);
  }
  72% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-140px) scale(0.92);
  }
}
</style>
