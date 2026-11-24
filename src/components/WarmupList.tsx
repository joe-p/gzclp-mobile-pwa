import type { PlateLoad } from '../domain/plates'
import type { WarmupRecord } from '../domain/types'
import { formatWeight } from '../domain/units'
import { CheckIcon } from './icons'

interface WarmupListProps {
  warmups: readonly WarmupRecord[]
  /**
   * Plate loads for the ramp, solved in order so each step reuses what the
   * previous one left on the bar. Null for lifts that are not barbell loaded.
   */
  plateLoads: readonly PlateLoad[] | null
  onToggle: (warmupIndex: number, completed: boolean) => void
}

/** Checkable warmup ramp shown above the work sets for T1 and T2. */
export function WarmupList({ warmups, plateLoads, onToggle }: WarmupListProps) {
  if (warmups.length === 0) return null

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
          const load = plateLoads?.[index] ?? null
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
                  {load.belowBar
                    ? 'DB'
                    : load.perSide.length === 0
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
