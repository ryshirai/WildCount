import type { PlayerId } from '@/types/game'

/** Fixed local demo identities (self + bots). */
export const SELF_ID: PlayerId = 'self'

export interface PlayerProfile {
  id: PlayerId
  name: string
  avatar: string
}

/** Default 4-player local lineup: self + 3 bots. */
export const DEFAULT_PROFILES: readonly PlayerProfile[] = [
  { id: SELF_ID, name: 'あなた', avatar: '🐻' },
  { id: 'bot1', name: 'フクロウ', avatar: '🦉' },
  { id: 'bot2', name: 'キタロー', avatar: '🦊' },
  { id: 'bot3', name: 'オオカミ', avatar: '🐺' },
] as const

export function profileMap(
  profiles: readonly PlayerProfile[] = DEFAULT_PROFILES,
): Map<PlayerId, PlayerProfile> {
  return new Map(profiles.map((p) => [p.id, p]))
}

export function getProfile(
  id: PlayerId,
  profiles: readonly PlayerProfile[] = DEFAULT_PROFILES,
): PlayerProfile {
  const found = profiles.find((p) => p.id === id)
  if (found) return found
  return { id, name: id, avatar: '🐾' }
}
