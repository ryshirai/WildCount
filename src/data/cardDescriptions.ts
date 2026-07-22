/**
 * Short face-up card descriptions for field tooltips (hover / tap).
 * Indian poker: own forehead is mystery — never call this for hidden hands.
 * Spec tone: docs/game-rules.md, helpContent HELP_SPECIALS (short form).
 */

export interface CardFaceDescription {
  /** Display name e.g. 倍化（×2） */
  name: string
  /** One-line effect for popover */
  effect: string
}

const SPECIALS: Readonly<Record<string, CardFaceDescription>> = {
  '×2': {
    name: '倍化（×2）',
    effect: '数字を足したあと、合計を2倍にする。',
  },
  x2: {
    name: '倍化（×2）',
    effect: '数字を足したあと、合計を2倍にする。',
  },
  X2: {
    name: '倍化（×2）',
    effect: '数字を足したあと、合計を2倍にする。',
  },
  '1/2': {
    name: '半減（1/2）',
    effect: '合計を半分にする（端数は0に近い方へ切り捨て）。×2と同時なら打ち消し合う。',
  },
  'M→0': {
    name: '最大値ゼロ（M→0）',
    effect: '場でいちばん大きいプラスの数字を、同じ値ごとまとめて0にする。',
  },
  'MAX→0': {
    name: '最大値ゼロ（M→0）',
    effect: '場でいちばん大きいプラスの数字を、同じ値ごとまとめて0にする。',
  },
  '?': {
    name: '引き直し',
    effect: 'チャレンジ後の公開で山札から1枚オープンする（合計に使う）。',
  },
  '？': {
    name: '引き直し',
    effect: 'チャレンジ後の公開で山札から1枚オープンする（合計に使う）。',
  },
  '0*': {
    name: '山に戻す（0）',
    effect: '合計では0。配ったあと、捨て札を山に戻してシャッフルする。',
  },
}

/** Own forehead / unknown tile — never reveals identity. */
export const MYSTERY_CARD_DESCRIPTION: CardFaceDescription = {
  name: '非公開',
  effect: '自分の札は見えない（おでこに貼るイメージ）。',
}

/**
 * Resolve a short description from a face label (e.g. "+5", "×2").
 * Returns null when label is empty.
 */
export function describeCardFace(
  label: string | null | undefined,
): CardFaceDescription | null {
  if (label == null) return null
  const t = label.trim()
  if (!t) return null

  const special = SPECIALS[t]
  if (special) return special

  // zero_mix sometimes rendered with suffix text
  if (t.startsWith('0*')) return SPECIALS['0*']!

  // Number faces: +20, +5, 0, -5, -10, etc.
  if (/^[+-]?\d+$/.test(t)) {
    const n = Number(t)
    if (n > 0) {
      return {
        name: `数字札 ${t}`,
        effect: `合計に ${t} を加える。`,
      }
    }
    if (n < 0) {
      return {
        name: `数字札 ${t}`,
        effect: `合計に ${t} を加える（マイナス）。`,
      }
    }
    return {
      name: '数字札 0',
      effect: '合計に 0 を加える（無難な札）。',
    }
  }

  return {
    name: t,
    effect: '効果はヘルプの「特殊札」で確認できます。',
  }
}
