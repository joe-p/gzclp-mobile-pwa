import { incrementFor, schemeLabel, stageSpec, stagesForTier } from './program'
import type { ExerciseRecord, LiftId, ProgressionOutcome, Tier, TrackState } from './types'
import { formatWeight, roundToIncrement } from './units'

const RESET_FACTOR = 0.9
const MIN_RESET_WEIGHT = 45

export function exerciseSucceeded(record: ExerciseRecord): boolean {
  return record.sets.length > 0 && record.sets.every((set) => set.success === true)
}

/**
 * GZCLP progression.
 *
 * Success: add the lift increment and stay in the current rep scheme.
 * Failure: move to the next rep scheme at the same weight. Failing the final
 * stage resets to the first scheme at ~90% of the working weight.
 * T3 accessories never change automatically.
 */
export function applyProgression(
  liftId: LiftId,
  tier: Tier,
  track: TrackState,
  success: boolean,
): ProgressionOutcome {
  const stages = stagesForTier(tier)
  const before = stageSpec(tier, track.stage)
  const weightBefore = track.weight

  const unchanged = (action: ProgressionOutcome['action']): ProgressionOutcome => ({
    success,
    action,
    weightBefore,
    weightAfter: weightBefore,
    stageBefore: track.stage,
    stageAfter: track.stage,
    setsBefore: before.sets,
    repsBefore: before.reps,
    setsAfter: before.sets,
    repsAfter: before.reps,
  })

  if (tier === 'T3') return unchanged('none')

  if (success) {
    const increment = incrementFor(liftId, tier)
    if (increment <= 0) return unchanged('none')
    return {
      success,
      action: 'increase',
      weightBefore,
      weightAfter: weightBefore + increment,
      stageBefore: track.stage,
      stageAfter: track.stage,
      setsBefore: before.sets,
      repsBefore: before.reps,
      setsAfter: before.sets,
      repsAfter: before.reps,
    }
  }

  if (track.stage + 1 < stages.length) {
    const nextStage = track.stage + 1
    const after = stageSpec(tier, nextStage)
    return {
      success,
      action: 'demote',
      weightBefore,
      weightAfter: weightBefore,
      stageBefore: track.stage,
      stageAfter: nextStage,
      setsBefore: before.sets,
      repsBefore: before.reps,
      setsAfter: after.sets,
      repsAfter: after.reps,
    }
  }

  const after = stageSpec(tier, 0)
  return {
    success,
    action: 'reset',
    weightBefore,
    weightAfter: Math.max(roundToIncrement(weightBefore * RESET_FACTOR), MIN_RESET_WEIGHT),
    stageBefore: track.stage,
    stageAfter: 0,
    setsBefore: before.sets,
    repsBefore: before.reps,
    setsAfter: after.sets,
    repsAfter: after.reps,
  }
}

export interface OutcomeDescription {
  tone: 'ok' | 'miss' | 'muted'
  title: string
  detail: string
}

export function describeOutcome(outcome: ProgressionOutcome): OutcomeDescription {
  const scheme = schemeLabel(outcome.setsAfter, outcome.repsAfter)
  switch (outcome.action) {
    case 'increase':
      return {
        tone: 'ok',
        title: `${formatWeight(outcome.weightBefore)} → ${formatWeight(outcome.weightAfter)} lb`,
        detail: `keep ${scheme}`,
      }
    case 'demote':
      return {
        tone: 'miss',
        title: `hold ${formatWeight(outcome.weightAfter)} lb`,
        detail: `next ${scheme}`,
      }
    case 'reset':
      return {
        tone: 'miss',
        title: `reset to ${formatWeight(outcome.weightAfter)} lb`,
        detail: `back to ${scheme}`,
      }
    default:
      return {
        tone: 'muted',
        title: `${formatWeight(outcome.weightAfter)} lb`,
        detail: 'accessory',
      }
  }
}
