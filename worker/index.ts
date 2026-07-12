/**
 * Wild Count — Cloudflare Worker entry (Phase 1).
 *
 * Routes HTTP room APIs and WebSocket upgrades to the GameRoom Durable Object.
 * @see docs/phase1-multiplayer.md
 */

import { GameRoom } from './GameRoom'
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode'
import type { Env } from './types'

export { GameRoom }

const MAX_CODE_ATTEMPTS = 8

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return corsPreflight()
    }

    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return withCors(json({ ok: true, service: 'wild-count', phase: 'P1-3' }))
      }

      if (request.method === 'POST' && url.pathname === '/api/rooms') {
        return withCors(await createRoom(env))
      }

      // GET /api/rooms/:code
      const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/?$/)
      if (roomMatch && request.method === 'GET') {
        const code = normalizeRoomCode(roomMatch[1] ?? '')
        if (!isValidRoomCode(code)) {
          return withCors(
            json({ error: 'BAD_REQUEST', message: 'Invalid room code' }, 400),
          )
        }
        return withCors(await getRoomMeta(env, code))
      }

      // GET /api/rooms/:code/ws  → WebSocket upgrade
      const wsMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/ws\/?$/)
      if (wsMatch) {
        const code = normalizeRoomCode(wsMatch[1] ?? '')
        if (!isValidRoomCode(code)) {
          return withCors(
            json({ error: 'BAD_REQUEST', message: 'Invalid room code' }, 400),
          )
        }
        return forwardToRoom(env, code, request)
      }

      return withCors(json({ error: 'NOT_FOUND', message: 'Not found' }, 404))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      console.error('worker fetch error', err)
      return withCors(json({ error: 'INTERNAL', message }, 500))
    }
  },
}

async function createRoom(env: Env): Promise<Response> {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const roomCode = generateRoomCode()
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomCode))
    const res = await stub.fetch('https://room/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomCode }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('init failed', res.status, text)
      continue
    }

    const data = (await res.json()) as {
      ok?: boolean
      alreadyExisted?: boolean
      roomCode?: string
    }

    // If DO already had a different lifecycle later, prefer a free code.
    // On first deploy, alreadyExisted means code reuse — generate another.
    if (data.alreadyExisted) {
      continue
    }

    return json({ roomCode }, 201)
  }

  return json(
    { error: 'INTERNAL', message: 'Could not allocate room code' },
    500,
  )
}

async function getRoomMeta(env: Env, roomCode: string): Promise<Response> {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomCode))
  const res = await stub.fetch('https://room/meta', { method: 'GET' })
  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    },
  })
}

async function forwardToRoom(
  env: Env,
  roomCode: string,
  request: Request,
): Promise<Response> {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomCode))
  // Preserve Upgrade headers for WebSocket; DO handler keys off Upgrade, not path.
  return stub.fetch(new Request('https://room/ws', request))
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  headers.set('access-control-allow-origin', '*')
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  headers.set(
    'access-control-allow-headers',
    'content-type, upgrade, connection, sec-websocket-protocol',
  )
  return new Response(res.body, { status: res.status, headers })
}

function corsPreflight(): Response {
  return withCors(new Response(null, { status: 204 }))
}
