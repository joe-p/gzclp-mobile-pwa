import { upcomingWorkouts } from '../domain/overview'
import { programDays, resolveLift, schemeLabel, stageSpec, trackKey } from '../domain/program'
import { formatWeight } from '../domain/units'
import { warmupSets } from '../domain/warmup'
import { useApp } from '../store/context'

const UPCOMING_COUNT = 4

function workoutTag(offset: number, inProgress: boolean): string {
  if (inProgress) return 'In progress'
  if (offset === 0) return 'Up next'
  return `In ${offset} workout${offset === 1 ? '' : 's'}`
}

/** Compact look-ahead at the next full rotation, with warmup ramps. */
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
          Your next {UPCOMING_COUNT} workouts in order. Weights update as you finish sessions.
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

            <ul className="overview-lift-list">
              {workout.day.slots.map((slot) => {
                const key = trackKey(slot.liftId, slot.tier)
                const track = data.tracks[key]
                const lift = resolveLift(data.lifts, slot.liftId)
                const spec = stageSpec(slot.tier, track.stage)
                const warmups = warmupSets(
                  slot.liftId,
                  slot.tier,
                  track.weight,
                  data.settings.plates.bar,
                  data.settings.warmupMethod,
                )

                return (
                  <li className="overview-lift" key={key}>
                    <div className="overview-lift-main">
                      <span className={`tier-dot tier-${slot.tier.toLowerCase()}`}>{slot.tier}</span>
                      <span className="overview-lift-title">
                        <span className="overview-lift-name">{lift.name}</span>
                        <span className="overview-lift-sub">
                          {schemeLabel(spec.sets, spec.reps)}
                          {slot.tier === 'T3' ? ' · accessory' : ` · stage ${track.stage + 1}/3`}
                        </span>
                      </span>
                      <span className="overview-lift-weight">
                        {formatWeight(track.weight)}
                        <small>lb</small>
                      </span>
                    </div>

                    {warmups.length > 0 && (
                      <div
                        className="overview-warmups"
                        role="group"
                        aria-label={`Warmup ramp for ${lift.name}`}
                      >
                        <span className="overview-warmup-title">Warmup</span>
                        {warmups.map((warmup, index) => (
                          <span
                            className="overview-warmup"
                            key={`${warmup.weight}-${warmup.reps}-${index}`}
                          >
                            <span className="overview-warmup-weight">
                              {formatWeight(warmup.weight)}
                              <small>lb</small>
                            </span>
                            <span className="overview-warmup-scheme">
                              {warmup.sets}×{warmup.reps}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
