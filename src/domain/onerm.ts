import { stageSpec } from './program'
import type { Tier } from './types'

/**
 * Epley estimate. AMRAP sets are the only place we apply this, and the
 * estimate is rounded to the nearest pound.
 */
export function epley1rm(weight: number, reps: number | null | undefined): number | null {
  if (reps == null || !Number.isFinite(reps) || reps <= 0) return null
  if (!Number.isFinite(weight) || weight <= 0) return null
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

/**
 * Current estimated 1RM for a programmed lift, based on its working weight and
 * the rep target of the stage it is currently in. T3 has no 1RM estimate.
 */
export function e1rmForStage(weight: number, tier: Tier, stage: number): number | null {
  if (tier === 'T3') return null
  return epley1rm(weight, stageSpec(tier, stage).reps)
}
