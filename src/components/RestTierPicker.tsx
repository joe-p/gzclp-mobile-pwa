import { TIERS } from '../domain/program'
import { clampRestSeconds, MAX_REST_SECONDS, REST_STEP_SECONDS } from '../domain/rest'
import type { RestByTier, RestRange, Tier } from '../domain/types'
import { formatDuration } from '../domain/units'

const TIER_LABELS: Record<Tier, string> = {
  T1: 'T1 · main lifts',
  T2: 'T2 · secondary lifts',
  T3: 'T3 · accessories',
}

interface RestTierPickerProps {
  value: RestByTier
  onChange: (tier: Tier, range: RestRange) => void
}

function DurationStepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (seconds: number) => void
}) {
  return (
    <div className="rest-range-field">
      <span className="rest-range-caption">{label}</span>
      <div className="rest-range-stepper">
        <button
          type="button"
          onClick={() => onChange(value - REST_STEP_SECONDS)}
          disabled={value <= 0}
          aria-label={`Decrease ${label.toLowerCase()} rest`}
        >
          −
        </button>
        <span>{formatDuration(value)}</span>
        <button
          type="button"
          onClick={() => onChange(value + REST_STEP_SECONDS)}
          disabled={value >= MAX_REST_SECONDS}
          aria-label={`Increase ${label.toLowerCase()} rest`}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function RestTierPicker({ value, onChange }: RestTierPickerProps) {
  return (
    <div className="rest-tier-list">
      {TIERS.map((tier) => {
        const range = value[tier]
        const setMin = (seconds: number) => {
          const min = clampRestSeconds(seconds)
          // Raising the minimum past the maximum pushes the maximum along with it.
          onChange(tier, { min, max: Math.max(min, range.max) })
        }
        const setMax = (seconds: number) => {
          const max = clampRestSeconds(seconds)
          // Lowering the maximum below the minimum pulls the minimum down too.
          onChange(tier, { min: Math.min(range.min, max), max })
        }

        return (
          <div className="rest-tier" key={tier}>
            <span className="rest-tier-label">{TIER_LABELS[tier]}</span>
            <div className="rest-range" role="group" aria-label={`${TIER_LABELS[tier]} rest range`}>
              <DurationStepper label="Min" value={range.min} onChange={setMin} />
              <span className="rest-range-sep" aria-hidden="true">
                –
              </span>
              <DurationStepper label="Max" value={range.max} onChange={setMax} />
            </div>
            <p className="rest-tier-hint">
              Skip unlocks at {formatDuration(range.min)} · warning at {formatDuration(range.max)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
