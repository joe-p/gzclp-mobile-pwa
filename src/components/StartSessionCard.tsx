import { programDays, resolveLift, schemeLabel, stageSpec, trackKey } from '../domain/program'
import { formatWeight } from '../domain/units'
import { useApp } from '../store/context'

export function StartSessionCard() {
  const { data, dispatch } = useApp()
  const days = programDays(data.t3ByDay)
  const day = days[data.nextDayIndex] ?? days[0]

  return (
    <div className="stack">
      <section className="day-banner">
        <div>
          <span className="eyebrow">Up next</span>
          <h1>
            {day.label} · {day.focus}
          </h1>
          <p className="muted small">Day {data.nextDayIndex + 1} of 4 in the rotation</p>
        </div>
      </section>

      <section className="card">
        <ul className="preview-list">
          {day.slots.map((slot) => {
            const key = trackKey(slot.liftId, slot.tier)
            const track = data.tracks[key]
            const spec = stageSpec(slot.tier, track.stage)
            return (
              <li key={key} className="preview-row">
                <span className={`tier-dot tier-${slot.tier.toLowerCase()}`}>{slot.tier}</span>
                <span className="preview-name">{resolveLift(data.lifts, slot.liftId).name}</span>
                <span className="preview-scheme">{schemeLabel(spec.sets, spec.reps)}</span>
                <span className="preview-weight">
                  {formatWeight(track.weight)}
                  <small>lb</small>
                </span>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className="btn btn-primary btn-block start-btn"
          onClick={() => dispatch({ type: 'startSession' })}
        >
          Start workout
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
