import { programDays } from '../domain/program'
import { finishesWarmupRamp, nextOpenSet } from '../domain/session'
import type { Tier } from '../domain/types'
import { useApp } from '../store/context'
import { ExerciseCard } from './ExerciseCard'

interface SessionScreenProps {
  onSetLogged: (tier: Tier) => void
  /** True while rest is running, which holds back the next set. */
  resting: boolean
}

export function SessionScreen({ onSetLogged, resting }: SessionScreenProps) {
  const { data, dispatch } = useApp()
  const session = data.activeSession
  if (!session) return null

  // Rest only ever gates the one set that comes up next, so logging can resume
  // the moment the minimum rest time has passed.
  const next = resting ? nextOpenSet(session) : null
  const days = programDays(data.t3ByDay)
  const day = days.find((item) => item.id === session.dayId) ?? days[0]

  const discard = () => {
    if (window.confirm('Discard this workout? Everything logged in this session will be lost.')) {
      dispatch({ type: 'discardSession' })
    }
  }

  return (
    <div className="stack">
      <section className="day-banner">
        <div>
          <span className="eyebrow">In progress</span>
          <h1>
            {day.label} · {day.focus}
          </h1>
          <p className="muted small">Last set of every lift is AMRAP. Leave 1–2 reps in the tank.</p>
        </div>
      </section>

      {session.exercises.map((exercise, index) => (
        <ExerciseCard
          key={`${exercise.liftId}:${exercise.tier}`}
          exercise={exercise}
          expanded={session.exerciseIndex === index}
          lockedSetIndex={next?.exerciseIndex === index ? next.setIndex : null}
          onToggle={() =>
            dispatch({ type: 'showExercise', index: session.exerciseIndex === index ? -1 : index })
          }
          onMarkSet={(setIndex, success) => {
            dispatch({ type: 'recordSet', exerciseIndex: index, setIndex, success })
            if (success !== null) onSetLogged(exercise.tier)
          }}
          onLogAmrap={(reps) => {
            dispatch({ type: 'recordAmrap', exerciseIndex: index, reps })
            onSetLogged(exercise.tier)
          }}
          onToggleWarmup={(warmupIndex, completed) => {
            dispatch({ type: 'recordWarmup', exerciseIndex: index, warmupIndex, completed })
            // Finishing the ramp starts the rest before the first work set, using
            // this lift's tier (T1 warmups lead into the T1 timer, T2 into T2).
            if (
              completed &&
              exercise.sets.some((set) => set.success === null) &&
              finishesWarmupRamp(exercise.warmups, warmupIndex)
            ) {
              onSetLogged(exercise.tier)
            }
          }}
        />
      ))}

      <button type="button" className="text-btn danger" onClick={discard}>
        Discard workout
      </button>
    </div>
  )
}
