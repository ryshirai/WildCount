/**
 * Client stamp catalog (UX-7). Keep in sync with worker/types.ts STAMP_CATALOG.
 */

export const STAMP_CATALOG = [
  { id: 'thumbs', emoji: '👍', label: 'いいね' },
  { id: 'laugh', emoji: '😂', label: '笑う' },
  { id: 'fire', emoji: '🔥', label: '燃える' },
  { id: 'shock', emoji: '😱', label: 'びっくり' },
  { id: 'clap', emoji: '👏', label: '拍手' },
  { id: 'cry', emoji: '😢', label: '悲しい' },
  { id: 'think', emoji: '🤔', label: '考える' },
  { id: 'party', emoji: '🎉', label: 'やった' },
  { id: 'skull', emoji: '💀', label: '詰んだ' },
  { id: 'coyote', emoji: '🐺', label: 'コヨーテ' },
] as const

export type StampId = (typeof STAMP_CATALOG)[number]['id']

export const STAMP_IDS: readonly StampId[] = STAMP_CATALOG.map((s) => s.id)

export function isStampId(id: unknown): id is StampId {
  return typeof id === 'string' && (STAMP_IDS as readonly string[]).includes(id)
}

export function stampEmoji(id: StampId): string {
  const found = STAMP_CATALOG.find((s) => s.id === id)
  return found?.emoji ?? '❓'
}
