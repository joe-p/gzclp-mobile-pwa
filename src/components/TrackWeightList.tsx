import { e1rmForStage } from '../domain/onerm'
import { resolveLift, slotsForTier, stageSpec, trackKey } from '../domain/program'
import type {
  LiftDefinition,
  LiftId,
  ProgramDay,
  T3ByDay,
  Tier,
  TrackKey,
} from '../domain/types'
import { formatWeight } from '../domain/units'
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

function MoveButtons({
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

function WeightRow({
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
      <WeightInput value={weight} label={`${lift.name} ${tier}`} onChange={onChange} />
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

interface DayWeightListProps {
  day: ProgramDay
  days: readonly ProgramDay[]
  lifts: Record<LiftId, LiftDefinition>
  weightFor: (key: TrackKey) => number
  onChange: (key: TrackKey, weight: number) => void
  stageFor?: (key: TrackKey) => number
  showE1rm?: boolean
  onRemoveT3: (liftId: LiftId) => void
  onMoveT3?: (liftId: LiftId, direction: -1 | 1) => void
}

export function DayWeightList({
  day,
  days,
  lifts,
  weightFor,
  onChange,
  stageFor,
  showE1rm = false,
  onRemoveT3,
  onMoveT3,
}: DayWeightListProps) {
  const t3Ids = day.slots.filter((slot) => slot.tier === 'T3').map((slot) => slot.liftId)
  return (
    <ul className="weight-list">
      {day.slots.map(({ liftId, tier }) => {
        const key = trackKey(liftId, tier)
        const lift = resolveLift(lifts, liftId)
        const t3Index = tier === 'T3' ? t3Ids.indexOf(liftId) : -1
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
            showE1rm={showE1rm}
            note={otherDays.length ? `shared with ${otherDays.join(', ')}` : undefined}
            onRemove={tier === 'T3' ? () => onRemoveT3(liftId) : undefined}
            removeLabel={`Remove ${lift.name} from ${day.label}`}
            onMove={
              onMoveT3 && t3Index !== -1 ? (direction) => onMoveT3(liftId, direction) : undefined
            }
            moveLabels={
              onMoveT3
                ? {
                    up: `Move ${lift.name} earlier in ${day.label}`,
                    down: `Move ${lift.name} later in ${day.label}`,
                  }
                : undefined
            }
            canMoveUp={t3Index > 0}
            canMoveDown={t3Index !== -1 && t3Index < t3Ids.length - 1}
            onChange={(weight) => onChange(key, weight)}
          />
        )
      })}
    </ul>
  )
}
