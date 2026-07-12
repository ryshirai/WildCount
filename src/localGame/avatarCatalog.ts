/**
 * Avatar asset catalog (Phase B0).
 * Spec source: docs/design-polish-plan.md § Phase B0
 *
 * Used by profiles / UI (Phase B3) for paths and emoji fallbacks.
 */

/** Canonical asset id = file stem under public/avatars/ */
export type AvatarAssetId =
  | 'self'
  | 'owl'
  | 'kit'
  | 'raccoon'
  | 'wolf'
  | 'fox'
  | 'deer'
  | 'falcon'
  | 'squirrel'
  | 'coyote'

export interface AvatarAssetMeta {
  id: AvatarAssetId
  /** Default display name (Japanese) */
  name: string
  /** Emoji fallback when image is missing or fails to load */
  emoji: string
  /** Optional notes for generators / designers */
  note?: string
}

/** Public URL path for an avatar WebP (served from public/avatars/). */
export function avatarSrc(id: AvatarAssetId): string {
  return `/avatars/${id}.webp`
}

/** Full catalog — order is display / generation priority for the 10-set. */
export const AVATAR_ASSETS: readonly AvatarAssetMeta[] = [
  { id: 'self', name: 'あなた', emoji: '🐻', note: 'Local player; brown bear portrait' },
  { id: 'owl', name: 'フクロウ', emoji: '🦉', note: 'Cowboy hat OK (mock)' },
  { id: 'kit', name: 'キタロー', emoji: '🦊', note: 'Fox kit; demo seat 3' },
  { id: 'raccoon', name: 'アライグマ', emoji: '🦝' },
  { id: 'wolf', name: 'オオカミ', emoji: '🐺' },
  { id: 'fox', name: 'キツネ', emoji: '🦊', note: 'Adult fox; distinct from kit' },
  { id: 'deer', name: 'シカ', emoji: '🦌' },
  { id: 'falcon', name: 'ハヤブサ', emoji: '🦅' },
  { id: 'squirrel', name: 'リス', emoji: '🐿️' },
  { id: 'coyote', name: 'コヨーテ', emoji: '🐺', note: 'Brand-leaning; optional' },
] as const

const byId = new Map(AVATAR_ASSETS.map((a) => [a.id, a]))

export function getAvatarAsset(id: AvatarAssetId): AvatarAssetMeta {
  const found = byId.get(id)
  if (!found) {
    throw new Error(`Unknown avatar asset id: ${id}`)
  }
  return found
}

/**
 * Demo lineup (4 players): player id → asset id.
 * Matches DEFAULT_PROFILES seat order in profiles.ts.
 */
export const DEMO_PLAYER_ASSET_IDS: Readonly<Record<string, AvatarAssetId>> = {
  self: 'self',
  bot1: 'owl',
  bot2: 'kit',
  bot3: 'wolf',
}

/** B1 priority: generate these four first. */
export const DEMO_AVATAR_IDS: readonly AvatarAssetId[] = [
  'self',
  'owl',
  'kit',
  'wolf',
] as const

/** Display size tokens used by PlayerAvatar (CSS diameter approx.). */
export const AVATAR_DISPLAY_PX = {
  sm: 36,
  md: 44,
  lg: 56,
} as const

/** Repository master / ship resolution (square). */
export const AVATAR_MASTER_PX = 512
export const AVATAR_SHIP_PX = 256
