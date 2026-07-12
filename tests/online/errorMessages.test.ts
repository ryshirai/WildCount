import { describe, expect, it } from 'vitest'
import {
  formatHttpErrorBody,
  formatRoomClosedReason,
  formatServerError,
  isKnownErrorCode,
  isSoftActionError,
} from '@/online/errorMessages'

describe('formatServerError', () => {
  it('maps every primary Phase 1 code to Japanese', () => {
    const codes = [
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
    ] as const

    for (const code of codes) {
      const msg = formatServerError(code)
      expect(msg.length).toBeGreaterThan(0)
      expect(/[\u3040-\u30ff\u4e00-\u9fff]/.test(msg)).toBe(true)
      // Must not leak raw English technical phrases as the whole message
      expect(msg).not.toMatch(/^expectedRevision/)
      expect(msg).not.toMatch(/^Only the host/)
    }
  })

  it('REVISION_MISMATCH is actionable for the player', () => {
    const msg = formatServerError(
      'REVISION_MISMATCH',
      'expectedRevision 3 != 4',
    )
    expect(msg).toContain('もう一度')
    expect(msg).not.toContain('expectedRevision')
  })

  it('refines ILLEGAL_ACTION from English server detail', () => {
    expect(formatServerError('ILLEGAL_ACTION', 'Not your turn')).toContain(
      '手番',
    )
    expect(formatServerError('ILLEGAL_ACTION', 'Game is over')).toContain(
      '終了',
    )
    expect(
      formatServerError('ILLEGAL_ACTION', 'Game is not in progress'),
    ).toContain('進行')
  })

  it('passes through Japanese server messages on ILLEGAL_ACTION', () => {
    const jp = '宣言は現在の最低値以上にしてください'
    expect(formatServerError('ILLEGAL_ACTION', jp)).toBe(jp)
  })

  it('falls back for unknown codes', () => {
    expect(formatServerError('WEIRD_CODE', 'なんか変')).toBe('なんか変')
    expect(formatServerError(null, null)).toBe('エラーが発生しました')
  })
})

describe('isSoftActionError', () => {
  it('treats revision, illegal, and chat soft codes as soft', () => {
    expect(isSoftActionError('REVISION_MISMATCH')).toBe(true)
    expect(isSoftActionError('ILLEGAL_ACTION')).toBe(true)
    expect(isSoftActionError('RATE_LIMITED')).toBe(true)
    expect(isSoftActionError('CHAT_REJECTED')).toBe(true)
    expect(isSoftActionError('ROOM_FULL')).toBe(false)
    expect(isSoftActionError(null)).toBe(false)
  })
})

describe('isKnownErrorCode', () => {
  it('recognizes wire codes', () => {
    expect(isKnownErrorCode('ROOM_FULL')).toBe(true)
    expect(isKnownErrorCode('CONNECTION')).toBe(false)
  })
})

describe('formatRoomClosedReason', () => {
  it('maps inactivity purge', () => {
    const msg = formatRoomClosedReason('Room closed due to inactivity')
    expect(msg).toContain('閉じ')
    expect(msg).not.toMatch(/inactivity/i)
  })

  it('maps host ended the room', () => {
    const msg = formatRoomClosedReason('Host ended the room')
    expect(msg).toContain('ホスト')
    expect(msg).toContain('解散')
    expect(msg).not.toMatch(/Host ended/i)
  })
})

describe('formatHttpErrorBody', () => {
  it('maps Worker JSON error field', () => {
    expect(
      formatHttpErrorBody({ error: 'BAD_REQUEST', message: 'Invalid room code' }),
    ).toContain('リクエスト')
    expect(
      formatHttpErrorBody({ error: 'ROOM_NOT_FOUND', message: 'gone' }),
    ).toContain('ルーム')
  })

  it('includes HTTP status when body empty', () => {
    expect(formatHttpErrorBody({}, 503)).toContain('503')
  })
})
