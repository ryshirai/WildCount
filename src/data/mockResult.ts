import { avatarSrc } from '@/localGame/avatarCatalog'
import type { ResultMock } from '@/types/game'

/**
 * Card-reveal / score mock after a Coyote challenge.
 * Numbers are illustrative only — not wired to the game engine.
 * Calc order follows docs/game-rules.md (MAX→0 → sum → DOUBLE).
 */
export const mockResult: ResultMock = {
  roomCode: 'AB7KQ2',
  round: 3,
  bidValue: 18,
  bidderName: 'ハヤブサ',
  bidderAvatar: '🦅',
  bidderAvatarSrc: avatarSrc('falcon'),
  challengerName: 'あなた',
  challengerAvatar: '🐻',
  challengerAvatarSrc: avatarSrc('self'),
  cards: [
    {
      playerId: 'p1',
      playerName: 'フクロウ',
      avatar: '🦉',
      avatarSrc: avatarSrc('owl'),
      kind: 'number',
      value: -5,
      label: '-5',
      isSelf: false,
    },
    {
      playerId: 'p2',
      playerName: 'キタロー',
      avatar: '🦊',
      avatarSrc: avatarSrc('kit'),
      kind: 'number',
      value: 5,
      label: '+5',
      isSelf: false,
    },
    {
      playerId: 'p3',
      playerName: 'アライグマ',
      avatar: '🦝',
      avatarSrc: avatarSrc('raccoon'),
      kind: 'number',
      value: 10,
      label: '+10',
      isSelf: false,
    },
    {
      playerId: 'p4',
      playerName: 'オオカミ',
      avatar: '🐺',
      avatarSrc: avatarSrc('wolf'),
      kind: 'number',
      value: 3,
      label: '+3',
      isSelf: false,
    },
    {
      playerId: 'p5',
      playerName: 'キツネ',
      avatar: '🦊',
      avatarSrc: avatarSrc('fox'),
      kind: 'max_to_zero',
      value: null,
      label: 'MAX→0',
      isSelf: false,
    },
    {
      playerId: 'p6',
      playerName: 'シカ',
      avatar: '🦌',
      avatarSrc: avatarSrc('deer'),
      kind: 'number',
      value: 4,
      label: '+4',
      isSelf: false,
    },
    {
      playerId: 'p7',
      playerName: 'ハヤブサ',
      avatar: '🦅',
      avatarSrc: avatarSrc('falcon'),
      kind: 'double',
      value: null,
      label: '×2',
      isSelf: false,
    },
    {
      playerId: 'p8',
      playerName: 'あなた',
      avatar: '🐻',
      avatarSrc: avatarSrc('self'),
      // Demo: was `?` → opened to +2 on result screen
      kind: 'number',
      value: 2,
      label: '+2',
      isSelf: true,
      openedFromRedraw: true,
    },
    {
      playerId: 'p9',
      playerName: 'クマ',
      avatar: '🐻',
      avatarSrc: avatarSrc('self'),
      kind: 'number',
      value: 1,
      label: '+1',
      isSelf: false,
    },
    {
      playerId: 'p10',
      playerName: 'リス',
      avatar: '🐿️',
      avatarSrc: avatarSrc('squirrel'),
      kind: 'number',
      value: 0,
      label: '0',
      isSelf: false,
    },
  ],
  calcSteps: [
    {
      id: 'redraw_open',
      title: '？オープン',
      detail: '？→+2（あなた）',
    },
    {
      id: 's1',
      title: '1. 場のカード',
      detail: '10枚を公開（数字・M→0・×2）',
    },
    {
      id: 's2',
      title: '2. M→0（最大値をゼロに）',
      detail: 'いちばん大きいプラス +10 を 0 に（アライグマ）',
      totalAfter: undefined,
    },
    {
      id: 's3',
      title: '3. 数字を足す',
      detail: '-5 + 5 + 0 + 3 + 4 + 2 + 1 + 0 = 10',
      totalAfter: 10,
    },
    {
      id: 's4',
      title: '4. ×2（倍化）',
      detail: '×2 が 1 枚 → 10 × 2 = 20',
      totalAfter: 20,
    },
    {
      id: 's5',
      title: '5. 最終合計',
      detail: '合計は 20',
      totalAfter: 20,
    },
  ],
  finalTotal: 20,
  // actualTotal (20) >= bid (18) → bidder wins, challenger loses a life
  bidderWins: true,
  lifeLostName: 'あなた',
  lifeLostAvatar: '🐻',
  lifeLostAvatarSrc: avatarSrc('self'),
  lifeLoss: 1,
  livesAfter: 2,
  eliminated: false,
  selfIsLoser: true,
}

/**
 * DEV debug: multiple `?` opens in one result (stagger + self/other).
 * Open via `/result?mock=1&fx=qopen`.
 */
export const mockResultQOpen: ResultMock = {
  ...mockResult,
  roomCode: 'QOPEN1',
  round: 7,
  bidValue: 12,
  cards: mockResult.cards.map((c) => {
    // Self: ? → +2
    if (c.playerId === 'p8') {
      return { ...c, openedFromRedraw: true }
    }
    // Other mid table: ? → +5
    if (c.playerId === 'p2') {
      return { ...c, openedFromRedraw: true }
    }
    // Special from ?: ? → ×2
    if (c.playerId === 'p7') {
      return { ...c, openedFromRedraw: true }
    }
    return { ...c, openedFromRedraw: false }
  }),
  calcSteps: [
    {
      id: 'redraw_open',
      title: '？オープン',
      detail: '？→+5 / ？→×2 / ？→+2（あなた）',
    },
    ...mockResult.calcSteps.filter((s) => s.id !== 'redraw_open'),
  ],
  finalTotal: 20,
}
