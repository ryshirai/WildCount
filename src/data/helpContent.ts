/**
 * In-app help copy (UX-5).
 * Spec sources: docs/game-rules.md, docs/card-design.md (deck counts via STANDARD_DECK).
 */

export type HelpTabId = 'basics' | 'cards' | 'calc' | 'controls'

export interface HelpTab {
  id: HelpTabId
  label: string
}

export const HELP_TABS: readonly HelpTab[] = [
  { id: 'basics', label: '遊び方' },
  { id: 'cards', label: '特殊札' },
  { id: 'calc', label: '合計計算' },
  { id: 'controls', label: '操作' },
] as const

export interface HelpSpecialCard {
  /** Short face label */
  face: string
  /** CSS kind used by RevealCardTile-like styling hints */
  kind: 'double' | 'max_to_zero' | 'redraw' | 'zero_mix' | 'number'
  name: string
  effect: string
  count: number
}

export interface HelpNumberRange {
  label: string
  detail: string
}

export const HELP_SPECIALS: readonly HelpSpecialCard[] = [
  {
    face: '×2',
    kind: 'double',
    name: 'DOUBLE（倍化）',
    effect:
      '合計値を2倍にする。複数枚あれば累積（2枚で×4）。数値の合計のあとに適用。',
    count: 1,
  },
  {
    face: 'M→0',
    kind: 'max_to_zero',
    name: '最大値0化（MAX→0）',
    effect:
      'そのラウンドで正の最大値を0にする。同じ最大値が複数あればすべて0。手札面は M→0。',
    count: 1,
  },
  {
    face: '?',
    kind: 'redraw',
    name: '引き直し',
    effect:
      '配られた時点で捨てて、山札から1枚引き直す。手札には残らない。',
    count: 1,
  },
  {
    face: '0*',
    kind: 'zero_mix',
    name: '捨て札ミックス0',
    effect:
      '数値は0として合計に入る。配札後、捨て札を山へ戻してシャッフルする。',
    count: 1,
  },
] as const

export const HELP_NUMBER_SUMMARY: readonly HelpNumberRange[] = [
  { label: '正の数字', detail: '+1〜+20（高値ほど枚数は少ない）' },
  { label: '0', detail: '通常0が3枚（安全寄り）' },
  { label: '負の数字', detail: '−5×2、−10×1' },
] as const

/** Default deck size (STANDARD_DECK). */
export const HELP_DECK_SIZE = 36

export const HELP_BASICS = {
  tagline: '見えている札だけを頼りに、合計を宣言してブラフする推理ゲームです。',
  bullets: [
    'プレイヤーは2〜10人。ライフは各3（設定により変更可）。最後の1人が勝ち。',
    '自分の札は見えない（額に貼るイメージ）。他プレイヤーの札は見える。',
    '手番では「いまの宣言より大きい数を宣言」するか、「コヨーテ！（チャレンジ）」する。',
    'チャレンジ後に全札を公開し、合計と宣言を比較。負けた側のライフが−1。',
    '生存が1人になるまでラウンドを繰り返す。',
  ],
  visibilityNote:
    'オンラインではサーバーも自分の札を送らないため、自分の画面では常に「？」です。',
} as const

export const HELP_CALC_STEPS = [
  'ラウンドに出ているカードを集める',
  'MAX→0 を適用（正の最大値を0に）',
  '数値カードを合計する（負の値もそのまま加算）',
  '×2（DOUBLE）を枚数分だけ累積で適用',
  '最終合計が確定',
] as const

export const HELP_CHALLENGE_RULE = {
  title: 'チャレンジの勝敗',
  lines: [
    '実際の合計 ≥ 宣言値 → 宣言側の勝ち（同値も宣言側）',
    '実際の合計 < 宣言値 → チャレンジ側の勝ち',
    'チャレンジの対象は、直前に宣言したプレイヤー。',
  ],
} as const

export const HELP_CONTROLS = {
  turn: [
    '宣言: ステッパーで数値を選び「宣言する」。初手の下限は1。以降は現在宣言より大きい整数のみ。',
    'コヨーテ！: 直前の宣言が怪しいと思ったらチャレンジ。パスはできません（宣言かチャレンジのみ）。',
  ],
  online: [
    'ホームでルームを作成 → 6文字コードを共有。',
    '参加側はコードを入力して入室。全員が準備完了したらホストが開始。',
    '切断しても同じ端末なら「前回のルームに戻る」や自動再接続で席に復帰できます。',
  ],
  result: [
    'チャレンジ後はカットイン → 札の公開 → 結果画面で計算過程と勝敗を確認。',
    '「次のラウンドへ」で続行。「もう一度遊ぶ」で同じルームのロビーから再戦できます。',
  ],
} as const
