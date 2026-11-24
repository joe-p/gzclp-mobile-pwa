import { resolveLift, schemeLabel, stageSpec, trackKey } from '../domain/program'
import type { ProgramDay } from '../domain/types'
import { formatWeight } from '../domain/units'
import { warmupSets } from '../domain/warmup'
import { useApp } from '../store/context'
import { PlateChips } from './PlateChips'

interface DayPreviewProps {
  day: ProgramDay
}

/**
 * The lift list shared by the "up next" card and the overview. Each T1/T2 lift
 * also lists its warmup ramp, resolved from the current weight and bar the same
 * way a session snapshots it, so the ramp matches what you'll actually do.
 */
export function DayPreview({ day }: DayPreviewProps) {
  const { data } = useApp()

  return (
    <ul className="preview-list">
      {day.slots.map((slot) => {
        const key = trackKey(slot.liftId, slot.tier)
        const track = data.tracks[key]
        const spec = stageSpec(slot.tier, track.stage)
        const lift = resolveLift(data.lifts, slot.liftId)
        const warmups = warmupSets(
          slot.liftId,
          slot.tier,
          track.weight,
          data.settings.plates.bar,
        ).flatMap((set) =>
          Array.from({ length: set.sets }, () => ({ weight: set.weight, reps: set.reps })),
        )

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
            <div className="preview-meta">
              {warmups.length > 0 && (
                <div className="preview-warmups">
                  <span className="preview-warmups-label">Warmups</span>
                  <span className="preview-warmup-list">
                    {warmups.map((warmup, index) => (
                      <span
                        key={index}
                        className="preview-warmup"
                        title={`${formatWeight(warmup.weight)} lb × ${warmup.reps} reps`}
                      >
                        {formatWeight(warmup.weight)}×{warmup.reps}
                      </span>
                    ))}
                  </span>
                </div>
              )}
              <PlateChips liftId={slot.liftId} weight={track.weight} name={lift.name} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
