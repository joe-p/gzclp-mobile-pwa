import { programDays } from '../domain/program'
import type { Tier } from '../domain/types'
import { useApp } from '../store/context'
import { ExerciseCard } from './ExerciseCard'

interface SessionScreenProps {
  onSetLogged: (tier: Tier) => void
}

export function SessionScreen({ onSetLogged }: SessionScreenProps) {
  const { data, dispatch } = useApp()
  const session = data.activeSession
  if (!session) return null

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
          onToggleWarmup={(warmupIndex, completed) =>
            dispatch({ type: 'recordWarmup', exerciseIndex: index, warmupIndex, completed })
          }
        />
      ))}

      <button type="button" className="text-btn danger" onClick={discard}>
        Discard workout
      </button>
    </div>
  )
}
