/**
 * In-app help copy (UX-5).
 * Spec sources: docs/game-rules.md, docs/card-design.md (deck counts via STANDARD_DECK).
 * Tone: plain Japanese for players (not internal jargon).
 */

export type HelpTabId = 'basics' | 'cards' | 'calc' | 'controls'

export interface HelpTab {
  id: HelpTabId
  label: string
}

export const HELP_TABS: readonly HelpTab[] = [
  { id: 'basics', label: '遊び方' },
  { id: 'cards', label: '特殊札' },
  { id: 'calc', label: '合計の出し方' },
  { id: 'controls', label: '操作' },
] as const

export interface HelpSpecialCard {
  /** Short face label */
  face: string
  /** CSS kind used by RevealCardTile-like styling hints */
  kind: 'double' | 'half' | 'max_to_zero' | 'redraw' | 'zero_mix' | 'number'
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
    name: '倍化（×2）',
    effect:
      '数字を足し終わったあと、合計を2倍にします。2枚あれば×4、3枚あれば×8…と積み重なります。',
    count: 1,
  },
  {
    face: '1/2',
    kind: 'half',
    name: '半減（1/2）',
    effect:
      '山札カスタムで入れられる特殊札です（スタンダードでは0枚）。合計を半分にし、端数は0方向に切り捨てます。×2と同時なら打ち消し合います。',
    count: 0,
  },
  {
    face: 'M→0',
    kind: 'max_to_zero',
    name: '最大値ゼロ（M→0）',
    effect:
      '場に出ている「いちばん大きいプラスの数字」を0にします。同じ数字が何枚あっても、全部まとめて0になります。',
    count: 1,
  },
  {
    face: '?',
    kind: 'redraw',
    name: '引き直し',
    effect:
      '配られた瞬間に捨てて、山札から別の1枚を引き直します。最終的な手札には残りません。',
    count: 1,
  },
  {
    face: '0*',
    kind: 'zero_mix',
    name: '捨て札ミックス（0*）',
    effect:
      '合計では0として数えます。配ったあと、捨て札を山に戻してシャッフルします。',
    count: 1,
  },
] as const

export const HELP_NUMBER_SUMMARY: readonly HelpNumberRange[] = [
  { label: 'プラス', detail: '+1〜+20（大きい数字ほど少なめ）' },
  { label: '0', detail: 'スタンダードでは3枚（無難な札）' },
  { label: 'マイナス', detail: '−5が2枚、−10が1枚' },
] as const

/** Default deck size (STANDARD_DECK). */
export const HELP_DECK_SIZE = 36

export const HELP_BASICS = {
  tagline:
    '見えている札だけを頼りに、合計を読み合って宣言する推理・ブラフゲームです。',
  bullets: [
    '2〜10人でプレイ。ライフは各3（設定で変更可）。基本は誰か1人がライフ0になったら終了。ルーム設定で「勝ち残り」にすると最後の1人まで続けられます。',
    '自分の札は見えません（おでこに貼るイメージ）。他の人の札は見えます。',
    '手番では「いまの宣言より大きい数を出す」か、「コヨーテ！（チャレンジ）」のどちらかです。',
    'チャレンジすると全員の札が公開され、実際の合計と宣言をくらべます。負けた方のライフが1減ります。',
    '生き残りが1人になるまで、ラウンドをくり返します。',
  ],
  visibilityNote:
    'オンラインでは自分の札はサーバーからも送られないため、画面上はずっと「？」のままです。それがこのゲームのルールです。',
  /** Soft intro shown under basics (optional rules) */
  extrasLead:
    'ロビーでは、ホストが「エクストラルール」を足せます。はじめは全部オフで、ふつうの遊び方と同じです。オンにした分だけ、ちょっとした特殊能力が使えます。',
  extrasTips: [
    '特殊能力は「1人につき、そのラウンドで1回まで」です。セイム・チェンジ・リバースなど、どれか1つ使ったら、そのラウンドはもう使えません。',
    'リバース・ショット・ドロー・ダブルは、宣言するときに一緒に乗せます。セイムとチェンジは、宣言とは別にボタンで使います。',
    '1/2 の札はエクストラではなく、山札の枚数設定で入れます。',
  ],
} as const

export const HELP_CALC_STEPS = [
  '場に出ているカードを集める',
  'M→0 があれば、いちばん大きいプラスの数字を0にする',
  '数字カードを足す（マイナスもそのまま足す）',
  '×2 と 1/2 があればまとめて倍率をかけ、0方向に切り捨てる',
  '最終合計が決まる',
] as const

/**
 * Extra rules — player-facing, plain language.
 * Spec detail: docs/extra-rules.md
 */
export const HELP_EXTRA_RULES = {
  intro:
    '「あったら楽しいオプション」です。ホストがロビーでオン／オフを決めます。最初は全部オフ＝いつもの遊び方のままです。',
  sharedNote:
    'オンにした能力は、どれも「特殊能力」です。1人につき、そのラウンドで1回だけ使えます（どれか1つ使ったら、そのラウンドは終わり）。次のラウンドでまた使えます。',
  items: [
    {
      emoji: '✋',
      name: 'セイム',
      detail:
        '「今の宣言のままパス」します。数字を上げずに次の人へ。ただし、直前の人もセイムした直後は使えません。',
    },
    {
      emoji: '🔀',
      name: 'チェンジ',
      detail:
        '直前に宣言した人に、「もう一度数字を付け直して」と強制します。同じ数字はダメです。付け直しのあと、手番は自分に戻ります。',
    },
    {
      emoji: '🔄',
      name: 'リバース',
      detail:
        '宣言と一緒に使います。手番の回る向きが逆になります。',
    },
    {
      emoji: '🎯',
      name: 'ショット',
      detail:
        '宣言と一緒に使います。次の手番を、好きな生きている人（自分以外）に指名できます。',
    },
    {
      emoji: '🃏',
      name: 'ドロー',
      detail:
        '宣言と一緒に使います。誰か1人（自分以外）に札を1枚足します。テーブル全体で、そのラウンド1回だけです。',
    },
    {
      emoji: '⚡',
      name: 'ダブル',
      detail:
        '宣言と一緒に使います。次の人がすぐコヨーテ！してきたときだけ、負けた人のライフが2減ります。次の人が宣言やセイムをしたら無効です。',
    },
  ],
  deckNote:
    '1/2 の札はここではなく「山札」の設定で枚数を決めます。場に出ると合計が半分になります（端数は0に近い方へ切り捨て）。',
} as const

export const HELP_CHALLENGE_RULE = {
  title: 'チャレンジの勝敗',
  lines: [
    '実際の合計が宣言以上 → 宣言した人の勝ち（同じ数字でも宣言側）',
    '実際の合計が宣言より小さい → チャレンジした人の勝ち',
    'チャレンジできるのは、直前に宣言した人に対してだけです。',
  ],
} as const

export const HELP_CONTROLS = {
  turn: [
    '宣言: ＋/− で数字を選び、「宣言する」を押します。最初は1以上。2回目以降は、いまの宣言より大きい数だけ選べます。',
    'コヨーテ！: 「いまの宣言、高すぎない？」と思ったら押します。札が全部公開されます。',
    '特殊能力（エクストラON時）: セイム・チェンジはボタン。リバースなどは宣言のときに一緒に選べます。1ラウンド1回まで。',
    '演出（RALLY / HEAT / NICE RAISE など）: 連続宣言や大幅アップを盛り上げる表示です。点数や倍率にはなりません。',
    'COYOTE 結果: コヨーテ後はカットイン → 札公開 → 合計のホールド → 判定の順。PERFECT / CLUTCH / WILD REVERSAL などは公開された結果だけから出る演出ラベルです。',
    '効果音: ホームで ON/OFF と音量。ゲーム中はヘッダの 🔊 でミュートできます。音だけから手札は分かりません。',
  ],
  online: [
    'ホームでルームを作ると、6文字のコードが発行されます。友だちにくばってください。',
    '参加する人はコードを入れて入室。全員が「準備完了」にしたら、ホストが開始できます。',
    'エクストラルールや山札は、ホストがロビーで変えられます。',
    '回線が切れても、同じ端末なら「前回のルームに戻る」や自動再接続で席に戻れます。',
  ],
  result: [
    'チャレンジ後は「コヨーテ！」演出 → 札の公開 → 結果画面で計算と勝敗を確認します。',
    '「次のラウンドへ」で続行。「もう一度遊ぶ」で同じルームのロビーから再戦できます（他の人は自分のタイミングでロビーへ）。',
  ],
} as const
