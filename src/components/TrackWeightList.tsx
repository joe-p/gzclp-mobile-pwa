import { LIFTS, PROGRAM_DAYS, slotsForTier, stageSpec, trackKey } from '../domain/program'
import type { LiftId, ProgramDay, Tier, TrackKey } from '../domain/types'
import { WeightInput } from './WeightInput'

interface WeightRowProps {
  liftId: LiftId
  tier: Tier
  weight: number
  stage: number
  showStage: boolean
  note?: string
  onChange: (weight: number) => void
}

function WeightRow({ liftId, tier, weight, stage, showStage, note, onChange }: WeightRowProps) {
  const spec = stageSpec(tier, stage)
  return (
    <li className="weight-row">
      <div className="weight-meta">
        <span className={`tier-dot tier-${tier.toLowerCase()}`}>{tier}</span>
        <div>
          <div className="weight-name">{LIFTS[liftId].name}</div>
          <div className="muted tiny">
            {spec.sets}×{spec.reps}+
            {showStage && tier !== 'T3' ? ` · stage ${stage + 1}` : ''}
            {note ? ` · ${note}` : ''}
          </div>
        </div>
      </div>
      <WeightInput
        value={weight}
        label={`${LIFTS[liftId].name} ${tier}`}
        onChange={onChange}
      />
    </li>
  )
}

interface TrackWeightListProps {
  tier: Tier
  weightFor: (key: TrackKey) => number
  onChange: (key: TrackKey, weight: number) => void
  stageFor?: (key: TrackKey) => number
}

export function TrackWeightList({ tier, weightFor, onChange, stageFor }: TrackWeightListProps) {
  return (
    <ul className="weight-list">
      {slotsForTier(tier).map(({ liftId, key }) => (
        <WeightRow
          key={key}
          liftId={liftId}
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

/** Program days each track appears on. T3 tracks shared by two days edit the same weight. */
const TRACK_DAYS = (() => {
  const days = new Map<TrackKey, string[]>()
  for (const day of PROGRAM_DAYS) {
    for (const slot of day.slots) {
      const key = trackKey(slot.liftId, slot.tier)
      days.set(key, [...(days.get(key) ?? []), day.label])
    }
  }
  return days
})()

interface DayWeightListProps {
  day: ProgramDay
  weightFor: (key: TrackKey) => number
  onChange: (key: TrackKey, weight: number) => void
  stageFor?: (key: TrackKey) => number
}

export function DayWeightList({ day, weightFor, onChange, stageFor }: DayWeightListProps) {
  return (
    <ul className="weight-list">
      {day.slots.map(({ liftId, tier }) => {
        const key = trackKey(liftId, tier)
        const otherDays = (TRACK_DAYS.get(key) ?? []).filter((label) => label !== day.label)
        return (
          <WeightRow
            key={key}
            liftId={liftId}
            tier={tier}
            weight={weightFor(key)}
            stage={stageFor ? stageFor(key) : 0}
            showStage={Boolean(stageFor)}
            note={otherDays.length ? `shared with ${otherDays.join(', ')}` : undefined}
            onChange={(weight) => onChange(key, weight)}
          />
        )
      })}
    </ul>
  )
}
