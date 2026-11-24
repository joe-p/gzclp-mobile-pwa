import type { LiftId, Tier, WarmupRecord } from './types'
import { MIN_WEIGHT, roundToIncrement } from './units'

/** One line of the warmup ramp: a weight, how many sets, and reps per set. */
export interface WarmupSet {
  weight: number
  sets: number
  reps: number
}

/**
 * Warmup rep scheme from Bay Strength's guide: 5, then 3, then 2 reps. The
 * empty-bar work is a single set of 5; every warmup weight appears once.
 */
const WARMUP_REPS = [5, 3, 2] as const
const EMPTY_BAR_REPS = 5
const JUMP_COUNT = 4
const PERCENTAGES = [0.45, 0.65, 0.85] as const

type RampStyle = 'even' | 'percent'

/**
 * Lightest weight worth putting on the bar for a lift. A squat starts at the
 * empty bar and a deadlift starts with a 45 on each side; lighter than that the
 * bar sits too low to pull from the floor. Bench and OHP are handled separately
 * because they can be warmed up with dumbbells lighter than the bar.
 */
const WARMUP_FLOORS: Partial<Record<LiftId, number>> = {
  squat: 45,
  deadlift: 135,
}

/** Lifts that can be done with dumbbells when the working weight is below a bar. */
const DUMBBELL_LIFTS: readonly LiftId[] = ['bench', 'ohp']
const DUMBBELL_THRESHOLD = 45

/**
 * One candidate ramp, rounded to 5 lb. Weights at or below the floor are left
 * to the base set, weights at or above the work weight are dropped, and
 * duplicates from rounding collapse to one set.
 */
function rampWeights(
  workWeight: number,
  floor: number,
  dumbbells: boolean,
  style: RampStyle,
): number[] {
  const targets =
    style === 'percent'
      ? PERCENTAGES.map((percent) => roundToIncrement(workWeight * percent))
      : Array.from({ length: 3 }, (_, index) =>
          roundToIncrement(floor + ((workWeight - floor) / JUMP_COUNT) * (index + 1)),
        )

  const ramp: number[] = []
  for (const target of targets) {
    if (dumbbells ? target < floor : target <= floor) continue
    if (target >= workWeight) continue
    if (ramp.includes(target)) continue
    ramp.push(target)
  }
  return ramp
}

/**
 * Auto-picks the ramp that fits the lift best. Percentages are the default
 * because they scale with the work weight; even jumps take over only when they
 * produce more distinct sets, which happens when the floor (the empty bar, the
 * deadlift's 135 lb start, or a low dumbbell weight) swallows percentage steps.
 */
function chooseRamp(workWeight: number, floor: number, dumbbells: boolean): number[] {
  const percent = rampWeights(workWeight, floor, dumbbells, 'percent')
  const even = rampWeights(workWeight, floor, dumbbells, 'even')
  return even.length > percent.length ? even : percent
}

/**
 * Builds the warmup ramp for a T1/T2 lift. Weights are rounded to 5 lb, ramp
 * weights at or below the lift's floor are covered by its base set, and ramp
 * weights at or above the work weight are dropped so the last warmup is always
 * lighter than the work sets. T3 accessories have no warmup.
 *
 * Bench and OHP can be done with dumbbells, so a working weight at or below the
 * bar still gets a ramp with no empty-bar set. Everything else starts at its
 * floor (the empty bar for a squat, 135 lb for a deadlift) so the first warmup
 * is never lighter than the setup allows.
 */
export function warmupSets(
  liftId: LiftId,
  tier: Tier,
  workWeight: number,
  bar: number,
): WarmupSet[] {
  if (tier === 'T3') return []
  if (!Number.isFinite(workWeight) || !Number.isFinite(bar)) return []

  const dumbbells =
    DUMBBELL_LIFTS.includes(liftId) &&
    (workWeight <= bar || workWeight < DUMBBELL_THRESHOLD)
  const floor = dumbbells ? MIN_WEIGHT : Math.max(bar, WARMUP_FLOORS[liftId] ?? 0)
  if (workWeight <= floor) return []

  const sets: WarmupSet[] = []
  if (!dumbbells) {
    // The floor is the first warmup: the empty bar for a squat, or a loaded
    // bar for a deadlift. Each weight is done once, so it never repeats.
    sets.push({ weight: floor, sets: 1, reps: EMPTY_BAR_REPS })
  }

  // Compact the rep scheme when a warmup is dropped, so the first ramp set is
  // always 5 reps rather than starting mid-scheme at 3 or 2.
  chooseRamp(workWeight, floor, dumbbells).forEach((weight, index) => {
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
): WarmupRecord[] {
  return warmupSets(liftId, tier, workWeight, bar).flatMap((set) =>
    Array.from({ length: set.sets }, () => ({
      weight: set.weight,
      reps: set.reps,
      completed: false,
    })),
  )
}
