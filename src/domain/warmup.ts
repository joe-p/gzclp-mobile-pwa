import type { LiftId, Tier, WarmupMethod, WarmupRecord } from './types'
import { roundToIncrement } from './units'

/** One line of the warmup ramp: a weight, how many sets, and reps per set. */
export interface WarmupSet {
  weight: number
  sets: number
  reps: number
}

/**
 * Warmup rep scheme from Bay Strength's guide: 5, then 3, then 2 reps. The
 * empty-bar work is done as two sets of 5.
 */
const WARMUP_REPS = [5, 3, 2] as const
const EMPTY_BAR_SETS = 2
const EMPTY_BAR_REPS = 5
const JUMP_COUNT = 4
const PERCENTAGES = [0.45, 0.65, 0.85] as const

export const WARMUP_METHODS: readonly WarmupMethod[] = ['even', 'percent']

export const WARMUP_METHOD_LABELS: Record<WarmupMethod, string> = {
  even: 'Even jumps',
  percent: '45 / 65 / 85%',
}

export const WARMUP_METHOD_HINTS: Record<WarmupMethod, string> = {
  even: 'Split the work weight minus the bar into four equal jumps.',
  percent: 'Three warmups at 45%, 65% and 85% of the work weight.',
}

/**
 * Builds the warmup ramp for a T1/T2 lift. Weights are rounded to 5 lb, any
 * ramp weight at or below the bar is covered by the empty-bar sets, and ramp
 * weights at or above the work weight are dropped so the last warmup is always
 * lighter than the work sets. T3 accessories have no warmup.
 */
export function warmupSets(
  liftId: LiftId,
  tier: Tier,
  workWeight: number,
  bar: number,
  method: WarmupMethod,
): WarmupSet[] {
  if (tier === 'T3') return []
  if (!Number.isFinite(workWeight) || !Number.isFinite(bar)) return []
  if (workWeight <= bar) return []

  const sets: WarmupSet[] = []
  // The article skips the empty bar on deadlift and starts with plates loaded.
  if (bar > 0 && liftId !== 'deadlift') {
    sets.push({ weight: bar, sets: EMPTY_BAR_SETS, reps: EMPTY_BAR_REPS })
  }

  const targets =
    method === 'percent'
      ? PERCENTAGES.map((percent) => roundToIncrement(workWeight * percent))
      : Array.from({ length: 3 }, (_, index) =>
          roundToIncrement(bar + ((workWeight - bar) / JUMP_COUNT) * (index + 1)),
        )

  const ramp: number[] = []
  for (const target of targets) {
    if (target <= bar || target >= workWeight) continue
    if (ramp.includes(target)) continue
    ramp.push(target)
  }

  // Compact the rep scheme when a warmup is dropped, so the first ramp set is
  // always 5 reps rather than starting mid-scheme at 3 or 2.
  ramp.forEach((weight, index) => {
    sets.push({ weight, sets: 1, reps: WARMUP_REPS[Math.min(index, WARMUP_REPS.length - 1)] })
  })

  return sets
}

/** Flattens the ramp into individual sets so each one can be checked off. */
export function warmupRecords(
  liftId: LiftId,
  tier: Tier,
  workWeight: number,
  bar: number,
  method: WarmupMethod,
): WarmupRecord[] {
  return warmupSets(liftId, tier, workWeight, bar, method).flatMap((set) =>
    Array.from({ length: set.sets }, () => ({
      weight: set.weight,
      reps: set.reps,
      completed: false,
    })),
  )
}
