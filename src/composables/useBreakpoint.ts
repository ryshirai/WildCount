import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/**
 * Tailwind breakpoints used for layout mounting (not CSS dual-tree).
 *
 * | Band              | Width        | Game layout                         |
 * |-------------------|--------------|-------------------------------------|
 * | phone             | < 768        | Mobile carousel + bottom nav        |
 * | tablet            | 768–1023     | Ellipse table, no side rail         |
 * | desktop           | ≥ 1024       | Ellipse table + log/chat side rail  |
 *
 * Height bands (md+) shrink chrome on FHD / short laptop / landscape tablet.
 */
const MD_QUERY = '(min-width: 768px)'
const LG_QUERY = '(min-width: 1024px)'
/**
 * Permanent log/chat side rail needs enough horizontal room for a 10-seat
 * ellipse. Below this, use bottom-nav drawers (covers iPad landscape mini).
 */
const SIDE_RAIL_QUERY = '(min-width: 1100px)'
/** Ellipse without rail: md up to side-rail breakpoint. */
const TABLET_WIDTH_QUERY =
  '(min-width: 768px) and (max-width: 1099.98px)'

/**
 * Short viewports on table layouts (tablet + desktop).
 * - short: ≤1200px tall (FHD, iPad landscape)
 * - very short: ≤900px tall (small laptop, short landscape)
 */
const SHORT_TABLE_QUERY = '(min-width: 768px) and (max-height: 1200px)'
const VERY_SHORT_TABLE_QUERY = '(min-width: 768px) and (max-height: 900px)'

function readMql(query: string): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(query).matches
}

function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(readMql(query))

  onMounted(() => {
    const mql = window.matchMedia(query)
    matches.value = mql.matches
    const onChange = (e: MediaQueryListEvent) => {
      matches.value = e.matches
    }
    mql.addEventListener('change', onChange)
    onUnmounted(() => mql.removeEventListener('change', onChange))
  })

  return matches
}

/** True when viewport is md+ (ellipse game table: tablet + desktop). */
export function useIsMdUp(): Ref<boolean> {
  return useMediaQuery(MD_QUERY)
}

/** True when viewport is lg+ (1024). Kept for non-game chrome / mock links. */
export function useIsLgUp(): Ref<boolean> {
  return useMediaQuery(LG_QUERY)
}

/**
 * True when the game table may show a permanent log/chat side rail.
 * Wider than lg so 10-seat ellipses on iPad landscape stay readable.
 */
export function useShowSideRail(): Ref<boolean> {
  return useMediaQuery(SIDE_RAIL_QUERY)
}

/** Tablet / narrow desktop: ellipse without permanent side rail. */
export function useIsTabletWidth(): Ref<boolean> {
  return useMediaQuery(TABLET_WIDTH_QUERY)
}

/**
 * Table layout + short height (≤1200px). Shrink bid dock / header chrome.
 * FHD 1920×1080 and landscape tablets land here.
 */
export function useIsShortDesktop(): Ref<boolean> {
  return useMediaQuery(SHORT_TABLE_QUERY)
}

/** Table layout + very short height (≤900px). Extra-tight density. */
export function useIsVeryShortDesktop(): Ref<boolean> {
  return useMediaQuery(VERY_SHORT_TABLE_QUERY)
}
