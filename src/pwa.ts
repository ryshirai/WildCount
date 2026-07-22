/**
 * Production PWA updates — automatic, no user hard-reload.
 *
 * Why this is more than registerSW alone:
 * - Browsers check for SW updates only occasionally while a tab stays open.
 * - Older SWs bound every navigation to a precached `index.html`, so even a
 *   normal reload could keep the old shell until the SW binary itself changed.
 * - Lazy-route chunks can fail after a deploy if the running main bundle and
 *   the network disagree (classic "Failed to fetch dynamically imported module").
 *
 * Layers:
 * 1. `virtual:pwa-register` + autoUpdate → reload when a new SW activates
 * 2. Frequent `registration.update()` while the tab is visible
 * 3. Poll `/version.json` (network-only, no-cache) and soft-reload on mismatch
 * 4. On stuck mismatch: unregister SW + clear Cache Storage, then reload
 * 5. Vite `vite:preloadError` / dynamic-import failures → one soft reload
 *
 * Mid-game (`/game`): defer reload until the player leaves the game screen.
 * Never throw: a SW failure must not leave the SPA unmounted.
 */
import { registerSW } from 'virtual:pwa-register'
import { ASSET_VERSION } from '@/config/assetVersion'
import router from '@/router'

/** How often to ask the browser to check `sw.js` while the tab is open. */
const SW_UPDATE_MS = 60 * 1000

/** How often to compare `/version.json` to the running build. */
const VERSION_POLL_MS = 30 * 1000

/** sessionStorage: remote version we already reloaded for (loop guard). */
const RELOAD_FOR_KEY = 'wc:reload-for-v'

/** sessionStorage: already did nuclear cache clear for this remote version. */
const NUCLEAR_FOR_KEY = 'wc:nuclear-for-v'

let pendingReload: (() => void) | null = null
let reloadScheduled = false

function isGameScreen(): boolean {
  try {
    return router.currentRoute.value.name === 'game'
  } catch {
    return false
  }
}

function markReloadAttempt(remoteVersion: string): void {
  try {
    sessionStorage.setItem(RELOAD_FOR_KEY, remoteVersion)
  } catch {
    /* private mode / quota — ignore */
  }
}

function alreadyReloadedFor(remoteVersion: string): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FOR_KEY) === remoteVersion
  } catch {
    return false
  }
}

function markNuclear(remoteVersion: string): void {
  try {
    sessionStorage.setItem(NUCLEAR_FOR_KEY, remoteVersion)
  } catch {
    /* ignore */
  }
}

function alreadyNuclearFor(remoteVersion: string): boolean {
  try {
    return sessionStorage.getItem(NUCLEAR_FOR_KEY) === remoteVersion
  } catch {
    return false
  }
}

/** Clear loop guards once this tab is running the build it reloaded for. */
function clearReloadGuardsIfCurrent(): void {
  try {
    if (sessionStorage.getItem(RELOAD_FOR_KEY) === ASSET_VERSION) {
      sessionStorage.removeItem(RELOAD_FOR_KEY)
    }
    if (sessionStorage.getItem(NUCLEAR_FOR_KEY) === ASSET_VERSION) {
      sessionStorage.removeItem(NUCLEAR_FOR_KEY)
    }
  } catch {
    /* ignore */
  }
}

/**
 * Soft reload (not Ctrl+Shift+R). Safe after NavigationRoute was removed:
 * document requests hit the network and pick up new hashed modules.
 */
function performSoftReload(reason: string): void {
  console.info('[Wild Count] applying update via reload:', reason)
  window.location.reload()
}

function scheduleAppReload(reason: string): void {
  if (reloadScheduled) return

  const run = () => {
    reloadScheduled = true
    pendingReload = null
    performSoftReload(reason)
  }

  if (isGameScreen()) {
    pendingReload = run
    console.info('[Wild Count] update ready; will reload after game screen')
    return
  }

  run()
}

function flushPendingReload(): void {
  if (!pendingReload || isGameScreen()) return
  const run = pendingReload
  pendingReload = null
  run()
}

async function nuclearClearAndReload(remoteVersion: string): Promise<void> {
  if (alreadyNuclearFor(remoteVersion)) {
    // Still mismatched after nuclear — stop looping; user would need a real
    // hard refresh, but this should be extremely rare (CDN/account split).
    console.warn('[Wild Count] still on stale build after cache clear')
    return
  }
  markNuclear(remoteVersion)

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  }

  performSoftReload(`nuclear clear → ${remoteVersion}`)
}

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (
      data &&
      typeof data === 'object' &&
      'v' in data &&
      typeof (data as { v: unknown }).v === 'string' &&
      (data as { v: string }).v.length > 0
    ) {
      return (data as { v: string }).v
    }
    return null
  } catch {
    return null
  }
}

async function onVersionMismatch(
  remoteVersion: string,
  registration: ServiceWorkerRegistration | null,
): Promise<void> {
  // Ask the browser to pull a new SW first (skipWaiting is in the new SW).
  if (registration) {
    try {
      await registration.update()
    } catch {
      /* offline / transient */
    }
  }

  if (alreadyReloadedFor(remoteVersion)) {
    // Soft reload already happened for this version but we're still old →
    // clear SW + Cache Storage so the next load cannot use a stuck shell.
    if (isGameScreen()) {
      pendingReload = () => {
        void nuclearClearAndReload(remoteVersion)
      }
      return
    }
    await nuclearClearAndReload(remoteVersion)
    return
  }

  markReloadAttempt(remoteVersion)
  scheduleAppReload(`version ${ASSET_VERSION} → ${remoteVersion}`)
}

function setupVersionPolling(
  registration: ServiceWorkerRegistration | null,
): void {
  const check = () => {
    if (document.visibilityState === 'hidden') return
    void (async () => {
      const remote = await fetchRemoteVersion()
      if (!remote || remote === ASSET_VERSION) return
      await onVersionMismatch(remote, registration)
    })()
  }

  // First check shortly after boot (let the app paint first).
  window.setTimeout(check, 3_000)
  window.setInterval(check, VERSION_POLL_MS)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
}

function setupSwUpdatePolling(registration: ServiceWorkerRegistration): void {
  const checkForUpdate = () => {
    if (document.visibilityState === 'hidden') return
    void registration.update().catch(() => {
      /* offline or transient network — ignore */
    })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })
  window.addEventListener('focus', checkForUpdate)
  window.setInterval(checkForUpdate, SW_UPDATE_MS)
}

/**
 * Recover from deploy mid-session: old main → new missing chunk names.
 * Vite fires `vite:preloadError`; some browsers only surface the import reject.
 */
function setupChunkLoadRecovery(): void {
  const reasonKey = 'wc:chunk-reload'

  const recover = (reason: string) => {
    try {
      if (sessionStorage.getItem(reasonKey) === '1') return
      sessionStorage.setItem(reasonKey, '1')
    } catch {
      /* ignore */
    }
    scheduleAppReload(reason)
  }

  // Clear the one-shot guard once a load succeeds long enough.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(reasonKey)
    } catch {
      /* ignore */
    }
  }, 15_000)

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    recover('vite:preloadError')
  })

  window.addEventListener('unhandledrejection', (event) => {
    const msg =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason ?? '')
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)) {
      recover('dynamic-import-failed')
    }
  })
}

function setupRouteFlush(): void {
  router.afterEach(() => {
    // Leave /game → apply deferred update.
    queueMicrotask(() => flushPendingReload())
  })
}

export function setupPwa(): void {
  if (!import.meta.env.PROD) return

  clearReloadGuardsIfCurrent()
  setupChunkLoadRecovery()
  setupRouteFlush()

  if (!('serviceWorker' in navigator)) {
    setupVersionPolling(null)
    return
  }

  try {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('[Wild Count] SW register failed', error)
      },
      onRegisteredSW(_swUrl, registration) {
        setupVersionPolling(registration ?? null)
        if (registration) setupSwUpdatePolling(registration)
      },
    })
  } catch (err) {
    console.warn('[Wild Count] setupPwa failed', err)
    setupVersionPolling(null)
  }
}
