import { describeOutcome } from '../domain/progression'
import { programDays, resolveLift, schemeLabel, stageSpec } from '../domain/program'
import type { SessionRecord } from '../domain/types'
import { formatWeight } from '../domain/units'
import { useApp } from '../store/context'

export function SummarySheet({ session }: { session: SessionRecord }) {
  const { data, dispatch } = useApp()
  const days = programDays(data.t3ByDay)
  const day = days.find((item) => item.id === session.dayId) ?? days[0]
  const increased = session.exercises.filter((exercise) => exercise.outcome?.action === 'increase').length

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Workout summary">
      <div className="sheet">
        <div className="sheet-handle" aria-hidden="true" />
        <span className="eyebrow">Workout complete</span>
        <h2>
          {day.label} · {day.focus}
        </h2>
        <p className="muted small">
          {increased} of {session.exercises.length} lifts move up next session. T3 accessories stay at
          the same weight.
        </p>

        <ul className="summary-list">
          {session.exercises.map((exercise) => {
            const lift = resolveLift(data.lifts, exercise.liftId)
            const spec = stageSpec(exercise.tier, exercise.stage)
            const description = exercise.outcome ? describeOutcome(exercise.outcome) : null
            return (
              <li key={`${exercise.liftId}:${exercise.tier}`} className="summary-row">
                <div className="summary-head">
                  <span className={`tier-dot tier-${exercise.tier.toLowerCase()}`}>{exercise.tier}</span>
                  <span className="summary-name">{lift.name}</span>
                  <span className="muted small">
                    {schemeLabel(spec.sets, spec.reps)} · {formatWeight(exercise.weight)} lb
                  </span>
                </div>
                {description ? (
                  <div className={`summary-outcome tone-${description.tone}`}>
                    <span>{description.title}</span>
                    <span className="muted small">{description.detail}</span>
                  </div>
                ) : (
                  <div className="summary-outcome tone-muted">
                    <span>{exercise.sets.some((set) => set.success !== null) ? 'incomplete' : 'skipped'}</span>
                    <span className="muted small">weight unchanged</span>
                  </div>
                )}
                {exercise.e1rm !== null && <span className="tiny muted">e1RM {exercise.e1rm} lb</span>}
                {exercise.warmups.length > 0 && (
                  <span className="tiny muted">
                    Warmups {exercise.warmups.filter((warmup) => warmup.completed).length}/
                    {exercise.warmups.length}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => dispatch({ type: 'dismissSummary' })}
        >
          Done
        </button>
      </div>
    </div>
  )
}
