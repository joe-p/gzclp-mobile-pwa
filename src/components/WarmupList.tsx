import { computePlateLoad, isBarbellLift } from '../domain/plates'
import type { LiftId, WarmupRecord } from '../domain/types'
import { formatWeight } from '../domain/units'
import { useApp } from '../store/context'
import { CheckIcon } from './icons'

interface WarmupListProps {
  liftId: LiftId
  warmups: readonly WarmupRecord[]
  onToggle: (warmupIndex: number, completed: boolean) => void
}

/** Checkable warmup ramp shown above the work sets for T1 and T2. */
export function WarmupList({ liftId, warmups, onToggle }: WarmupListProps) {
  const { data } = useApp()
  if (warmups.length === 0) return null

  const barbell = isBarbellLift(data.lifts[liftId])
  const completed = warmups.filter((warmup) => warmup.completed).length

  return (
    <div className="warmup">
      <div className="warmup-head">
        <span className="warmup-title">Warmup</span>
        <span className="warmup-count">
          {completed}/{warmups.length} done
        </span>
      </div>

      <ul className="warmup-list">
        {warmups.map((warmup, index) => {
          const load = barbell ? computePlateLoad(warmup.weight, data.settings.plates) : null
          return (
            <li
              className={`warmup-row ${warmup.completed ? 'is-done' : ''}`}
              key={`${warmup.weight}-${warmup.reps}-${index}`}
            >
              <button
                type="button"
                className={`warmup-check ${warmup.completed ? 'is-checked' : ''}`}
                aria-label={`${warmup.completed ? 'Unmark' : 'Mark'} warmup ${index + 1}: ${formatWeight(warmup.weight)} lb for ${warmup.reps} reps`}
                aria-pressed={warmup.completed}
                onClick={() => onToggle(index, !warmup.completed)}
              >
                <CheckIcon />
              </button>
              <span className="warmup-weight">
                {formatWeight(warmup.weight)}
                <small>lb</small>
              </span>
              <span className="warmup-reps">{warmup.reps} reps</span>
              {load && (
                <span className="warmup-plates">
                  {load.perSide.length === 0
                    ? 'empty bar'
                    : `${load.perSide.map(formatWeight).join(' + ')} / side`}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="warmup-note">Tap ✓ as you finish each warmup. Warmups don't affect progression.</p>
    </div>
  )
}
