/**
 * Minimal Cloudflare Worker / Durable Object typings for the worker package.
 * Avoids a hard dependency on @cloudflare/workers-types for scaffold builds.
 * Runtime types are provided by workerd via wrangler.
 */

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId
  idFromString(id: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
  newUniqueId(): DurableObjectId
}

interface DurableObjectId {
  toString(): string
  equals(other: DurableObjectId): boolean
  name?: string
}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface DurableObjectState {
  readonly id: DurableObjectId
  readonly storage: DurableObjectStorage
  acceptWebSocket(ws: WebSocket, tags?: string[]): void
  getWebSockets(tag?: string): WebSocket[]
  setWebSocketAutoResponse(pair?: WebSocketRequestResponsePair): void
  getWebSocketAutoResponse(): WebSocketRequestResponsePair | null
  setHibernatableWebSocketEventTimeout(timeoutMs?: number): void
  waitUntil(promise: Promise<unknown>): void
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>
  put<T>(key: string, value: T): Promise<void>
  put<T>(entries: Record<string, T>): Promise<void>
  delete(key: string): Promise<boolean>
  delete(keys: string[]): Promise<number>
  deleteAll(): Promise<void>
  list<T = unknown>(options?: {
    start?: string
    end?: string
    prefix?: string
    reverse?: boolean
    limit?: number
  }): Promise<Map<string, T>>
  getAlarm(): Promise<number | null>
  setAlarm(scheduledTime: number | Date): Promise<void>
  deleteAlarm(): Promise<void>
}

declare class WebSocketRequestResponsePair {
  constructor(request: string, response: string)
  readonly request: string
  readonly response: string
}

declare class WebSocketPair {
  0: WebSocket
  1: WebSocket
}

interface WebSocket {
  serializeAttachment(attachment: unknown): void
  deserializeAttachment(): unknown
}

/** Cloudflare Workers 101 WebSocket upgrade response. */
interface ResponseInit {
  webSocket?: WebSocket
}
