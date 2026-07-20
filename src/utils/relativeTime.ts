/**
 * Japanese relative time labels for event log / chat-adjacent UI.
 * Buckets: たった今 → N分前 → N時間前 → 日付 or 時刻.
 */

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * @param ts Epoch milliseconds of the event
 * @param now Epoch milliseconds of "now" (injectable for tests / ticking UI)
 */
export function formatRelativeTimeJa(ts: number, now: number = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const delta = Math.max(0, now - ts)

  if (delta < MINUTE_MS) return 'たった今'
  if (delta < HOUR_MS) {
    const mins = Math.floor(delta / MINUTE_MS)
    return `${mins}分前`
  }
  if (delta < DAY_MS) {
    const hours = Math.floor(delta / HOUR_MS)
    return `${hours}時間前`
  }

  try {
    const d = new Date(ts)
    const sameYear = d.getFullYear() === new Date(now).getFullYear()
    return d.toLocaleDateString(
      'ja-JP',
      sameYear
        ? { month: 'numeric', day: 'numeric' }
        : { year: 'numeric', month: 'numeric', day: 'numeric' },
    )
  } catch {
    return ''
  }
}
