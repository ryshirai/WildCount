/**
 * Client stamp catalog (UX-7). Keep in sync with worker/types.ts STAMP_CATALOG.
 *
 * Character-skinned art: `public/stamps/{avatarId}/{stampId}.webp`
 * for the 9 emotion stamps × 10 avatar animals (not the brand `coyote` stamp).
 */

import type { AvatarAssetId } from '@/localGame/avatarCatalog'
import { AVATAR_ASSETS } from '@/localGame/avatarCatalog'

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

/**
 * Emotion stamps with per-character WebP art under `public/stamps/`.
 * Brand stamp `coyote` stays emoji-only for all seats.
 */
export const CHARACTER_STAMP_IDS = [
  'thumbs',
  'laugh',
  'fire',
  'shock',
  'clap',
  'cry',
  'think',
  'party',
  'skull',
] as const satisfies readonly StampId[]

export type CharacterStampId = (typeof CHARACTER_STAMP_IDS)[number]

const CHARACTER_STAMP_SET = new Set<string>(CHARACTER_STAMP_IDS)
const AVATAR_ID_SET = new Set<string>(AVATAR_ASSETS.map((a) => a.id))

export function isStampId(id: unknown): id is StampId {
  return typeof id === 'string' && (STAMP_IDS as readonly string[]).includes(id)
}

export function isCharacterStampId(id: unknown): id is CharacterStampId {
  return typeof id === 'string' && CHARACTER_STAMP_SET.has(id)
}

export function stampEmoji(id: StampId): string {
  const found = STAMP_CATALOG.find((s) => s.id === id)
  return found?.emoji ?? '❓'
}

/**
 * Public URL for a character-skinned stamp image, or null when no art exists
 * (unknown avatar, brand stamp, etc.). Callers fall back to emoji.
 */
export function characterStampSrc(
  avatarId: AvatarAssetId | string | null | undefined,
  stampId: StampId | string | null | undefined,
): string | null {
  if (!avatarId || !stampId) return null
  if (!AVATAR_ID_SET.has(avatarId)) return null
  if (!isCharacterStampId(stampId)) return null
  return `/stamps/${avatarId}/${stampId}.webp`
}
