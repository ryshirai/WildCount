import type { PlayerId } from '@/types/game'
import {
  avatarSrc,
  DEMO_PLAYER_ASSET_IDS,
  getAvatarAsset,
  type AvatarAssetId,
} from '@/localGame/avatarCatalog'

/** Fixed local demo identities (self + bots). */
export const SELF_ID: PlayerId = 'self'

/** Local demo supports 3–4 seats (self + 2–3 bots). */
export type DemoPlayerCount = 3 | 4

export const DEMO_PLAYER_COUNTS = [3, 4] as const

export interface PlayerProfile {
  id: PlayerId
  name: string
  /** Emoji fallback when image is missing or fails to load */
  avatar: string
  /** Public URL to portrait WebP, if available */
  avatarSrc?: string
  /** Catalog asset id (character stamps / seat art) */
  avatarId?: AvatarAssetId
}

export interface BuildDemoLineupOptions {
  /** Total seats including self (default 4). */
  playerCount?: DemoPlayerCount
  /** Display name for the local player (default「あなた」). */
  selfName?: string
  /** Catalog id for local player portrait (default `self` bear). */
  selfAvatarId?: AvatarAssetId
}

/** Bot seats for the local demo (order is fixed). */
const DEMO_BOT_SPECS: readonly {
  id: PlayerId
  name: string
  assetId: AvatarAssetId
}[] = [
  { id: 'bot1', name: 'フクロウ', assetId: 'owl' },
  { id: 'bot2', name: 'キタロー', assetId: 'kit' },
  { id: 'bot3', name: 'オオカミ', assetId: 'wolf' },
] as const

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
    avatarId: assetId,
  }
}

/**
 * Build a local demo lineup: self + bots.
 * playerCount 3 → self + 2 bots; 4 → self + 3 bots.
 */
export function buildDemoLineup(
  options: BuildDemoLineupOptions = {},
): PlayerProfile[] {
  const playerCount: DemoPlayerCount = options.playerCount ?? 4
  const rawName = options.selfName?.trim()
  const selfName =
    rawName && rawName.length > 0 ? rawName.slice(0, 12) : 'あなた'
  const botCount = playerCount - 1
  const selfAssetId =
    options.selfAvatarId ?? DEMO_PLAYER_ASSET_IDS.self ?? 'self'

  const self = profileFromAsset(SELF_ID, selfName, selfAssetId)
  const bots = DEMO_BOT_SPECS.slice(0, botCount).map((b) =>
    profileFromAsset(b.id, b.name, b.assetId),
  )
  return [self, ...bots]
}

/** Default 4-player local lineup: self + 3 bots (B1 demo assets). */
export const DEFAULT_PROFILES: readonly PlayerProfile[] = buildDemoLineup({
  playerCount: 4,
})

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
      avatarId: assetId,
    }
  }

  return { id, name: id, avatar: '🐾' }
}
