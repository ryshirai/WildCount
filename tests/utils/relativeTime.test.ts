import { describe, expect, it } from 'vitest'
import { formatRelativeTimeJa } from '@/utils/relativeTime'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatRelativeTimeJa', () => {
  const now = Date.UTC(2026, 6, 20, 12, 0, 0)

  it('returns empty for invalid ts', () => {
    expect(formatRelativeTimeJa(0, now)).toBe('')
    expect(formatRelativeTimeJa(Number.NaN, now)).toBe('')
  })

  it('shows たった今 under 1 minute', () => {
    expect(formatRelativeTimeJa(now, now)).toBe('たった今')
    expect(formatRelativeTimeJa(now - 59_000, now)).toBe('たった今')
  })

  it('shows N分前 under 1 hour', () => {
    expect(formatRelativeTimeJa(now - MIN, now)).toBe('1分前')
    expect(formatRelativeTimeJa(now - 12 * MIN, now)).toBe('12分前')
    expect(formatRelativeTimeJa(now - (HOUR - 1), now)).toBe('59分前')
  })

  it('shows N時間前 under 1 day', () => {
    expect(formatRelativeTimeJa(now - HOUR, now)).toBe('1時間前')
    expect(formatRelativeTimeJa(now - 5 * HOUR, now)).toBe('5時間前')
  })

  it('shows date for older events', () => {
    const label = formatRelativeTimeJa(now - 2 * DAY, now)
    expect(label.length).toBeGreaterThan(0)
    expect(label).not.toMatch(/前$/)
  })
})
