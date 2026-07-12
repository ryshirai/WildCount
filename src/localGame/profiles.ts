import type { PlayerId } from '@/types/game'
import {
  avatarSrc,
  DEMO_PLAYER_ASSET_IDS,
  getAvatarAsset,
  type AvatarAssetId,
} from '@/localGame/avatarCatalog'

/** Fixed local demo identities (self + bots). */
export const SELF_ID: PlayerId = 'self'

export interface PlayerProfile {
  id: PlayerId
  name: string
  /** Emoji fallback when image is missing or fails to load */
  avatar: string
  /** Public URL to portrait WebP, if available */
  avatarSrc?: string
}

function profileFromAsset(
  id: PlayerId,
  name: string,
  assetId: AvatarAssetId,
): PlayerProfile {
  const meta = getAvatarAsset(assetId)
  return {
    id,
    name,
    avatar: meta.emoji,
    avatarSrc: avatarSrc(assetId),
  }
}

/** Default 4-player local lineup: self + 3 bots (B1 demo assets). */
export const DEFAULT_PROFILES: readonly PlayerProfile[] = [
  profileFromAsset(SELF_ID, 'あなた', DEMO_PLAYER_ASSET_IDS.self!),
  profileFromAsset('bot1', 'フクロウ', DEMO_PLAYER_ASSET_IDS.bot1!),
  profileFromAsset('bot2', 'キタロー', DEMO_PLAYER_ASSET_IDS.bot2!),
  profileFromAsset('bot3', 'オオカミ', DEMO_PLAYER_ASSET_IDS.bot3!),
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

  const assetId = DEMO_PLAYER_ASSET_IDS[id]
  if (assetId) {
    const meta = getAvatarAsset(assetId)
    return {
      id,
      name: id,
      avatar: meta.emoji,
      avatarSrc: avatarSrc(assetId),
    }
  }

  return { id, name: id, avatar: '🐾' }
}
