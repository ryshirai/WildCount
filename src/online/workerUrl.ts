/**
 * Resolve Worker HTTP / WebSocket base for the browser.
 *
 * - Dev: relative `/api/...` via Vite proxy → wrangler :8787
 * - Prod / alternate host: set `VITE_WORKER_URL` (no trailing slash)
 */

export function workerHttpBase(): string {
  const raw = import.meta.env.VITE_WORKER_URL
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.replace(/\/$/, '')
  }
  return ''
}

export function roomsCreateUrl(): string {
  return `${workerHttpBase()}/api/rooms`
}

export function roomMetaUrl(roomCode: string): string {
  return `${workerHttpBase()}/api/rooms/${encodeURIComponent(roomCode)}`
}

export function roomWebSocketUrl(roomCode: string): string {
  const base = workerHttpBase()
  if (base) {
    const u = new URL(base)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = `/api/rooms/${encodeURIComponent(roomCode)}/ws`
    u.search = ''
    u.hash = ''
    return u.toString()
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/rooms/${encodeURIComponent(roomCode)}/ws`
}
