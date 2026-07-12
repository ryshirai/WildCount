import type { Card, DeckComposition, SpecialCounts } from './types'
import type { RandomSource } from './random'
import { GameError } from './types'

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/**
 * Default composition from docs/card-design.md table.
 * Header text says 54, but explicit counts sum to 36 — table wins.
 */
export const STANDARD_DECK: DeckComposition = Object.freeze({
  id: 'standard',
  label: 'スタンダード',
  numbers: Object.freeze([
    { value: 20, count: 1 },
    { value: 15, count: 2 },
    { value: 10, count: 3 },
    { value: 5, count: 4 },
    { value: 4, count: 4 },
    { value: 3, count: 4 },
    { value: 2, count: 4 },
    { value: 1, count: 4 },
    { value: 0, count: 3 },
    { value: -5, count: 2 },
    { value: -10, count: 1 },
  ]),
  specials: Object.freeze({
    double: 1,
    max_to_zero: 1,
    redraw: 1,
    zero_mix: 1,
  } satisfies SpecialCounts),
})

/**
 * Named presets for room creation UI.
 * Add new presets here (e.g. large / casual) without changing engine logic.
 */
export const DECK_PRESETS = {
  standard: STANDARD_DECK,
} as const satisfies Record<string, DeckComposition>

export type DeckPresetId = keyof typeof DECK_PRESETS

/** Card count of the default preset (backward-compatible alias). */
export const DECK_SIZE = countCards(STANDARD_DECK)

/**
 * Soft upper bound for room-custom decks (abuse / DO payload).
 * Engine itself only requires total ≥ 1.
 */
export const MAX_CUSTOM_DECK_CARDS = 120

/**
 * Minimum cards so a full lobby (10) can be dealt one each.
 * Host UI and set_deck enforce this.
 */
export const MIN_CUSTOM_DECK_CARDS = 10

/**
 * Number values shown in the lobby deck editor (standard set).
 * Counts may be zero to omit a value.
 */
export const DECK_EDITOR_NUMBER_VALUES: readonly number[] = Object.freeze([
  20, 15, 10, 5, 4, 3, 2, 1, 0, -5, -10,
])

// ---------------------------------------------------------------------------
// Composition helpers
// ---------------------------------------------------------------------------

/** Total cards implied by a composition. */
export function countCards(composition: DeckComposition): number {
  const numbers = composition.numbers.reduce((sum, n) => sum + n.count, 0)
  const s = composition.specials
  return (
    numbers + s.double + s.max_to_zero + s.redraw + s.zero_mix
  )
}

/** Deep-clone a composition into a mutable plain object (for UI / room storage). */
export function cloneDeckComposition(source: DeckComposition): DeckComposition {
  return {
    id: source.id,
    label: source.label,
    numbers: source.numbers.map((n) => ({ value: n.value, count: n.count })),
    specials: { ...source.specials },
  }
}

/**
 * Build an editor-friendly composition: fixed number rows + specials.
 * Missing values from DECK_EDITOR_NUMBER_VALUES get count 0.
 */
export function toEditorDeckComposition(
  source: DeckComposition = STANDARD_DECK,
): DeckComposition {
  const byValue = new Map(source.numbers.map((n) => [n.value, n.count]))
  return {
    id: source.id,
    label: source.label,
    numbers: DECK_EDITOR_NUMBER_VALUES.map((value) => ({
      value,
      count: byValue.get(value) ?? 0,
    })),
    specials: { ...source.specials },
  }
}

/** True when composition matches the standard preset counts (ignores id/label). */
export function isStandardDeckComposition(composition: DeckComposition): boolean {
  if (countCards(composition) !== countCards(STANDARD_DECK)) return false
  const stdBy = new Map(STANDARD_DECK.numbers.map((n) => [n.value, n.count]))
  for (const n of composition.numbers) {
    if (n.count === 0) continue
    if ((stdBy.get(n.value) ?? 0) !== n.count) return false
  }
  for (const [value, count] of stdBy) {
    const found = composition.numbers.find((n) => n.value === value)
    if ((found?.count ?? 0) !== count) return false
  }
  const s = composition.specials
  const ss = STANDARD_DECK.specials
  return (
    s.double === ss.double &&
    s.max_to_zero === ss.max_to_zero &&
    s.redraw === ss.redraw &&
    s.zero_mix === ss.zero_mix
  )
}

/**
 * Human-readable short label for lobby chips.
 */
export function deckSummaryLabel(composition: DeckComposition): string {
  const total = countCards(composition)
  if (composition.label?.trim()) {
    return `${composition.label.trim()}（${total}枚）`
  }
  if (isStandardDeckComposition(composition)) {
    return `スタンダード（${total}枚）`
  }
  return `カスタム（${total}枚）`
}

/**
 * Validate a composition before use (room create / startGame).
 * Throws GameError with code INVALID_DECK when invalid.
 */
export function validateDeckComposition(composition: DeckComposition): void {
  if (!composition.numbers || !composition.specials) {
    throw new GameError('Deck composition is incomplete', 'INVALID_DECK')
  }

  for (const entry of composition.numbers) {
    if (!Number.isInteger(entry.value)) {
      throw new GameError(
        `Number card value must be an integer, got ${entry.value}`,
        'INVALID_DECK',
      )
    }
    if (!Number.isInteger(entry.count) || entry.count < 0) {
      throw new GameError(
        `Number card count must be a non-negative integer, got ${entry.count} for value ${entry.value}`,
        'INVALID_DECK',
      )
    }
  }

  const s = composition.specials
  for (const [key, count] of Object.entries(s) as [keyof SpecialCounts, number][]) {
    if (!Number.isInteger(count) || count < 0) {
      throw new GameError(
        `Special "${key}" count must be a non-negative integer, got ${count}`,
        'INVALID_DECK',
      )
    }
  }

  const total = countCards(composition)
  if (total < 1) {
    throw new GameError('Deck must contain at least 1 card', 'INVALID_DECK')
  }
}

/**
 * Stricter validation for room lobby customization (host set_deck).
 * Ensures enough cards for a full lobby and caps size.
 */
export function validateRoomDeckComposition(composition: DeckComposition): void {
  validateDeckComposition(composition)
  const total = countCards(composition)
  if (total < MIN_CUSTOM_DECK_CARDS) {
    throw new GameError(
      `Deck must have at least ${MIN_CUSTOM_DECK_CARDS} cards (got ${total})`,
      'INVALID_DECK',
    )
  }
  if (total > MAX_CUSTOM_DECK_CARDS) {
    throw new GameError(
      `Deck must have at most ${MAX_CUSTOM_DECK_CARDS} cards (got ${total})`,
      'INVALID_DECK',
    )
  }
}

/**
 * Resolve a preset id or pass-through a custom composition.
 * Useful for room settings: `{ deck: 'standard' }` or full object.
 */
export function resolveDeckComposition(
  source: string | DeckComposition | undefined,
): DeckComposition {
  if (source == null) return STANDARD_DECK
  if (typeof source === 'string') {
    if (Object.prototype.hasOwnProperty.call(DECK_PRESETS, source)) {
      return DECK_PRESETS[source as DeckPresetId]
    }
    throw new GameError(`Unknown deck preset: ${source}`, 'INVALID_DECK')
  }
  return source
}

/**
 * Build a helper composition (e.g. tests / future room editor).
 * Does not freeze; call validateDeckComposition before createDeck if needed.
 */
export function defineDeckComposition(
  partial: Omit<DeckComposition, 'specials'> & {
    specials?: Partial<SpecialCounts>
  },
): DeckComposition {
  return {
    id: partial.id,
    label: partial.label,
    numbers: partial.numbers.map((n) => ({ ...n })),
    specials: {
      double: partial.specials?.double ?? 0,
      max_to_zero: partial.specials?.max_to_zero ?? 0,
      redraw: partial.specials?.redraw ?? 0,
      zero_mix: partial.specials?.zero_mix ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Create / shuffle
// ---------------------------------------------------------------------------

/**
 * Build a deck from a composition (default: STANDARD_DECK).
 * Ids are deterministic per composition order so seeded shuffle is stable.
 */
export function createDeck(
  composition: DeckComposition = STANDARD_DECK,
): Card[] {
  validateDeckComposition(composition)

  const deck: Card[] = []
  let seq = 0
  const id = (prefix: string) => {
    seq += 1
    return `${prefix}-${seq}`
  }

  for (const { value, count } of composition.numbers) {
    for (let i = 0; i < count; i++) {
      deck.push({
        id: id(`n${value}`),
        kind: 'number',
        value,
      })
    }
  }

  const s = composition.specials
  for (let i = 0; i < s.zero_mix; i++) {
    deck.push({ id: id('zero_mix'), kind: 'zero_mix', value: 0 })
  }
  for (let i = 0; i < s.double; i++) {
    deck.push({ id: id('double'), kind: 'double' })
  }
  for (let i = 0; i < s.max_to_zero; i++) {
    deck.push({ id: id('max0'), kind: 'max_to_zero' })
  }
  for (let i = 0; i < s.redraw; i++) {
    deck.push({ id: id('redraw'), kind: 'redraw' })
  }

  const expected = countCards(composition)
  if (deck.length !== expected) {
    throw new Error(
      `createDeck: expected ${expected} cards, got ${deck.length}`,
    )
  }

  return deck
}

/**
 * Fisher–Yates shuffle using injected RNG.
 * Returns a new array; does not mutate input.
 */
export function shuffle<T>(items: readonly T[], rng: RandomSource): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

/** Human-readable label for logs / UI adapters. */
export function cardLabel(card: Card): string {
  switch (card.kind) {
    case 'number':
      return card.value! >= 0 ? `+${card.value}` : `${card.value}`
    case 'double':
      return '×2'
    case 'max_to_zero':
      // Compact: hand tiles are ~2.5rem wide; "MAX→0" overflowed / cramped.
      return 'M→0'
    case 'redraw':
      return '?'
    case 'zero_mix':
      // Compact: hand tiles are ~2.5rem wide; "0 (mix)" overflowed.
      return '0*'
  }
}
