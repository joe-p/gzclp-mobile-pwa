import { e1rmForStage } from '../domain/onerm'
import { resolveLift, slotsForTier, stageSpec } from '../domain/program'
import type { LiftDefinition, LiftId, T3ByDay, Tier, TrackKey } from '../domain/types'
import { formatWeight, minWeightForTier } from '../domain/units'
import { WeightInput } from './WeightInput'

interface WeightRowProps {
  lift: LiftDefinition
  tier: Tier
  weight: number
  stage: number
  showStage: boolean
  showE1rm?: boolean
  note?: string
  removeLabel?: string
  onRemove?: () => void
  moveLabels?: { up: string; down: string }
  onMove?: (direction: -1 | 1) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onChange: (weight: number) => void
}

export function MoveButtons({
  labels,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  labels: { up: string; down: string }
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (direction: -1 | 1) => void
}) {
  return (
    <div className="row-moves">
      <button
        type="button"
        className="row-move"
        onClick={() => onMove(-1)}
        aria-label={labels.up}
        disabled={!canMoveUp}
      >
        ↑
      </button>
      <button
        type="button"
        className="row-move"
        onClick={() => onMove(1)}
        aria-label={labels.down}
        disabled={!canMoveDown}
      >
        ↓
      </button>
    </div>
  )
}

export function WeightRow({
  lift,
  tier,
  weight,
  stage,
  showStage,
  showE1rm = false,
  note,
  removeLabel,
  onRemove,
  moveLabels,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  onChange,
}: WeightRowProps) {
  const spec = stageSpec(tier, stage)
  const e1rm = showE1rm ? e1rmForStage(weight, tier, stage) : null
  return (
    <li
      className={`weight-row ${onRemove ? 'has-remove' : ''} ${
        onMove && moveLabels ? 'has-moves' : ''
      }`}
    >
      <div className="weight-meta">
        <span className={`tier-dot tier-${tier.toLowerCase()}`}>{tier}</span>
        <div>
          <div className="weight-name">{lift.name}</div>
          <div className="muted tiny">
            {spec.sets}×{spec.reps}+
            {showStage && tier !== 'T3' ? ` · stage ${stage + 1}` : ''}
            {note ? ` · ${note}` : ''}
          </div>
          {e1rm !== null && (
            <div className="weight-e1rm" title="Estimated one-rep max (Epley formula)">
              e1RM {formatWeight(e1rm)} lb
            </div>
          )}
        </div>
      </div>
      <WeightInput
        value={weight}
        label={`${lift.name} ${tier}`}
        min={minWeightForTier(tier)}
        onChange={onChange}
      />
      {onMove && moveLabels && (
        <MoveButtons
          labels={moveLabels}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMove={onMove}
        />
      )}
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
  showE1rm?: boolean
}

export function TrackWeightList({
  tier,
  lifts,
  t3ByDay,
  weightFor,
  onChange,
  stageFor,
  showE1rm = false,
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
          showE1rm={showE1rm}
          onChange={(weight) => onChange(key, weight)}
        />
      ))}
    </ul>
  )
}
