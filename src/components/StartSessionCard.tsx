import { useState } from 'react'
import { programDays, resolveLift, schemeLabel, stageSpec, trackKey } from '../domain/program'
import { formatWeight } from '../domain/units'
import { useApp } from '../store/context'
import { PlateChips } from './PlateChips'

export function StartSessionCard() {
  const { data, dispatch } = useApp()
  const [changingDay, setChangingDay] = useState(false)
  const days = programDays(data.t3ByDay)
  const dayIndex = Math.min(Math.max(data.nextDayIndex, 0), days.length - 1)
  const day = days[dayIndex] ?? days[0]

  return (
    <div className="stack">
      <section className="day-banner">
        <div>
          <span className="eyebrow">Up next</span>
          <h1>
            {day.label} · {day.focus}
          </h1>
          <p className="muted small">Day {dayIndex + 1} of {days.length} in the rotation</p>
        </div>
      </section>

      <section className="card">
        <ul className="preview-list">
          {day.slots.map((slot) => {
            const key = trackKey(slot.liftId, slot.tier)
            const track = data.tracks[key]
            const spec = stageSpec(slot.tier, track.stage)
            const lift = resolveLift(data.lifts, slot.liftId)
            return (
              <li key={key} className="preview-lift">
                <div className="preview-row">
                  <span className={`tier-dot tier-${slot.tier.toLowerCase()}`}>{slot.tier}</span>
                  <span className="preview-name">{lift.name}</span>
                  <span className="preview-scheme">{schemeLabel(spec.sets, spec.reps)}</span>
                  <span className="preview-weight">
                    {formatWeight(track.weight)}
                    <small>lb</small>
                  </span>
                </div>
                <PlateChips liftId={slot.liftId} weight={track.weight} name={lift.name} />
              </li>
            )
          })}
        </ul>

        <div className="day-switch">
          <button
            type="button"
            className="text-btn day-switch-toggle"
            aria-expanded={changingDay}
            aria-controls="day-switch-options"
            onClick={() => setChangingDay((open) => !open)}
          >
            {changingDay ? 'Cancel' : 'Change day'}
          </button>

          {changingDay && (
            <div className="day-switch-options" id="day-switch-options">
              <div className="chip-row">
                {days.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${index === dayIndex ? 'is-selected' : ''}`}
                    aria-pressed={index === dayIndex}
                    onClick={() => {
                      dispatch({ type: 'selectDay', dayIndex: index })
                      setChangingDay(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="muted tiny day-switch-note">
                Skipping ahead or repeating a day doesn't change any weights.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block start-btn"
          onClick={() => dispatch({ type: 'startSession' })}
        >
          Start {day.label} workout
        </button>
      </section>

      <section className="card subtle">
        <h2 className="card-title">How it works</h2>
        <p className="muted small">
          Hit every rep and the app adds 5 lb to upper-body lifts and 10 lb to lower-body lifts next
          time. Miss a set and you drop to the next rep scheme at the same weight. Fail the final
          scheme and it resets you to 90%.
        </p>
      </section>
    </div>
  )
}
