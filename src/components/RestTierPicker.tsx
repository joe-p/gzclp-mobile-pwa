import { REST_CHOICES, TIERS } from '../domain/program'
import type { RestByTier, Tier } from '../domain/types'
import { formatDuration } from '../domain/units'

const TIER_LABELS: Record<Tier, string> = {
  T1: 'T1 · main lifts',
  T2: 'T2 · secondary lifts',
  T3: 'T3 · accessories',
}

interface RestTierPickerProps {
  value: RestByTier
  onChange: (tier: Tier, seconds: number) => void
}

export function RestTierPicker({ value, onChange }: RestTierPickerProps) {
  return (
    <div className="rest-tier-list">
      {TIERS.map((tier) => (
        <div className="rest-tier" key={tier}>
          <span className="rest-tier-label">{TIER_LABELS[tier]}</span>
          <div className="chip-row" role="group" aria-label={`${TIER_LABELS[tier]} rest time`}>
            {REST_CHOICES.map((seconds) => (
              <button
                key={seconds}
                type="button"
                className={`chip ${value[tier] === seconds ? 'is-selected' : ''}`}
                aria-pressed={value[tier] === seconds}
                onClick={() => onChange(tier, seconds)}
              >
                {formatDuration(seconds)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
