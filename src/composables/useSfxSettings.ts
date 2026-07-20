/**
 * Reactive SFX settings for UI (mute toggle / volume slider).
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { getSfxEngine } from '@/audio'

export function useSfxSettings() {
  const engine = getSfxEngine()
  const enabled = ref(engine.isEnabled())
  const volume = ref(engine.getVolume())

  function sync() {
    enabled.value = engine.isEnabled()
    volume.value = engine.getVolume()
  }

  let unsub: (() => void) | null = null

  onMounted(() => {
    sync()
    unsub = engine.subscribe(sync)
    // First mount may coincide with user already interacting
    engine.unlock()
  })

  onUnmounted(() => {
    unsub?.()
    unsub = null
  })

  function setEnabled(v: boolean) {
    engine.setEnabled(v)
    sync()
  }

  function toggleEnabled() {
    engine.toggleEnabled()
    sync()
    // Playing a quiet tick confirms unmute (only if on)
    if (engine.isEnabled()) {
      engine.unlock()
      engine.play('ui_tick')
    }
  }

  function setVolume(v: number) {
    engine.setVolume(v)
    sync()
  }

  return {
    enabled,
    volume,
    setEnabled,
    toggleEnabled,
    setVolume,
    unlock: () => engine.unlock(),
  }
}
