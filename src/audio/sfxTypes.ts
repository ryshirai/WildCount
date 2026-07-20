/**
 * Gameplay dopamine D2 — SFX types & catalog metadata.
 * Spec: `docs/gameplay-dopamine-plan.md` §5, §7 D2.
 */

/** Lower number = higher priority (plan §5.2). */
export type SfxPriority = 1 | 2 | 3 | 4

export type SfxCategory =
  | 'coyote'
  | 'result'
  | 'extra'
  | 'declare'
  | 'turn'
  | 'input'
  | 'ambient'

export type SfxId =
  | 'ui_tick'
  | 'ui_boundary'
  | 'bid_land'
  | 'turn_self'
  | 'extra'
  | 'coyote'
  | 'card_flip'
  | 'result_slam'
  | 'result_win'
  | 'result_lose'
  | 'timer_pulse'

export type SfxCatalogEntry = {
  id: SfxId
  category: SfxCategory
  priority: SfxPriority
  /** Min ms between plays of the same id (anti-stack). */
  cooldownMs: number
  /** Optional soft duck of lower-priority voices while this plays. */
  duckMs: number
}

/**
 * Priority map (plan §5.2):
 * 1 COYOTE / 勝敗 → 2 特殊能力 → 3 宣言着弾 / 手番 → 4 入力 / 心音
 */
export const SFX_CATALOG: Record<SfxId, SfxCatalogEntry> = {
  coyote: {
    id: 'coyote',
    category: 'coyote',
    priority: 1,
    cooldownMs: 400,
    duckMs: 280,
  },
  result_slam: {
    id: 'result_slam',
    category: 'result',
    priority: 1,
    cooldownMs: 300,
    duckMs: 220,
  },
  result_win: {
    id: 'result_win',
    category: 'result',
    priority: 1,
    cooldownMs: 500,
    duckMs: 200,
  },
  result_lose: {
    id: 'result_lose',
    category: 'result',
    priority: 1,
    cooldownMs: 500,
    duckMs: 200,
  },
  card_flip: {
    id: 'card_flip',
    category: 'coyote',
    priority: 1,
    cooldownMs: 45,
    duckMs: 0,
  },
  extra: {
    id: 'extra',
    category: 'extra',
    priority: 2,
    cooldownMs: 180,
    duckMs: 120,
  },
  bid_land: {
    id: 'bid_land',
    category: 'declare',
    priority: 3,
    cooldownMs: 70,
    duckMs: 60,
  },
  turn_self: {
    id: 'turn_self',
    category: 'turn',
    priority: 3,
    cooldownMs: 400,
    duckMs: 80,
  },
  ui_tick: {
    id: 'ui_tick',
    category: 'input',
    priority: 4,
    cooldownMs: 28,
    duckMs: 0,
  },
  ui_boundary: {
    id: 'ui_boundary',
    category: 'input',
    priority: 4,
    cooldownMs: 80,
    duckMs: 0,
  },
  timer_pulse: {
    id: 'timer_pulse',
    category: 'ambient',
    priority: 4,
    cooldownMs: 900,
    duckMs: 0,
  },
}

export type PlaySfxOptions = {
  /** Pitch multiplier (1 = base). HEAT / RAISE can raise this. */
  pitch?: number
  /** Local gain 0..1, multiplied by master volume. */
  gain?: number
  /** Skip per-id cooldown (rare; prefer not). */
  force?: boolean
}
