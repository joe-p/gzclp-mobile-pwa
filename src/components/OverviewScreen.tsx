import { upcomingWorkouts } from '../domain/overview'
import { programDays } from '../domain/program'
import { useApp } from '../store/context'
import { DayPreview } from './DayPreview'

const UPCOMING_COUNT = 4

function workoutTag(offset: number, inProgress: boolean): string {
  if (inProgress) return 'In progress'
  if (offset === 0) return 'Up next'
  return `In ${offset} workout${offset === 1 ? '' : 's'}`
}

/** The next full rotation, each day shown like the "up next" workout card. */
export function OverviewScreen() {
  const { data } = useApp()
  const days = programDays(data.t3ByDay)
  const workouts = upcomingWorkouts(days, data.nextDayIndex, UPCOMING_COUNT)
  const activeDayId = data.activeSession?.dayId

  return (
    <div className="stack">
      <div>
        <h1 className="screen-title">Overview</h1>
        <p className="muted small overview-intro">
          Your next {UPCOMING_COUNT} workouts in order. Weights and plates update as you finish
          sessions.
        </p>
      </div>

      {workouts.map((workout) => {
        const inProgress = workout.offset === 0 && activeDayId === workout.day.id
        const tag = workoutTag(workout.offset, inProgress)

        return (
          <section className="card overview-card" key={`${workout.day.id}-${workout.offset}`}>
            <div className="overview-day-head">
              <div className="overview-day-title">
                <span className="overview-day-label">{workout.day.label}</span>
                <span className="overview-day-focus">{workout.day.focus}</span>
              </div>
              <span className={`overview-tag ${workout.offset === 0 ? 'is-next' : ''}`}>{tag}</span>
            </div>

            <DayPreview day={workout.day} />
          </section>
        )
      })}
    </div>
  )
}
