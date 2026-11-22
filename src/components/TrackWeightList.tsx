import { LIFTS, slotsForTier, stageSpec } from '../domain/program'
import type { Tier, TrackKey } from '../domain/types'
import { WeightInput } from './WeightInput'

interface TrackWeightListProps {
  tier: Tier
  weightFor: (key: TrackKey) => number
  onChange: (key: TrackKey, weight: number) => void
  stageFor?: (key: TrackKey) => number
}

export function TrackWeightList({ tier, weightFor, onChange, stageFor }: TrackWeightListProps) {
  return (
    <ul className="weight-list">
      {slotsForTier(tier).map(({ liftId, key }) => {
        const stage = stageFor ? stageFor(key) : 0
        const spec = stageSpec(tier, stage)
        return (
          <li key={key} className="weight-row">
            <div className="weight-meta">
              <span className={`tier-dot tier-${tier.toLowerCase()}`}>{tier}</span>
              <div>
                <div className="weight-name">{LIFTS[liftId].name}</div>
                <div className="muted tiny">
                  {spec.sets}×{spec.reps}+{stageFor && tier !== 'T3' ? ` · stage ${stage + 1}` : ''}
                </div>
              </div>
            </div>
            <WeightInput
              value={weightFor(key)}
              label={`${LIFTS[liftId].name} ${tier}`}
              onChange={(weight) => onChange(key, weight)}
            />
          </li>
        )
      })}
    </ul>
  )
}
