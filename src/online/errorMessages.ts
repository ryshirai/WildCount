/**
 * Server error codes → user-facing Japanese copy.
 * Codes: docs/phase1-multiplayer.md §11
 */

export const ONLINE_ERROR_CODES = [
  'UNKNOWN_TYPE',
  'UNAUTHORIZED',
  'ROOM_FULL',
  'ROOM_NOT_FOUND',
  'GAME_ALREADY_STARTED',
  'NOT_ENOUGH_PLAYERS',
  'PLAYERS_NOT_READY',
  'REVISION_MISMATCH',
  'ILLEGAL_ACTION',
  'INVALID_TOKEN',
  'BAD_REQUEST',
  'NOT_IMPLEMENTED',
  'INTERNAL',
  'NOT_FOUND',
  'RATE_LIMITED',
  'CHAT_REJECTED',
] as const

export type OnlineErrorCode = (typeof ONLINE_ERROR_CODES)[number]

/** Client-only codes (not in wire ErrorCode, but used in UI). */
export type ClientErrorCode = OnlineErrorCode | 'ROOM_CLOSED' | 'CONNECTION'

const CODE_MESSAGES: Record<OnlineErrorCode, string> = {
  UNKNOWN_TYPE: '不明な操作です。ページを再読み込みしてください',
  UNAUTHORIZED: 'この操作はホストのみ行えます',
  ROOM_FULL: 'ルームが満員です（最大10人）',
  ROOM_NOT_FOUND:
    'ルームが見つかりません。コードを確認するか、新しいルームを作成してください',
  GAME_ALREADY_STARTED: 'ゲームがすでに始まっています。途中参加はできません',
  NOT_ENOUGH_PLAYERS: '開始には2人以上必要です',
  PLAYERS_NOT_READY: '全員が準備完了してから開始できます',
  REVISION_MISMATCH:
    '状態が更新されました。もう一度操作してください',
  ILLEGAL_ACTION: 'その操作は今はできません',
  INVALID_TOKEN:
    '復帰に失敗しました。ホームからルームコードで再参加してください',
  BAD_REQUEST: 'リクエストが不正です',
  NOT_IMPLEMENTED: 'この機能はまだ実装されていません',
  INTERNAL: 'サーバーで問題が起きました。しばらくしてから再試行してください',
  NOT_FOUND: '見つかりませんでした',
  RATE_LIMITED: '送信が早すぎます。少し待ってからもう一度',
  CHAT_REJECTED: 'メッセージを送信できませんでした',
}

/**
 * Soft errors: state is still usable; user can retry without leaving.
 * REVISION_MISMATCH already gets a fresh view from the server.
 */
export function isSoftActionError(code: string | null | undefined): boolean {
  return (
    code === 'REVISION_MISMATCH' ||
    code === 'ILLEGAL_ACTION' ||
    code === 'RATE_LIMITED' ||
    code === 'CHAT_REJECTED'
  )
}

export function isKnownErrorCode(code: string): code is OnlineErrorCode {
  return (ONLINE_ERROR_CODES as readonly string[]).includes(code)
}

/**
 * Refine ILLEGAL_ACTION using server English message when possible.
 */
function refineIllegalAction(serverMessage?: string): string {
  if (!serverMessage) return CODE_MESSAGES.ILLEGAL_ACTION
  const m = serverMessage.toLowerCase()
  if (m.includes('not your turn')) return 'あなたの手番ではありません'
  if (m.includes('game is over')) return 'ゲームは終了しています'
  if (m.includes('not in progress')) return 'ゲーム進行中ではありません'
  if (m.includes('bid must be') || m.includes('invalid bid')) {
    return '宣言の値が不正です'
  }
  if (m.includes('cannot challenge') || m.includes('no bid')) {
    return '今はチャレンジできません'
  }
  if (m.includes('not over') || m.includes('rematch only')) {
    return 'ゲーム終了後にもう一度遊べます'
  }
  if (m.includes('result screen') || m.includes('leave the result')) {
    return '全員が結果画面を閉じるまでお待ちください'
  }
  // Domain / engine Japanese or other already-friendly text
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(serverMessage)) {
    return serverMessage
  }
  return CODE_MESSAGES.ILLEGAL_ACTION
}

/**
 * Map wire / HTTP error code (+ optional server message) to Japanese UI text.
 */
export function formatServerError(
  code: string | null | undefined,
  serverMessage?: string | null,
): string {
  if (code && isKnownErrorCode(code)) {
    if (code === 'ILLEGAL_ACTION') {
      return refineIllegalAction(serverMessage ?? undefined)
    }
    return CODE_MESSAGES[code]
  }
  // Fallback: prefer Japanese-looking server text, else generic
  if (serverMessage && /[\u3040-\u30ff\u4e00-\u9fff]/.test(serverMessage)) {
    return serverMessage
  }
  if (serverMessage && serverMessage.trim()) {
    return serverMessage
  }
  return 'エラーが発生しました'
}

/**
 * room_closed.reason (currently English from Worker).
 */
export function formatRoomClosedReason(reason: string | null | undefined): string {
  if (!reason) return 'ルームが閉じられました'
  const r = reason.toLowerCase()
  if (r.includes('host ended') || r.includes('host dissolved') || r.includes('ended the room')) {
    return 'ホストがルームを解散しました'
  }
  if (r.includes('inactivity') || r.includes('idle')) {
    return 'しばらく操作がなかったため、ルームが閉じられました'
  }
  if (r.includes('purge') || r.includes('deleted')) {
    return 'ルームが削除されました'
  }
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(reason)) return reason
  return 'ルームが閉じられました'
}

/**
 * Parse HTTP JSON error body from Worker (`{ error, message }`).
 */
export function formatHttpErrorBody(
  body: { error?: string; message?: string } | null | undefined,
  httpStatus?: number,
): string {
  if (body?.error) {
    return formatServerError(body.error, body.message)
  }
  if (body?.message && /[\u3040-\u30ff\u4e00-\u9fff]/.test(body.message)) {
    return body.message
  }
  if (httpStatus != null) {
    return `リクエストに失敗しました (HTTP ${httpStatus})`
  }
  return 'リクエストに失敗しました'
}
