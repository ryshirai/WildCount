/**
 * Build-time media cache buster.
 *
 * Public paths like `/avatars/cat.webp` keep a fixed URL across deploys, so a
 * Service Worker precache (or a browser-cached 404 from before the file existed)
 * can leave a broken image until hard refresh. Append `?v=` so each build
 * requests a new URL that misses the stale entry.
 *
 * Injected by `vite.config.ts` (`__WC_ASSET_VERSION__`).
 */
declare const __WC_ASSET_VERSION__: string | undefined

export const ASSET_VERSION: string =
  typeof __WC_ASSET_VERSION__ === 'string' && __WC_ASSET_VERSION__.length > 0
    ? __WC_ASSET_VERSION__
    : '0'

/** Append `?v=` / `&v=` for public static media (avatars, stamps, …). */
export function withAssetVersion(path: string): string {
  if (!path) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}v=${ASSET_VERSION}`
}
