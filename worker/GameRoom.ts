import {
  applyAction,
  forceEliminatePlayer,
  GameError,
  seedRandom,
  startGame,
  type Card,
  type PlayerId,
} from '../src/domain/game'
import {
  buildPendingResultSnapshot,
  type BidHistoryEntry,
} from './maskedView'
import {
  allConnectedHaveResultAck,
  allPlayersReady,
  appendChatMessage,
  appendStampReaction,
  applyDueDisconnectPolicies,
  applyResultDismiss,
  applySetDeck,
  buildPlayerView,
  clearDisconnectDeadline,
  createEmptyRoom,
  ensureLifecycleFields,
  findPlayerByToken,
  markPlayerDisconnected,
  nextAlarmAt,
  nextAvatarIndex,
  parseClientMessage,
  pickNextHost,
  rememberAction,
  removePlayerFromRoom,
  resetRoomForRematch,
  shouldPurgeRoom,
  type RoomState,
  type WsAttachment,
} from './roomLogic'
import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  type ClientGameAction,
  type Env,
  type ServerMessage,
  type WireDeckComposition,
} from './types'

const STORAGE_ROOM = 'room'

/**
 * One Durable Object per room.
 * P1-2: lobby join / ready / start + view broadcast.
 * P1-3: bid / challenge actions.
 * P1-4: resumeToken reconnect.
 * P1-5: host transfer 60s + idle purge via alarm.
 */
export class GameRoom {
  private readonly state: DurableObjectState

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state

    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    )
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/init') {
      return this.handleInit(request)
    }

    if (request.method === 'GET' && url.pathname === '/meta') {
      return this.handleMeta()
    }

    const upgrade = request.headers.get('Upgrade')
    if (upgrade?.toLowerCase() === 'websocket') {
      return this.handleWebSocketUpgrade()
    }

    return json({ error: 'NOT_FOUND', message: 'Unknown GameRoom route' }, 404)
  }

  private async handleInit(request: Request): Promise<Response> {
    let body: { roomCode?: string } = {}
    try {
      body = (await request.json()) as { roomCode?: string }
    } catch {
      return json({ error: 'BAD_REQUEST', message: 'Invalid JSON' }, 400)
    }

    const roomCode = body.roomCode?.trim().toUpperCase()
    if (!roomCode) {
      return json({ error: 'BAD_REQUEST', message: 'roomCode required' }, 400)
    }

    const existing = await this.loadRoom()
    if (existing) {
      return json({
        ok: true,
        roomCode: existing.roomCode,
        alreadyExisted: true,
      })
    }

    const room = createEmptyRoom(roomCode)
    await this.saveRoom(room)
    await this.scheduleNextAlarm(room)

    return json({ ok: true, roomCode, alreadyExisted: false })
  }

  private async handleMeta(): Promise<Response> {
    const room = await this.loadRoom()
    if (!room) {
      return json({ error: 'ROOM_NOT_FOUND', message: 'Room not initialized' }, 404)
    }
    return json({
      roomCode: room.roomCode,
      createdAt: room.createdAt,
      lastActivityAt: room.lastActivityAt,
      status: room.status,
      hostId: room.hostId,
      playerCount: room.players.length,
      connectedPlayers: room.players.filter((p) => p.connected).length,
      connectionCount: this.state.getWebSockets().length,
      revision: room.revision,
      disconnectDeadlines: room.disconnectDeadlines ?? {},
    })
  }

  private async handleWebSocketUpgrade(): Promise<Response> {
    const room = await this.loadRoom()
    if (!room) {
      return json(
        { error: 'ROOM_NOT_FOUND', message: 'Room not initialized' },
        404,
      )
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    this.state.acceptWebSocket(server)
    // Attachment empty until join — client sends `join` on open (no welcome event)
    server.serializeAttachment({} satisfies WsAttachment)

    room.lastActivityAt = Date.now()
    await this.saveRoom(room)
    await this.scheduleNextAlarm(room)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Binary frames are not supported',
      })
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(message)
    } catch {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Invalid JSON',
      })
      return
    }

    const msg = parseClientMessage(parsed)
    if ('error' in msg) {
      const isUnknown =
        typeof msg.error === 'string' && msg.error.startsWith('Unknown message')
      this.send(ws, {
        type: 'error',
        code: isUnknown ? 'UNKNOWN_TYPE' : 'BAD_REQUEST',
        message: msg.error,
      })
      return
    }

    const room = await this.loadRoom()
    if (!room) {
      this.send(ws, {
        type: 'error',
        code: 'ROOM_NOT_FOUND',
        message: 'Room not initialized',
      })
      return
    }

    switch (msg.type) {
      case 'ping':
        this.send(ws, { type: 'pong' })
        return
      case 'join':
        await this.handleJoin(ws, room, msg.displayName, msg.resumeToken)
        return
      case 'resume':
        await this.handleJoin(ws, room, 'プレイヤー', msg.resumeToken)
        return
      case 'ready':
        await this.handleReady(ws, room, msg.ready)
        return
      case 'start':
        await this.handleStart(ws, room)
        return
      case 'dismiss_result':
        await this.handleDismissResult(ws, room)
        return
      case 'rematch':
        await this.handleRematch(ws, room)
        return
      case 'action':
        await this.handleAction(
          ws,
          room,
          msg.actionId,
          msg.expectedRevision,
          msg.action,
        )
        return
      case 'chat':
        await this.handleChat(ws, room, msg.text)
        return
      case 'reaction':
        await this.handleReaction(ws, room, msg.stampId)
        return
      case 'leave':
        await this.handleLeave(ws, room)
        return
      case 'end_room':
        await this.handleEndRoom(ws, room)
        return
      case 'set_deck':
        await this.handleSetDeck(ws, room, msg.deck)
        return
      default:
        this.send(ws, {
          type: 'error',
          code: 'UNKNOWN_TYPE',
          message: 'Unhandled message',
        })
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = (ws.deserializeAttachment() ?? {}) as WsAttachment
    if (!att.playerId) return

    const room = await this.loadRoom()
    if (!room) return

    // If another socket still holds this player (resume replace), keep connected
    const stillConnected = this.state
      .getWebSockets()
      .some((s) => {
        if (s === ws) return false
        const a = (s.deserializeAttachment() ?? {}) as WsAttachment
        return a.playerId === att.playerId
      })

    if (stillConnected) return

    const player = room.players.find((p) => p.id === att.playerId)
    if (!player) return

    const now = Date.now()

    // Unexpected close (network drop, reload, sleep): keep seat + resumeToken.
    // Playing: 60s forfeit grace. Intentional leave uses handleLeave.
    markPlayerDisconnected(room, att.playerId!, now)
    // Disconnected seats no longer block result ACK completion
    if (room.pendingResult && allConnectedHaveResultAck(room)) {
      room.pendingResult = null
      room.resultAcks = {}
      this.maybeStartNextRound(room)
    }
    room.lastActivityAt = now
    room.revision += 1
    await this.saveRoom(room)
    await this.scheduleNextAlarm(room)
    this.broadcastView(room)
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    // close handler covers disconnect bookkeeping
  }

  /**
   * Host transfer + disconnect forfeit deadlines + idle purge (phase1 §7.5–7.6).
   */
  async alarm(): Promise<void> {
    const room = await this.loadRoom()
    if (!room) {
      await this.state.storage.deleteAlarm()
      return
    }

    const now = Date.now()
    const due = applyDueDisconnectPolicies(room, now)

    if (due.changed) {
      await this.saveRoom(room)
      if (due.hostTransferred && due.newHostId && due.newHostId !== due.previousHostId) {
        const name =
          room.players.find((p) => p.id === due.newHostId)?.displayName ?? '誰か'
        this.broadcast(room, {
          type: 'event',
          level: 'info',
          message: `ホストが ${name} に移譲されました`,
          code: 'HOST_TRANSFERRED',
        })
      }
      for (const id of due.forfeitedIds) {
        const name =
          room.players.find((p) => p.id === id)?.displayName ?? '誰か'
        this.broadcast(room, {
          type: 'event',
          level: 'info',
          message: `${name} が切断タイムアウトで脱落しました`,
          code: 'PLAYER_FORFEIT',
        })
      }
      if (room.game?.phase === 'game_over') {
        const wName = room.game.winnerId
          ? room.players.find((p) => p.id === room.game!.winnerId)?.displayName
          : null
        this.broadcast(room, {
          type: 'event',
          level: 'info',
          message: wName
            ? `ゲーム終了 — ${wName} の勝利（退出・切断）`
            : 'ゲーム終了（退出・切断）',
          code: 'GAME_ENDED',
        })
      }
      this.broadcastView(room)
    }

    if (shouldPurgeRoom(room, now)) {
      await this.purgeRoom()
      return
    }

    await this.scheduleNextAlarm(room)
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private async handleJoin(
    ws: WebSocket,
    room: RoomState,
    displayName: string,
    resumeToken?: string,
  ): Promise<void> {
    // Already joined on this socket → allow name refresh in lobby
    const existingAtt = (ws.deserializeAttachment() ?? {}) as WsAttachment
    if (existingAtt.playerId) {
      const me = room.players.find((p) => p.id === existingAtt.playerId)
      if (me && room.status === 'open') {
        me.displayName = displayName
        me.connected = true
        clearDisconnectDeadline(room, me.id)
        room.lastActivityAt = Date.now()
        room.revision += 1
        await this.saveRoom(room)
        await this.scheduleNextAlarm(room)
        this.sendHello(ws, room, me)
        this.broadcastView(room)
        this.sendChatHistory(ws, room)
        return
      }
      if (me) {
        me.connected = true
        clearDisconnectDeadline(room, me.id)
        room.lastActivityAt = Date.now()
        room.revision += 1
        await this.saveRoom(room)
        await this.scheduleNextAlarm(room)
        this.sendHello(ws, room, me)
        this.sendView(ws, room, me.id)
        this.sendChatHistory(ws, room)
        return
      }
    }

    // Resume existing seat
    if (resumeToken) {
      const resumed = findPlayerByToken(room, resumeToken)
      if (resumed) {
        this.detachOtherSockets(resumed.id, ws)
        resumed.connected = true
        clearDisconnectDeadline(room, resumed.id)
        if (room.status === 'open' && displayName !== 'プレイヤー') {
          resumed.displayName = displayName
        }
        ws.serializeAttachment({ playerId: resumed.id } satisfies WsAttachment)
        room.lastActivityAt = Date.now()
        room.revision += 1
        await this.saveRoom(room)
        await this.scheduleNextAlarm(room)
        this.sendHello(ws, room, resumed)
        this.broadcast(room, {
          type: 'event',
          level: 'info',
          message: `${resumed.displayName} が再接続しました`,
          code: 'RESUME',
        })
        this.broadcastView(room)
        this.sendChatHistory(ws, room)
        return
      }
      // Invalid token after start → refuse new seat
      if (room.status !== 'open') {
        this.send(ws, {
          type: 'error',
          code: 'INVALID_TOKEN',
          message: 'Cannot join: game already started and resume token invalid',
        })
        return
      }
      // fall through to new join
    }

    if (room.status !== 'open') {
      this.send(ws, {
        type: 'error',
        code: 'GAME_ALREADY_STARTED',
        message: 'Game has already started',
      })
      return
    }

    if (room.players.length >= MAX_PLAYERS) {
      this.send(ws, {
        type: 'error',
        code: 'ROOM_FULL',
        message: `Room is full (${MAX_PLAYERS})`,
      })
      return
    }

    const playerId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const player = {
      id: playerId,
      displayName,
      joinedAt: Date.now(),
      ready: false,
      connected: true,
      resumeToken: token,
      avatarIndex: nextAvatarIndex(room),
    }

    room.players.push(player)
    room.resumeTokens[token] = playerId
    if (!room.hostId) {
      room.hostId = playerId
    }

    ws.serializeAttachment({ playerId } satisfies WsAttachment)
    room.lastActivityAt = Date.now()
    room.revision += 1
    await this.saveRoom(room)

    this.sendHello(ws, room, player)
    this.broadcastView(room)
    this.sendChatHistory(ws, room)
  }

  private async handleChat(
    ws: WebSocket,
    room: RoomState,
    text: string,
  ): Promise<void> {
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Join the room first',
      })
      return
    }
    const player = room.players.find((p) => p.id === playerId)
    if (!player) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Player not found',
      })
      return
    }

    const result = appendChatMessage(room, player, text)
    if (!result.ok) {
      this.send(ws, {
        type: 'error',
        code: result.code,
        message: result.message,
      })
      return
    }

    await this.saveRoom(room)
    await this.scheduleNextAlarm(room)
    this.broadcast(room, { type: 'chat', message: result.message })
  }

  /** Fixed stamp reaction (UX-7): chat log + client-side float. */
  private async handleReaction(
    ws: WebSocket,
    room: RoomState,
    stampId: string,
  ): Promise<void> {
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Join first',
      })
      return
    }
    const player = room.players.find((p) => p.id === playerId)
    if (!player) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Player not found',
      })
      return
    }

    const result = appendStampReaction(room, player, stampId)
    if (!result.ok) {
      this.send(ws, {
        type: 'error',
        code: result.code,
        message: result.message,
      })
      return
    }

    await this.saveRoom(room)
    await this.scheduleNextAlarm(room)
    this.broadcast(room, { type: 'chat', message: result.message })
  }

  /**
   * Intentional leave: lobby removes the seat; in-game marks disconnected
   * (seat kept for possible resume until idle purge / game over).
   */
  private async handleLeave(ws: WebSocket, room: RoomState): Promise<void> {
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      // Not joined — just drop the socket attachment path
      try {
        ws.close(1000, 'leave')
      } catch {
        // ignore
      }
      return
    }

    const player = room.players.find((p) => p.id === playerId)
    const name = player?.displayName ?? '誰か'
    const now = Date.now()

    if (room.status === 'open') {
      const result = removePlayerFromRoom(room, playerId)
      if (!result.removed) return

      // Clear attachment so webSocketClose does not re-mark disconnect
      try {
        ws.serializeAttachment({} satisfies WsAttachment)
      } catch {
        // ignore
      }

      room.lastActivityAt = now
      room.revision += 1
      await this.saveRoom(room)
      await this.scheduleNextAlarm(room)

      this.broadcast(room, {
        type: 'event',
        level: 'info',
        message: `${name} が退出しました`,
        code: 'PLAYER_LEFT',
      })
      if (
        result.hostChanged &&
        result.newHostId &&
        result.newHostId !== result.previousHostId
      ) {
        const hostName =
          room.players.find((p) => p.id === result.newHostId)?.displayName ??
          '誰か'
        this.broadcast(room, {
          type: 'event',
          level: 'info',
          message: `ホストが ${hostName} に移譲されました`,
          code: 'HOST_TRANSFERRED',
        })
      }
      this.broadcastView(room)

      try {
        ws.close(1000, 'leave')
      } catch {
        // ignore
      }
      return
    }

    // Playing: intentional leave = immediate forfeit (no reconnect grace)
    const wasPlaying = room.status === 'playing' && room.game != null
    let forfeited = false
    if (wasPlaying && room.game) {
      const gp = room.game.players.find((p) => p.id === playerId)
      if (gp?.alive) {
        room.game = forceEliminatePlayer(room.game, playerId)
        forfeited = true
      }
      for (const [token, id] of Object.entries(room.resumeTokens)) {
        if (id === playerId) delete room.resumeTokens[token]
      }
    }

    // Disconnect first so pickNextHost skips this seat
    markPlayerDisconnected(room, playerId, now)
    // Leave already resolved — no forfeit timer
    clearDisconnectDeadline(room, playerId)
    if (wasPlaying && room.hostId === playerId) {
      room.hostId = pickNextHost(room)?.id ?? null
    }

    if (room.pendingResult && allConnectedHaveResultAck(room)) {
      room.pendingResult = null
      room.resultAcks = {}
      this.maybeStartNextRound(room)
    }
    try {
      ws.serializeAttachment({} satisfies WsAttachment)
    } catch {
      // ignore
    }
    room.lastActivityAt = now
    room.revision += 1
    await this.saveRoom(room)
    await this.scheduleNextAlarm(room)
    this.broadcast(room, {
      type: 'event',
      level: 'info',
      message: forfeited
        ? `${name} が退出しました（脱落）`
        : `${name} が退出しました`,
      code: forfeited ? 'PLAYER_FORFEIT' : 'PLAYER_LEFT',
    })
    if (room.game?.phase === 'game_over') {
      const wName = room.game.winnerId
        ? room.players.find((p) => p.id === room.game!.winnerId)?.displayName
        : null
      this.broadcast(room, {
        type: 'event',
        level: 'info',
        message: wName
          ? `ゲーム終了 — ${wName} の勝利（退出）`
          : 'ゲーム終了（退出）',
        code: 'GAME_ENDED',
      })
    }
    this.broadcastView(room)
    try {
      ws.close(1000, 'leave')
    } catch {
      // ignore
    }
  }

  private async handleReady(
    ws: WebSocket,
    room: RoomState,
    ready: boolean,
  ): Promise<void> {
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Join the room first',
      })
      return
    }
    if (room.status !== 'open') {
      this.send(ws, {
        type: 'error',
        code: 'GAME_ALREADY_STARTED',
        message: 'Game already started',
      })
      return
    }

    const player = room.players.find((p) => p.id === playerId)
    if (!player) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Player not found',
      })
      return
    }

    player.ready = ready
    player.connected = true
    room.lastActivityAt = Date.now()
    room.revision += 1
    await this.saveRoom(room)
    this.broadcastView(room)
  }

  /**
   * Host only, lobby only: update mountain deck composition for next start.
   */
  private async handleSetDeck(
    ws: WebSocket,
    room: RoomState,
    deck: WireDeckComposition,
  ): Promise<void> {
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Join the room first',
      })
      return
    }

    if (playerId !== room.hostId) {
      this.send(ws, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Only the host can change the deck',
      })
      return
    }

    if (room.status !== 'open') {
      this.send(ws, {
        type: 'error',
        code: 'GAME_ALREADY_STARTED',
        message: 'Cannot change deck after start',
      })
      return
    }

    applySetDeck(room, deck)
    room.lastActivityAt = Date.now()
    room.revision += 1
    await this.saveRoom(room)
    this.broadcast(room, {
      type: 'event',
      level: 'info',
      message: '山札の構成を更新しました',
      code: 'DECK_UPDATED',
    })
    this.broadcastView(room)
  }

  private async handleStart(ws: WebSocket, room: RoomState): Promise<void> {
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Join the room first',
      })
      return
    }

    if (playerId !== room.hostId) {
      this.send(ws, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Only the host can start the game',
      })
      return
    }

    if (room.status !== 'open') {
      this.send(ws, {
        type: 'error',
        code: 'GAME_ALREADY_STARTED',
        message: 'Game already started',
      })
      return
    }

    if (room.players.length < MIN_PLAYERS_TO_START) {
      this.send(ws, {
        type: 'error',
        code: 'NOT_ENOUGH_PLAYERS',
        message: `Need at least ${MIN_PLAYERS_TO_START} players`,
      })
      return
    }

    if (!allPlayersReady(room)) {
      this.send(ws, {
        type: 'error',
        code: 'PLAYERS_NOT_READY',
        message: 'All players must be ready before start',
      })
      return
    }

    try {
      const ids = room.players.map((p) => p.id)
      const seed = cryptoSeed()
      ensureLifecycleFields(room)
      const game = startGame(
        {
          playerIds: ids,
          config: { deck: room.deck },
        },
        seedRandom(seed),
      )
      room.game = game
      room.status = 'playing'
      room.bidHistory = []
      room.pendingResult = null
      room.resultAcks = {}
      room.appliedActions = room.appliedActions ?? {}
      room.lastActivityAt = Date.now()
      room.revision += 1
      await this.saveRoom(room)

      this.broadcast(room, {
        type: 'event',
        level: 'info',
        message: 'ゲームを開始しました',
        code: 'GAME_STARTED',
      })
      this.broadcast(room, {
        type: 'event',
        level: 'info',
        message: `第${game.round}ラウンド開始`,
        code: 'ROUND_START',
      })
      this.broadcastView(room)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start'
      this.send(ws, {
        type: 'error',
        code: 'ILLEGAL_ACTION',
        message,
      })
    }
  }

  private async handleAction(
    ws: WebSocket,
    room: RoomState,
    actionId: string,
    expectedRevision: number,
    action: ClientGameAction,
  ): Promise<void> {
    this.ensureRoomDefaults(room)

    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Join the room first',
        actionId,
      })
      return
    }

    if (room.status !== 'playing' || !room.game) {
      this.send(ws, {
        type: 'error',
        code: 'ILLEGAL_ACTION',
        message: 'Game is not in progress',
        actionId,
      })
      return
    }

    // Idempotent replay
    if (room.appliedActions[actionId] != null) {
      this.sendView(ws, room, playerId)
      return
    }

    if (expectedRevision !== room.revision) {
      this.send(ws, {
        type: 'error',
        code: 'REVISION_MISMATCH',
        message: `expectedRevision ${expectedRevision} != ${room.revision}`,
        actionId,
      })
      this.sendView(ws, room, playerId)
      return
    }

    if (room.game.phase === 'game_over') {
      this.send(ws, {
        type: 'error',
        code: 'ILLEGAL_ACTION',
        message: 'Game is over',
        actionId,
      })
      this.sendView(ws, room, playerId)
      return
    }

    // Gate: no bids/challenges until every connected player left the result screen
    if (room.pendingResult || room.game.phase === 'round_end') {
      this.send(ws, {
        type: 'error',
        code: 'ILLEGAL_ACTION',
        message: 'Waiting for all players to leave the result screen',
        actionId,
      })
      this.sendView(ws, room, playerId)
      return
    }

    if (room.game.currentTurnPlayerId !== playerId) {
      this.send(ws, {
        type: 'error',
        code: 'ILLEGAL_ACTION',
        message: 'Not your turn',
        actionId,
      })
      this.sendView(ws, room, playerId)
      return
    }

    try {
      if (action.type === 'PLACE_BID') {
        const round = room.game.round
        const actorId = playerId
        room.game = applyAction(
          room.game,
          { type: 'PLACE_BID', value: action.value },
          seedRandom(cryptoSeed()),
        )
        const entry: BidHistoryEntry = {
          playerId: actorId,
          value: action.value,
          round,
        }
        room.bidHistory = [...room.bidHistory, entry]
        room.revision += 1
        room.appliedActions = rememberAction(
          room.appliedActions,
          actionId,
          room.revision,
        )
        room.lastActivityAt = Date.now()
        await this.saveRoom(room)

        const name =
          room.players.find((p) => p.id === actorId)?.displayName ?? '誰か'
        this.broadcast(room, {
          type: 'event',
          level: 'info',
          message: `${name} が ${action.value} を宣言`,
          code: 'BID',
        })
        this.broadcastView(room)
        return
      }

      // CHALLENGE
      const handsSnapshot: Record<PlayerId, Card> = {
        ...(room.game.hands as Record<PlayerId, Card>),
      }
      const challengedRound = room.game.round
      const challengerId = playerId

      room.game = applyAction(
        room.game,
        { type: 'CHALLENGE' },
        seedRandom(cryptoSeed()),
      )

      const outcome = room.game.lastOutcome
      if (!outcome) {
        throw new Error('Challenge resolved without lastOutcome')
      }

      room.pendingResult = buildPendingResultSnapshot({
        outcome,
        hands: handsSnapshot,
        round: challengedRound,
        winnerId: room.game.winnerId,
      })
      room.resultAcks = {}
      // Stay at round_end until all connected dismiss (START_ROUND then)
      room.bidHistory = []

      room.revision += 1
      room.appliedActions = rememberAction(
        room.appliedActions,
        actionId,
        room.revision,
      )
      room.lastActivityAt = Date.now()
      await this.saveRoom(room)

      const cName =
        room.players.find((p) => p.id === challengerId)?.displayName ?? '誰か'
      this.broadcast(room, {
        type: 'event',
        level: 'info',
        message: `${cName} がコヨーテ！`,
        code: 'CHALLENGE',
      })
      if (room.game.phase === 'game_over') {
        this.broadcast(room, {
          type: 'event',
          level: 'info',
          message: 'ゲーム終了',
          code: 'GAME_ENDED',
        })
      }
      this.broadcastView(room)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Illegal action'
      const code =
        err instanceof GameError && err.code === 'INVALID_BID'
          ? 'ILLEGAL_ACTION'
          : 'ILLEGAL_ACTION'
      this.send(ws, {
        type: 'error',
        code,
        message,
        actionId,
      })
      this.sendView(ws, room, playerId)
    }
  }

  private async handleDismissResult(
    ws: WebSocket,
    room: RoomState,
  ): Promise<void> {
    this.ensureRoomDefaults(room)
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Join the room first',
      })
      return
    }

    const { changed, cleared } = applyResultDismiss(room, playerId)
    if (!changed) {
      // Idempotent: already acked or nothing pending — resend personal view
      this.sendView(ws, room, playerId)
      return
    }

    if (cleared) {
      this.maybeStartNextRound(room)
    }

    room.lastActivityAt = Date.now()
    room.revision += 1
    await this.saveRoom(room)
    // Broadcast so each client gets per-player pendingResult visibility
    this.broadcastView(room)
  }

  /**
   * After all connected players dismissed the result: deal next round if needed.
   * Mutates room.game; caller saves + broadcasts.
   */
  private maybeStartNextRound(room: RoomState): void {
    if (!room.game || room.game.phase !== 'round_end') return
    room.game = applyAction(
      room.game,
      { type: 'START_ROUND' },
      seedRandom(cryptoSeed()),
    )
    room.bidHistory = []
    this.broadcast(room, {
      type: 'event',
      level: 'info',
      message: `第${room.game.round}ラウンド開始`,
      code: 'ROUND_START',
    })
  }

  private async handleRematch(ws: WebSocket, room: RoomState): Promise<void> {
    this.ensureRoomDefaults(room)
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Join the room first',
      })
      return
    }

    if (!room.players.some((p) => p.id === playerId)) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Player not found',
      })
      return
    }

    if (room.status !== 'playing' || !room.game) {
      this.send(ws, {
        type: 'error',
        code: 'ILLEGAL_ACTION',
        message: 'Rematch only after a finished game',
      })
      return
    }

    if (room.game.phase !== 'game_over') {
      this.send(ws, {
        type: 'error',
        code: 'ILLEGAL_ACTION',
        message: 'Game is not over yet',
      })
      return
    }

    resetRoomForRematch(room)
    room.lastActivityAt = Date.now()
    room.revision += 1
    await this.saveRoom(room)
    await this.scheduleNextAlarm(room)

    this.broadcast(room, {
      type: 'event',
      level: 'info',
      message: 'ロビーに戻りました。準備完了してから開始できます',
      code: 'REMATCH',
    })
    this.broadcastView(room)
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private ensureRoomDefaults(room: RoomState): void {
    ensureLifecycleFields(room)
  }

  private async scheduleNextAlarm(room: RoomState): Promise<void> {
    const at = nextAlarmAt(room, Date.now())
    if (at == null) {
      await this.state.storage.deleteAlarm()
      return
    }
    // DO alarms: if scheduled in the past, fire soon
    await this.state.storage.setAlarm(at)
  }

  /**
   * Host dissolves the room for everyone (lobby or mid-game).
   * Single teardown path shared with idle purge.
   */
  private async handleEndRoom(ws: WebSocket, room: RoomState): Promise<void> {
    const playerId = this.playerIdOf(ws)
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Join the room first',
      })
      return
    }

    if (playerId !== room.hostId) {
      this.send(ws, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Only the host can end the room',
      })
      return
    }

    this.broadcast(room, {
      type: 'event',
      level: 'warn',
      message: 'ホストがルームを解散しました',
      code: 'ROOM_ENDED',
    })

    await this.teardownRoom({
      reason: 'Host ended the room',
      closeCode: 4002,
      closeReason: 'host ended room',
    })
  }

  private async purgeRoom(): Promise<void> {
    await this.teardownRoom({
      reason: 'Room closed due to inactivity',
      closeCode: 4001,
      closeReason: 'room purged',
    })
  }

  /**
   * Tear down a GameRoom Durable Object instance storage.
   *
   * 1. Notify clients with room_closed (best-effort)
   * 2. Clear WS attachments so webSocketClose does not re-save room state
   * 3. Close all sockets
   * 4. deleteAlarm + deleteAll (compat date pre-2026-02-24 does not clear
   *    alarms via deleteAll alone — always call deleteAlarm explicitly)
   *
   * Note: idFromName(roomCode) still maps to this DO class instance forever;
   * only storage is freed. Next /init on the same code recreates RoomState.
   */
  private async teardownRoom(opts: {
    reason: string
    closeCode: number
    closeReason: string
  }): Promise<void> {
    for (const sock of this.state.getWebSockets()) {
      try {
        this.send(sock, {
          type: 'room_closed',
          reason: opts.reason,
        })
      } catch {
        // ignore
      }
      try {
        // Prevent webSocketClose from markDisconnected + saveRoom after purge
        sock.serializeAttachment({} satisfies WsAttachment)
      } catch {
        // ignore
      }
      try {
        sock.close(opts.closeCode, opts.closeReason)
      } catch {
        // ignore
      }
    }

    try {
      await this.state.storage.deleteAlarm()
    } catch {
      // ignore
    }
    await this.state.storage.deleteAll()
  }

  private playerIdOf(ws: WebSocket): string | undefined {
    const att = (ws.deserializeAttachment() ?? {}) as WsAttachment
    return att.playerId
  }

  private detachOtherSockets(playerId: string, keep: WebSocket): void {
    for (const s of this.state.getWebSockets()) {
      if (s === keep) continue
      const a = (s.deserializeAttachment() ?? {}) as WsAttachment
      if (a.playerId === playerId) {
        try {
          s.close(4000, 'replaced by resume')
        } catch {
          // ignore
        }
      }
    }
  }

  private sendHello(
    ws: WebSocket,
    room: RoomState,
    player: { id: string; resumeToken: string },
  ): void {
    this.send(ws, {
      type: 'hello',
      playerId: player.id,
      resumeToken: player.resumeToken,
      roomCode: room.roomCode,
      isHost: player.id === room.hostId,
    })
  }

  private sendChatHistory(ws: WebSocket, room: RoomState): void {
    const messages = room.chatLog ?? []
    this.send(ws, { type: 'chat_history', messages })
  }

  private sendView(ws: WebSocket, room: RoomState, selfId: string | null): void {
    this.send(ws, {
      type: 'view',
      revision: room.revision,
      view: buildPlayerView(room, selfId),
    })
  }

  private broadcastView(room: RoomState): void {
    for (const sock of this.state.getWebSockets()) {
      const att = (sock.deserializeAttachment() ?? {}) as WsAttachment
      this.sendView(sock, room, att.playerId ?? null)
    }
  }

  private broadcast(room: RoomState, msg: ServerMessage): void {
    void room
    for (const sock of this.state.getWebSockets()) {
      this.send(sock, msg)
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // socket may already be closing
    }
  }

  private async loadRoom(): Promise<RoomState | null> {
    const room = await this.state.storage.get<RoomState>(STORAGE_ROOM)
    if (!room) return null
    this.ensureRoomDefaults(room)
    return room
  }

  private async saveRoom(room: RoomState): Promise<void> {
    await this.state.storage.put(STORAGE_ROOM, room)
  }
}

function cryptoSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! >>> 0
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  })
}
