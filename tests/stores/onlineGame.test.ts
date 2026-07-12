import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOnlineGameStore } from '../../src/stores/onlineGame'
import {
  loadResumeToken,
  saveResumeToken,
} from '../../src/online/resumeStorage'

/** Minimal in-memory localStorage for Node vitest. */
function installMemoryStorage() {
  const map = new Map<string, string>()
  const storage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, String(value))
    },
    removeItem(key: string) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
  return storage
}

type Listener = (ev?: { data?: string }) => void

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  readyState = MockWebSocket.CONNECTING
  url: string
  sent: string[] = []
  private listeners = new Map<string, Set<Listener>>()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  addEventListener(type: string, fn: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }

  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn)
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    this.sent.push(data)
  }

  close(code = 1000, reason = '') {
    if (this.readyState === MockWebSocket.CLOSED) return
    this.readyState = MockWebSocket.CLOSED
    this.emit('close', { code, reason } as { data?: string })
  }

  /** Test helper: open socket and fire open listeners. */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.emit('open')
  }

  /** Test helper: deliver a server JSON message. */
  simulateMessage(payload: unknown) {
    this.emit('message', { data: JSON.stringify(payload) })
  }

  /** Test helper: fire error then close. */
  simulateError() {
    this.emit('error')
  }

  /** Test helper: fire close without changing readyState first if already closed. */
  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.emit('close')
  }

  emit(type: string, ev?: { data?: string; code?: number; reason?: string }) {
    for (const fn of this.listeners.get(type) ?? []) fn(ev)
  }

  /** Test helper: server-side room teardown close (host end = 4002). */
  simulateRoomEndedClose() {
    this.readyState = MockWebSocket.CLOSED
    this.emit('close', { code: 4002, reason: 'host ended room' })
  }

  static reset() {
    MockWebSocket.instances = []
  }

  static latest(): MockWebSocket {
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    if (!ws) throw new Error('No MockWebSocket created')
    return ws
  }
}

describe('onlineGame store', () => {
  beforeEach(() => {
    installMemoryStorage()
    setActivePinia(createPinia())
    MockWebSocket.reset()
    vi.stubGlobal('WebSocket', MockWebSocket)
    // workerUrl + floating reaction timers read window
    vi.stubGlobal('window', {
      location: {
        protocol: 'http:',
        host: 'localhost:5173',
        hostname: 'localhost',
        port: '5173',
        href: 'http://localhost:5173/',
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    MockWebSocket.reset()
  })

  async function joinHappyPath(
    code = 'ABC234',
    opts: { isHost?: boolean } = {},
  ) {
    const asHost = opts.isHost !== false
    const store = useOnlineGameStore()
    const joinP = store.joinRoom(code, 'テスト')
    // Allow constructor + open listener registration
    await Promise.resolve()
    const ws = MockWebSocket.latest()
    ws.simulateOpen()
    // join message sent; deliver hello + view
    ws.simulateMessage({
      type: 'hello',
      playerId: 'p1',
      resumeToken: 'tok-1',
      roomCode: code,
      isHost: asHost,
    })
    ws.simulateMessage({
      type: 'view',
      revision: 1,
      view: {
        phase: 'lobby',
        roomCode: code,
        hostId: asHost ? 'p1' : 'host-other',
        players: [
          {
            id: 'p1',
            displayName: 'テスト',
            ready: false,
            connected: true,
            isHost: asHost,
            avatarIndex: 0,
          },
        ],
        selfPlayerId: 'p1',
        status: 'open',
        canStart: false,
        playerCount: 1,
      },
    })
    await joinP
    return { store, ws }
  }

  it('joinRoom waits for hello and stores resumeToken', async () => {
    const { store } = await joinHappyPath()
    expect(store.connection).toBe('open')
    expect(store.playerId).toBe('p1')
    expect(store.resumeToken).toBe('tok-1')
    expect(loadResumeToken('ABC234')).toBe('tok-1')
    expect(store.view?.phase).toBe('lobby')
  })

  it('error before hello rejects join and sets lastError', async () => {
    const store = useOnlineGameStore()
    const joinP = store.joinRoom('ROOM01', 'A')
    await Promise.resolve()
    const ws = MockWebSocket.latest()
    ws.simulateOpen()
    ws.simulateMessage({
      type: 'error',
      code: 'ROOM_FULL',
      message: 'Room is full',
    })
    await expect(joinP).rejects.toThrow()
    expect(store.lastErrorCode).toBe('ROOM_FULL')
    expect(store.connection).toBe('error')
  })

  it('stale socket close does not schedule reconnect after leave', async () => {
    const { store, ws } = await joinHappyPath('LEAVE1')
    expect(store.connection).toBe('open')

    store.leave()
    expect(store.connection).toBe('idle')
    expect(store.roomCode).toBeNull()
    expect(loadResumeToken('LEAVE1')).toBeNull()

    // Leave already closed the socket; if a late close fires, ignore it
    ws.simulateClose()

    await vi.advanceTimersByTimeAsync(30_000)
    // No second socket for reconnect
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(store.connection).toBe('idle')
  })

  it('unexpected close schedules auto-reconnect when resumeToken exists', async () => {
    const { store, ws } = await joinHappyPath('RCONN1')
    saveResumeToken('RCONN1', 'tok-1')

    // Simulate network drop
    ws.simulateClose()

    expect(store.connection).toBe('closed')
    expect(store.reconnecting).toBe(true)

    // First reconnect delay = 1000ms * 2^0
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()

    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2)
    const ws2 = MockWebSocket.latest()
    ws2.simulateOpen()
    ws2.simulateMessage({
      type: 'hello',
      playerId: 'p1',
      resumeToken: 'tok-1',
      roomCode: 'RCONN1',
      isHost: true,
    })
    ws2.simulateMessage({
      type: 'view',
      revision: 2,
      view: {
        phase: 'lobby',
        roomCode: 'RCONN1',
        hostId: 'p1',
        players: [
          {
            id: 'p1',
            displayName: 'テスト',
            ready: true,
            connected: true,
            isHost: true,
            avatarIndex: 0,
          },
        ],
        selfPlayerId: 'p1',
        status: 'open',
        canStart: false,
        playerCount: 1,
      },
    })
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()

    expect(store.connection).toBe('open')
    expect(store.reconnectAttempt).toBe(0)
    expect(store.view?.players[0]?.ready).toBe(true)
  })

  it('new connect invalidates old socket handlers (socketGen)', async () => {
    const store = useOnlineGameStore()
    const first = store.joinRoom('GEN001', 'A')
    await Promise.resolve()
    const ws1 = MockWebSocket.latest()
    ws1.simulateOpen()

    // Start a second join before hello — bumps socketGen / closes old
    const second = store.joinRoom('GEN002', 'B')
    await Promise.resolve()
    const ws2 = MockWebSocket.latest()
    expect(ws2).not.toBe(ws1)

    // Late hello from old socket must not resolve / pollute state
    ws1.simulateMessage({
      type: 'hello',
      playerId: 'old',
      resumeToken: 'old-tok',
      roomCode: 'GEN001',
      isHost: false,
    })

    ws2.simulateOpen()
    ws2.simulateMessage({
      type: 'hello',
      playerId: 'new',
      resumeToken: 'new-tok',
      roomCode: 'GEN002',
      isHost: true,
    })
    ws2.simulateMessage({
      type: 'view',
      revision: 1,
      view: {
        phase: 'lobby',
        roomCode: 'GEN002',
        hostId: 'new',
        players: [
          {
            id: 'new',
            displayName: 'B',
            ready: false,
            connected: true,
            isHost: true,
            avatarIndex: 0,
          },
        ],
        selfPlayerId: 'new',
        status: 'open',
        canStart: false,
        playerCount: 1,
      },
    })

    await expect(first).rejects.toThrow()
    await second
    expect(store.playerId).toBe('new')
    expect(store.roomCode).toBe('GEN002')
    expect(store.resumeToken).toBe('new-tok')
  })

  it('keeps stable pendingResult when peer view noise arrives', async () => {
    const { store, ws } = await joinHappyPath('RESFIX')

    const snap = {
      round: 2,
      outcome: {
        bid: 12,
        calculation: {
          steps: [
            {
              id: 's1',
              title: '合計',
              detail: '10',
              totalAfter: 10,
            },
          ],
          finalTotal: 10,
          adjustedCards: [],
          doubleCount: 0,
          maxToZeroApplied: false,
          rawNumberSum: 10,
        },
        bidderWins: false,
        loserRole: 'bidder' as const,
        loserId: 'p2',
        bidderId: 'p2',
        challengerId: 'p1',
      },
      hands: {
        p1: { kind: 'number', value: 5, label: '5' },
        p2: { kind: 'number', value: 5, label: '5' },
      },
      winnerId: null,
      bidderId: 'p2',
      challengerId: 'p1',
      loserId: 'p2',
    }

    const basePlayers = [
      {
        id: 'p1',
        displayName: 'テスト',
        ready: true,
        connected: true,
        isHost: true,
        avatarIndex: 0,
      },
      {
        id: 'p2',
        displayName: '相手',
        ready: true,
        connected: true,
        isHost: false,
        avatarIndex: 1,
      },
    ]

    ws.simulateMessage({
      type: 'view',
      revision: 5,
      view: {
        phase: 'result',
        roomCode: 'RESFIX',
        hostId: 'p1',
        players: basePlayers,
        selfPlayerId: 'p1',
        status: 'playing',
        canStart: false,
        playerCount: 2,
        maxPlayers: 10,
        game: {
          phase: 'round_end',
          isMyTurn: false,
          isGameOver: false,
          seats: [
            { id: 'p1', lives: 3 },
            { id: 'p2', lives: 2 },
          ],
        },
        pendingResult: snap,
      },
    })

    const first = store.pendingResult
    expect(first).toBeTruthy()
    expect(first!.finalTotal).toBe(10)
    expect(first!.round).toBe(2)

    // Peer dismiss / disconnect style view: same challenge, roster noise
    ws.simulateMessage({
      type: 'view',
      revision: 6,
      view: {
        phase: 'result',
        roomCode: 'RESFIX',
        hostId: 'p1',
        players: [
          basePlayers[0],
          { ...basePlayers[1]!, connected: false, displayName: '相手(改)' },
        ],
        selfPlayerId: 'p1',
        status: 'playing',
        canStart: false,
        playerCount: 2,
        maxPlayers: 10,
        game: {
          phase: 'round_end',
          isMyTurn: false,
          isGameOver: false,
          seats: [
            { id: 'p1', lives: 3 },
            { id: 'p2', lives: 2 },
          ],
        },
        pendingResult: { ...snap },
      },
    })

    expect(store.pendingResult).toBe(first)
    expect(store.pendingResult!.lifeLostName).toBe('相手')

    // Same challenge, still result phase but server omitted pending (self already
    // acked on another tab) — while phase stays 'result' we would need pending;
    // peer-only noise above already proved identity freeze.
    // Explicit dismiss clears hold and notifies server.
    store.clearPendingResult()
    expect(store.pendingResult).toBeNull()
    const sent = ws.sent.map((s) => JSON.parse(s) as { type: string })
    expect(sent.some((m) => m.type === 'dismiss_result')).toBe(true)
  })

  it('drops stale result hold when room leaves result phase', async () => {
    const { store, ws } = await joinHappyPath('RESSTALE')
    const snap = {
      round: 1,
      outcome: {
        bid: 5,
        calculation: {
          steps: [],
          finalTotal: 3,
          adjustedCards: [],
          doubleCount: 0,
          maxToZeroApplied: false,
          rawNumberSum: 3,
        },
        bidderWins: true,
        loserRole: 'challenger' as const,
        loserId: 'p1',
        bidderId: 'p2',
        challengerId: 'p1',
      },
      hands: {
        p1: { kind: 'number', value: 1, label: '1' },
        p2: { kind: 'number', value: 2, label: '2' },
      },
      winnerId: null,
      bidderId: 'p2',
      challengerId: 'p1',
      loserId: 'p1',
    }

    ws.simulateMessage({
      type: 'view',
      revision: 2,
      view: {
        phase: 'result',
        roomCode: 'RESSTALE',
        hostId: 'p1',
        players: [
          {
            id: 'p1',
            displayName: 'テスト',
            ready: true,
            connected: true,
            isHost: true,
            avatarIndex: 0,
          },
        ],
        selfPlayerId: 'p1',
        status: 'playing',
        canStart: false,
        playerCount: 1,
        maxPlayers: 10,
        pendingResult: snap,
      },
    })
    expect(store.pendingResult).toBeTruthy()

    // Reconnected after peers finished result → bidding without pending
    ws.simulateMessage({
      type: 'view',
      revision: 9,
      view: {
        phase: 'playing',
        roomCode: 'RESSTALE',
        hostId: 'p1',
        players: [
          {
            id: 'p1',
            displayName: 'テスト',
            ready: true,
            connected: true,
            isHost: true,
            avatarIndex: 0,
          },
        ],
        selfPlayerId: 'p1',
        status: 'playing',
        canStart: false,
        playerCount: 1,
        maxPlayers: 10,
        game: {
          phase: 'bidding',
          isMyTurn: true,
          isGameOver: false,
          seats: [{ id: 'p1', lives: 2 }],
        },
      },
    })
    expect(store.pendingResult).toBeNull()
  })

  it('leave sends leave message before closing socket', async () => {
    const { store, ws } = await joinHappyPath('LEAV02')
    store.leave()
    const leaveMsgs = ws.sent.filter((s) => {
      try {
        return JSON.parse(s).type === 'leave'
      } catch {
        return false
      }
    })
    expect(leaveMsgs).toHaveLength(1)
    expect(store.connection).toBe('idle')
  })

  it('endRoom sends end_room when host; room_closed clears session', async () => {
    const { store, ws } = await joinHappyPath('ENDR01')
    expect(store.isHost).toBe(true)
    store.endRoom()
    const endMsgs = ws.sent.filter((s) => {
      try {
        return JSON.parse(s).type === 'end_room'
      } catch {
        return false
      }
    })
    expect(endMsgs).toHaveLength(1)
    // Server responds with room_closed
    ws.simulateMessage({
      type: 'room_closed',
      reason: 'Host ended the room',
    })
    expect(store.lastErrorCode).toBe('ROOM_CLOSED')
    // No sticky UI message (auto-navigate home is enough)
    expect(store.lastError).toBeNull()
    expect(store.roomCode).toBeNull()
    expect(store.view).toBeNull()
  })

  it('endRoom is rejected for non-host without sending', async () => {
    const { store, ws } = await joinHappyPath('ENDR02', { isHost: false })
    expect(store.isHost).toBe(false)
    const before = ws.sent.length
    store.endRoom()
    expect(ws.sent.length).toBe(before)
    expect(store.lastErrorCode).toBe('UNAUTHORIZED')
  })

  it('guest treats close code 4002 as room closed (no reconnect / no resume token)', async () => {
    const { store, ws } = await joinHappyPath('ENDR03', { isHost: false })
    expect(loadResumeToken('ENDR03')).toBe('tok-1')

    ws.simulateRoomEndedClose()

    expect(store.lastErrorCode).toBe('ROOM_CLOSED')
    expect(store.lastError).toBeNull()
    expect(store.roomCode).toBeNull()
    expect(loadResumeToken('ENDR03')).toBeNull()
    expect(store.canAttemptResume).toBe(false)
    expect(store.isRoomClosed).toBe(true)

    // Auto-reconnect must not open another socket
    await vi.advanceTimersByTimeAsync(30_000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('room_closed clears resume so home cannot rejoin dissolved room', async () => {
    const { store, ws } = await joinHappyPath('ENDR04', { isHost: false })
    saveResumeToken('ENDR04', 'tok-1')
    ws.simulateMessage({
      type: 'room_closed',
      reason: 'Host ended the room',
    })
    expect(loadResumeToken('ENDR04')).toBeNull()
    expect(store.canAttemptResume).toBe(false)

    await expect(store.reconnect()).rejects.toThrow()
    expect(store.lastErrorCode).toBe('ROOM_CLOSED')
    // Must not mention worker:dev
    expect(store.lastError ?? '').not.toMatch(/worker:dev/i)
  })
})
