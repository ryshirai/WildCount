import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/**
 * Tailwind `lg` breakpoint (1024px).
 * Used to mount only desktop or mobile game layout (not both hidden by CSS).
 */
const LG_QUERY = '(min-width: 1024px)'

function readLgUp(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(LG_QUERY).matches
}

/** True when viewport is lg+ (desktop game table). */
export function useIsLgUp(): Ref<boolean> {
  const isLgUp = ref(readLgUp())

  onMounted(() => {
    const mql = window.matchMedia(LG_QUERY)
    isLgUp.value = mql.matches
    const onChange = (e: MediaQueryListEvent) => {
      isLgUp.value = e.matches
    }
    mql.addEventListener('change', onChange)
    onUnmounted(() => mql.removeEventListener('change', onChange))
  })

  return isLgUp
}
