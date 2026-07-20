/**
 * Production PWA updates.
 *
 * The default vite-plugin-pwa inject only calls `navigator.serviceWorker.register`
 * and does NOT reload when a new worker activates — so users keep old CSS/JS
 * until a hard refresh. `virtual:pwa-register` with `registerType: 'autoUpdate'`
 * reloads on `activated` when an update is found.
 *
 * Browsers only check for SW updates occasionally while a tab stays open, so we
 * also call `registration.update()` on focus / visibility and on a short interval.
 *
 * Never throw: a SW failure must not leave the SPA unmounted (mobile black screen).
 */
import { registerSW } from 'virtual:pwa-register'

/** How often to poll for a new service worker while the tab is open. */
const UPDATE_CHECK_MS = 5 * 60 * 1000

export function setupPwa(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  try {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('[Wild Count] SW register failed', error)
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return

        const checkForUpdate = () => {
          void registration.update().catch(() => {
            /* offline or transient network — ignore */
          })
        }

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate()
        })
        window.addEventListener('focus', checkForUpdate)

        window.setInterval(checkForUpdate, UPDATE_CHECK_MS)
      },
    })
  } catch (err) {
    console.warn('[Wild Count] setupPwa failed', err)
  }
}
