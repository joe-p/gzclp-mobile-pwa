import { computePlateLoad, isBarbellLift } from '../domain/plates'
import type { LiftId } from '../domain/types'
import { formatWeight } from '../domain/units'
import { useApp } from '../store/context'

interface PlateChipsProps {
  liftId: LiftId
  weight: number
  /** Lift name, used for the group's accessible label. */
  name: string
}

function plateClass(size: number): string {
  return `plate-chip plate-size-${String(size).replace('.', '-')}`
}

/**
 * Compact "plates per side" row for weight previews. Unlike PlateBreakdown it
 * skips the stack graphic and bar math, so it stays scannable in a list.
 * Machine/accessory lifts render nothing.
 */
export function PlateChips({ liftId, weight, name }: PlateChipsProps) {
  const { data } = useApp()

  if (!isBarbellLift(data.lifts[liftId])) return null

  const load = computePlateLoad(weight, data.settings.plates)

  return (
    <div
      className={`plate-chips ${load.exact ? '' : 'is-short'}`}
      role="group"
      aria-label={`Plates per side for ${name}`}
    >
      {load.belowBar ? (
        <span className="plate-chips-note">Lighter than bar</span>
      ) : load.perSide.length === 0 ? (
        <span className="plate-chips-note">Empty bar</span>
      ) : (
        <span className="plate-chips-list">
          {load.perSide.map((size, index) => (
            <span key={`${size}-${index}`} className={plateClass(size)}>
              {formatWeight(size)}
            </span>
          ))}
        </span>
      )}
      {!load.exact && !load.belowBar && (
        <span className="plate-chips-warn">
          Short {formatWeight(load.shortPerSide * 2)} lb
        </span>
      )}
    </div>
  )
}
