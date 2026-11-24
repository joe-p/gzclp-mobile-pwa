import { MAX_REST_SECONDS, normalizeRestRange } from '../domain/rest'

export const REST_TIMER_KEY = 'gzclp.rest.v1'

/**
 * A timer lingering this long past its start is dropped rather than resumed.
 * Rest runs at most MAX_REST_SECONDS, so half an hour later the bar is only
 * noise and the next set should be free to log.
 */
export const REST_TIMER_TTL_SECONDS = MAX_REST_SECONDS + 15 * 60

/**
 * The running rest timer. Kept in its own storage key rather than in `AppData`:
 * it is throwaway UI state that should survive a reload or the OS reclaiming
 * the PWA, but never belong in a backup or an import.
 */
export interface RestTimerState {
  /** Epoch milliseconds the rest began. The countdown is always derived from this. */
  startedAt: number
  min: number
  max: number
  sessionId: string
  /** True while the minimum rest time is still running, holding back the next set. */
  blocked: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : NaN
}

/**
 * Normalizes a stored timer against the current clock. Returns null when the
 * payload is unusable or too old to be worth resuming; otherwise `blocked` is
 * recomputed from the elapsed time so time spent with the app closed still counts.
 */
export function parseRestTimer(raw: unknown, now: number): RestTimerState | null {
  if (!isObject(raw)) return null

  const startedAt = readNumber(raw.startedAt)
  const min = readNumber(raw.min)
  const max = readNumber(raw.max)
  const sessionId = raw.sessionId
  if (!Number.isFinite(startedAt) || !Number.isFinite(min) || !Number.isFinite(max)) return null
  if (typeof sessionId !== 'string' || sessionId.length === 0) return null

  const range = normalizeRestRange({ min, max })
  if (range.max <= 0) return null

  // A started-at in the future means the clock moved; restart rather than show
  // a negative countdown.
  const elapsed = (now - startedAt) / 1000
  if (elapsed < 0 || elapsed > REST_TIMER_TTL_SECONDS) return null

  return { startedAt, sessionId, min: range.min, max: range.max, blocked: elapsed < range.min }
}

export function loadRestTimer(now = Date.now()): RestTimerState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const stored = localStorage.getItem(REST_TIMER_KEY)
    if (!stored) return null
    return parseRestTimer(JSON.parse(stored), now)
  } catch {
    return null
  }
}

export function saveRestTimer(timer: RestTimerState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(REST_TIMER_KEY, JSON.stringify(timer))
  } catch {
    // Storage can be full or blocked (private mode); the timer still runs in memory.
  }
}

export function clearRestTimer(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(REST_TIMER_KEY)
  } catch {
    // ignore
  }
}
