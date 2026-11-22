import { computePlateLoad, isBarbellLift } from '../domain/plates'
import type { LiftId } from '../domain/types'
import { formatWeight } from '../domain/units'
import { useApp } from '../store/context'

interface PlateBreakdownProps {
  liftId: LiftId
  weight: number
}

function plateClass(size: number): string {
  return `plate plate-size-${String(size).replace('.', '-')}`
}

/** Shows exactly which plates to slide on each side for the working weight. */
export function PlateBreakdown({ liftId, weight }: PlateBreakdownProps) {
  const { data } = useApp()

  if (!isBarbellLift(data.lifts[liftId])) {
    return (
      <div className="plate-load plate-load-machine">
        <span className="plate-load-title">No bar</span>
        <p className="plate-load-detail">Set the weight directly — no plate math for this accessory.</p>
      </div>
    )
  }

  const load = computePlateLoad(weight, data.settings.plates)

  return (
    <div className={`plate-load ${load.exact ? '' : 'is-short'}`}>
      <div className="plate-load-head">
        <span className="plate-load-title">On the bar</span>
        <span className="plate-load-total">
          {formatWeight(load.loadedWeight)} <small>lb</small>
        </span>
      </div>

      {load.belowBar ? (
        <p className="plate-load-detail">
          Lighter than your {formatWeight(load.bar)} lb bar — use a lighter bar or dumbbells.
        </p>
      ) : load.perSide.length === 0 ? (
        <p className="plate-load-detail">Empty bar · {formatWeight(load.bar)} lb</p>
      ) : (
        <>
          <div className="plate-stack" aria-hidden="true">
            {load.perSide.map((size, index) => (
              <span key={`${size}-${index}`} className={plateClass(size)}>
                {formatWeight(size)}
              </span>
            ))}
          </div>
          <p className="plate-load-detail">
            <strong>Per side:</strong> {load.perSide.map(formatWeight).join(' + ')} lb · bar{' '}
            {formatWeight(load.bar)} lb
          </p>
        </>
      )}

      {!load.exact && !load.belowBar && (
        <p className="plate-load-warn">
          Short {formatWeight(load.shortPerSide * 2)} lb — closest load is{' '}
          {formatWeight(load.loadedWeight)} lb.
        </p>
      )}
    </div>
  )
}
