import { describeOutcome, applyProgression, exerciseSucceeded } from '../domain/progression'
import { resolveLift, schemeLabel, stageSpec } from '../domain/program'
import type { ExerciseRecord } from '../domain/types'
import { formatWeight } from '../domain/units'
import { useApp } from '../store/context'
import { ChevronIcon } from './icons'
import { PlateBreakdown } from './PlateBreakdown'
import { SetRow } from './SetRow'
import { WarmupList } from './WarmupList'

interface ExerciseCardProps {
  exercise: ExerciseRecord
  expanded: boolean
  onToggle: () => void
  onMarkSet: (setIndex: number, success: boolean | null) => void
  onLogAmrap: (reps: number) => void
  onToggleWarmup: (warmupIndex: number, completed: boolean) => void
}

export function ExerciseCard({
  exercise,
  expanded,
  onToggle,
  onMarkSet,
  onLogAmrap,
  onToggleWarmup,
}: ExerciseCardProps) {
  const { data } = useApp()
  const lift = resolveLift(data.lifts, exercise.liftId)
  const spec = stageSpec(exercise.tier, exercise.stage)
  const logged = exercise.sets.filter((set) => set.success !== null).length
  const complete = exercise.sets.every((set) => set.success !== null)
  const missed = exercise.sets.some((set) => set.success === false)
  const outcome = complete
    ? applyProgression(
        exercise.liftId,
        exercise.tier,
        { weight: exercise.weight, stage: exercise.stage },
        exerciseSucceeded(exercise),
      )
    : null
  const preview = outcome ? describeOutcome(outcome) : null

  return (
    <section
      className={`exercise ${expanded ? 'is-open' : ''} ${complete ? 'is-complete' : ''} tier-border-${exercise.tier.toLowerCase()}`}
    >
      <button type="button" className="exercise-head" onClick={onToggle} aria-expanded={expanded}>
        <span className={`tier-dot tier-${exercise.tier.toLowerCase()}`}>{exercise.tier}</span>
        <span className="exercise-title">
          <span className="exercise-name">{lift.name}</span>
          <span className="exercise-sub">
            {schemeLabel(spec.sets, spec.reps)}
            {exercise.tier === 'T3' ? ' · accessory' : ` · stage ${exercise.stage + 1}/3`}
          </span>
        </span>
        <span className="exercise-weight">
          {formatWeight(exercise.weight)}
          <small>lb</small>
        </span>
        <span
          className={`exercise-count ${complete ? (missed ? 'is-missed' : 'is-done') : ''}`}
          aria-label={
            complete
              ? missed
                ? `All ${exercise.sets.length} sets logged, at least one missed`
                : `All ${exercise.sets.length} sets hit`
              : `${logged} of ${exercise.sets.length} sets logged`
          }
        >
          {complete ? (missed ? '✗' : '✓') : `${logged}/${exercise.sets.length}`}
        </span>
        <ChevronIcon open={expanded} />
      </button>

      {expanded && (
        <div className="exercise-body">
          <WarmupList
            liftId={exercise.liftId}
            warmups={exercise.warmups}
            onToggle={onToggleWarmup}
          />
          <PlateBreakdown liftId={exercise.liftId} weight={exercise.weight} />

          <ul className="set-list">
            {exercise.sets.map((set, index) => (
              <SetRow
                key={index}
                index={index}
                set={set}
                e1rm={exercise.e1rm}
                onMark={(success) => onMarkSet(index, success)}
                onLogAmrap={onLogAmrap}
              />
            ))}
          </ul>

          {preview ? (
            <div className={`next-preview tone-${preview.tone}`}>
              <span className="next-label">Next time</span>
              <span className="next-value">{preview.title}</span>
              <span className="next-detail">{preview.detail}</span>
            </div>
          ) : (
            <div className="next-preview tone-muted">
              <span className="next-label">{exercise.tier === 'T3' ? 'Accessory' : 'Next time'}</span>
              <span className="next-detail">
                {exercise.tier === 'T3'
                  ? 'Weight stays put — add reps on the AMRAP set.'
                  : 'Finish every set to see your next weight.'}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
