import { describe, expect, it } from 'vitest'
import {
  countCards,
  createDeck,
  defineDeckComposition,
  DECK_PRESETS,
  DECK_SIZE,
  resolveDeckComposition,
  STANDARD_DECK,
  validateDeckComposition,
  GameError,
  startGame,
  seedRandom,
} from '../../../src/domain/game'

describe('DeckComposition', () => {
  it('STANDARD_DECK matches DECK_SIZE and preset', () => {
    expect(countCards(STANDARD_DECK)).toBe(DECK_SIZE)
    expect(countCards(DECK_PRESETS.standard)).toBe(36)
    expect(createDeck()).toHaveLength(36)
    expect(createDeck(STANDARD_DECK)).toHaveLength(36)
  })

  it('createDeck respects custom composition counts', () => {
    const tiny = defineDeckComposition({
      id: 'tiny',
      numbers: [
        { value: 1, count: 2 },
        { value: 5, count: 1 },
      ],
      specials: { double: 1, max_to_zero: 0, redraw: 0, zero_mix: 0 },
    })
    expect(countCards(tiny)).toBe(4)
    const deck = createDeck(tiny)
    expect(deck).toHaveLength(4)
    expect(deck.filter((c) => c.kind === 'number')).toHaveLength(3)
    expect(deck.filter((c) => c.kind === 'double')).toHaveLength(1)
  })

  it('resolveDeckComposition accepts preset id or object', () => {
    expect(resolveDeckComposition('standard')).toBe(DECK_PRESETS.standard)
    expect(resolveDeckComposition(undefined)).toBe(STANDARD_DECK)
    const custom = defineDeckComposition({
      numbers: [{ value: 0, count: 1 }],
    })
    expect(resolveDeckComposition(custom)).toBe(custom)
  })

  it('rejects unknown preset id', () => {
    expect(() => resolveDeckComposition('nope' as 'standard')).toThrow(GameError)
  })

  it('validateDeckComposition rejects empty / negative counts', () => {
    expect(() =>
      validateDeckComposition(
        defineDeckComposition({ numbers: [], specials: {} }),
      ),
    ).toThrow(GameError)

    expect(() =>
      validateDeckComposition(
        defineDeckComposition({
          numbers: [{ value: 1, count: -1 }],
        }),
      ),
    ).toThrow(GameError)
  })

  it('startGame uses config.deck (preset id string)', () => {
    const state = startGame(
      {
        playerIds: ['a', 'b'],
        config: { deck: 'standard' },
      },
      seedRandom(1),
    )
    expect(state.config.deck.id).toBe('standard')
    // 2 dealt + remaining
    expect(state.deck.length + Object.keys(state.hands).length).toBe(36)
  })

  it('startGame uses custom composition for room-style config', () => {
    const roomDeck = defineDeckComposition({
      id: 'room-custom',
      label: '少人数テスト',
      numbers: [
        { value: 10, count: 4 },
        { value: 5, count: 4 },
        { value: 0, count: 2 },
        { value: -5, count: 2 },
      ],
      specials: { double: 1, max_to_zero: 1, redraw: 0, zero_mix: 0 },
    })
    const total = countCards(roomDeck)
    const state = startGame(
      {
        playerIds: ['a', 'b', 'c'],
        config: { deck: roomDeck, initialLives: 2 },
      },
      seedRandom(9),
    )
    expect(state.config.deck.id).toBe('room-custom')
    expect(state.config.initialLives).toBe(2)
    expect(
      state.deck.length +
        state.discard.length +
        Object.keys(state.hands).length,
    ).toBe(total)
  })
})
