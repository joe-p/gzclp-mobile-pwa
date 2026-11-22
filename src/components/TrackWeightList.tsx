import { resolveLift, slotsForTier, stageSpec, trackKey } from '../domain/program'
import type {
  LiftDefinition,
  LiftId,
  ProgramDay,
  T3ByDay,
  Tier,
  TrackKey,
} from '../domain/types'
import { WeightInput } from './WeightInput'

interface WeightRowProps {
  lift: LiftDefinition
  tier: Tier
  weight: number
  stage: number
  showStage: boolean
  note?: string
  removeLabel?: string
  onRemove?: () => void
  onChange: (weight: number) => void
}

function WeightRow({
  lift,
  tier,
  weight,
  stage,
  showStage,
  note,
  removeLabel,
  onRemove,
  onChange,
}: WeightRowProps) {
  const spec = stageSpec(tier, stage)
  return (
    <li className={`weight-row ${onRemove ? 'has-remove' : ''}`}>
      <div className="weight-meta">
        <span className={`tier-dot tier-${tier.toLowerCase()}`}>{tier}</span>
        <div>
          <div className="weight-name">{lift.name}</div>
          <div className="muted tiny">
            {spec.sets}×{spec.reps}+
            {showStage && tier !== 'T3' ? ` · stage ${stage + 1}` : ''}
            {note ? ` · ${note}` : ''}
          </div>
        </div>
      </div>
      <WeightInput value={weight} label={`${lift.name} ${tier}`} onChange={onChange} />
      {onRemove && (
        <button
          type="button"
          className="row-remove"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${lift.name}`}
        >
          ✕
        </button>
      )}
    </li>
  )
}

interface TrackWeightListProps {
  tier: Tier
  lifts: Record<LiftId, LiftDefinition>
  t3ByDay: T3ByDay
  weightFor: (key: TrackKey) => number
  onChange: (key: TrackKey, weight: number) => void
  stageFor?: (key: TrackKey) => number
}

export function TrackWeightList({
  tier,
  lifts,
  t3ByDay,
  weightFor,
  onChange,
  stageFor,
}: TrackWeightListProps) {
  return (
    <ul className="weight-list">
      {slotsForTier(tier, t3ByDay).map(({ liftId, key }) => (
        <WeightRow
          key={key}
          lift={resolveLift(lifts, liftId)}
          tier={tier}
          weight={weightFor(key)}
          stage={stageFor ? stageFor(key) : 0}
          showStage={Boolean(stageFor)}
          onChange={(weight) => onChange(key, weight)}
        />
      ))}
    </ul>
  )
}

interface DayWeightListProps {
  day: ProgramDay
  days: readonly ProgramDay[]
  lifts: Record<LiftId, LiftDefinition>
  weightFor: (key: TrackKey) => number
  onChange: (key: TrackKey, weight: number) => void
  stageFor?: (key: TrackKey) => number
  onRemoveT3: (liftId: LiftId) => void
}

export function DayWeightList({
  day,
  days,
  lifts,
  weightFor,
  onChange,
  stageFor,
  onRemoveT3,
}: DayWeightListProps) {
  return (
    <ul className="weight-list">
      {day.slots.map(({ liftId, tier }) => {
        const key = trackKey(liftId, tier)
        const lift = resolveLift(lifts, liftId)
        const otherDays = days
          .filter(
            (other) =>
              other.id !== day.id &&
              other.slots.some((slot) => trackKey(slot.liftId, slot.tier) === key),
          )
          .map((other) => other.label)
        return (
          <WeightRow
            key={key}
            lift={lift}
            tier={tier}
            weight={weightFor(key)}
            stage={stageFor ? stageFor(key) : 0}
            showStage={Boolean(stageFor)}
            note={otherDays.length ? `shared with ${otherDays.join(', ')}` : undefined}
            onRemove={tier === 'T3' ? () => onRemoveT3(liftId) : undefined}
            removeLabel={`Remove ${lift.name} from ${day.label}`}
            onChange={(weight) => onChange(key, weight)}
          />
        )
      })}
    </ul>
  )
}
