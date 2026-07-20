/**
 * Reactive haptic settings for UI (opt-in vibration toggle).
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { getHapticEngine } from '@/haptics'

export function useHapticSettings() {
  const engine = getHapticEngine()
  const enabled = ref(engine.isEnabled())
  const supported = ref(engine.isSupported())

  function sync() {
    enabled.value = engine.isEnabled()
    supported.value = engine.isSupported()
  }

  let unsub: (() => void) | null = null

  onMounted(() => {
    sync()
    unsub = engine.subscribe(sync)
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
    // Confirm enable with a short turn pulse (only if supported + on)
    if (engine.isEnabled() && engine.isSupported()) {
      engine.play('turn_self', { force: true })
    }
  }

  return {
    enabled,
    supported,
    setEnabled,
    toggleEnabled,
  }
}
