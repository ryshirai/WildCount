/**
 * Avatar asset catalog (Phase B0).
 * Spec source: docs/design-polish-plan.md § Phase B0
 *
 * Used by profiles / UI (Phase B3) for paths and emoji fallbacks.
 */

// Relative import: worker/roomLogic also pulls this module (no `@/` paths there).
import { withAssetVersion } from '../config/assetVersion'

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
  | 'koi'
  | 'crow'
  | 'peacock'
  | 'hyena'
  | 'cat'

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
  return withAssetVersion(`/avatars/${id}.webp`)
}

/** Full catalog — order is display order in AvatarPicker (stable wire indices). */
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
  // Wave 2 — trash-talk / 煽り energy portraits
  { id: 'koi', name: 'コイ', emoji: '🐟', note: 'Smug golden carp; ascending-dragon swagger' },
  { id: 'crow', name: 'カラス', emoji: '🐦‍⬛', note: 'Mocking trash-talker' },
  { id: 'peacock', name: 'クジャク', emoji: '🦚', note: 'Peak vanity / look-at-me' },
  { id: 'hyena', name: 'ハイエナ', emoji: '😆', note: 'Laughing taunt energy' },
  { id: 'cat', name: 'ネコ', emoji: '🐱', note: 'Classic smug stare' },
] as const

/** Catalog length — wire `avatarIndex` is 0 .. AVATAR_COUNT-1. */
export const AVATAR_COUNT = AVATAR_ASSETS.length

const byId = new Map(AVATAR_ASSETS.map((a) => [a.id, a]))

export function getAvatarAsset(id: AvatarAssetId): AvatarAssetMeta {
  const found = byId.get(id)
  if (!found) {
    throw new Error(`Unknown avatar asset id: ${id}`)
  }
  return found
}

/**
 * True when value is an integer in [0, AVATAR_COUNT).
 * Rejects floats, NaN, out-of-range, and non-numbers.
 */
export function isValidAvatarIndex(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < AVATAR_COUNT
  )
}

function clampAvatarIndex(n: number): number {
  if (!Number.isFinite(n) || !Number.isInteger(n)) return 0
  if (n < 0) return 0
  if (n >= AVATAR_COUNT) return AVATAR_COUNT - 1
  return n
}

/**
 * Normalize UI / localStorage avatar index (lenient).
 * - Integer (or short digit string) → clamped into [0, AVATAR_COUNT)
 * - Otherwise → `fallback` clamped into range
 *
 * Wire ingest uses worker `parseOptionalAvatarIndex` (strict reject, no clamp).
 */
export function sanitizeAvatarIndex(
  raw: unknown,
  fallback: number = 0,
): number {
  if (typeof raw === 'number' && Number.isInteger(raw) && Number.isFinite(raw)) {
    return clampAvatarIndex(raw)
  }
  if (typeof raw === 'string' && /^-?\d{1,3}$/.test(raw.trim())) {
    return clampAvatarIndex(Number(raw.trim()))
  }
  return clampAvatarIndex(
    typeof fallback === 'number' && Number.isInteger(fallback) ? fallback : 0,
  )
}

/** Resolve catalog entry by wire index (wraps out-of-range for display safety). */
export function avatarByIndex(index: number | undefined | null): AvatarAssetMeta {
  const i = sanitizeAvatarIndex(index, 0)
  return AVATAR_ASSETS[i]!
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
