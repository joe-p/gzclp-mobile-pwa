import type { RestRange } from './types'

/** Rest timers are capped at 15 minutes. */
export const MAX_REST_SECONDS = 900

/** Min/max rest times are adjusted in 30-second steps. */
export const REST_STEP_SECONDS = 30

export function clampRestSeconds(seconds: number): number {
  return Math.min(MAX_REST_SECONDS, Math.max(0, Math.trunc(seconds)))
}

/** Clamps both ends and keeps `max` at or above `min`. */
export function normalizeRestRange(range: RestRange): RestRange {
  const min = clampRestSeconds(range.min)
  return { min, max: Math.max(min, clampRestSeconds(range.max)) }
}

export type RestPhase = 'blocked' | 'ready' | 'max'

export interface RestStatus {
  phase: RestPhase
  /** Seconds left until rest is long enough; 0 once ready. */
  toMin: number
  /** Seconds left until the max-rest warning; 0 once maxed. */
  toMax: number
  /** Seconds rested past the minimum. */
  overtime: number
  /** Position through the full range, 0 at start and 1 at max. */
  progress: number
}

export function restStatus(min: number, max: number, elapsed: number): RestStatus {
  const span = Math.max(0, max)
  const progress = span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : 1
  const toMin = Math.max(0, min - elapsed)
  const toMax = Math.max(0, max - elapsed)
  const overtime = Math.max(0, elapsed - min)

  if (elapsed < min) return { phase: 'blocked', toMin, toMax, overtime: 0, progress }
  if (elapsed < max) return { phase: 'ready', toMin: 0, toMax, overtime, progress }
  return { phase: 'max', toMin: 0, toMax: 0, overtime, progress: 1 }
}
