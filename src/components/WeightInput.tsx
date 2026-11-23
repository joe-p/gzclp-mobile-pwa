import { useState } from 'react'
import { MIN_WEIGHT, roundToIncrement, WEIGHT_STEP } from '../domain/units'

interface WeightInputProps {
  value: number
  onChange: (value: number) => void
  label: string
  step?: number
  /** Lowest allowed weight. T3 accessories pass 0 so they can be unweighted. */
  min?: number
  id?: string
}

export function WeightInput({
  value,
  onChange,
  label,
  step = WEIGHT_STEP,
  min = MIN_WEIGHT,
  id,
}: WeightInputProps) {
  // `draft` is only set while the field is being edited, so external weight
  // changes (stepper, reset, import) always show up without a sync effect.
  const [draft, setDraft] = useState<string | null>(null)

  const clamp = (next: number) => Math.max(min, roundToIncrement(next, step))

  const commit = () => {
    const parsed = Number(draft)
    const usable = draft !== null && draft.trim() !== '' && Number.isFinite(parsed)
    const next = clamp(usable ? parsed : value)
    setDraft(null)
    onChange(next)
  }

  const nudge = (delta: number) => {
    setDraft(null)
    onChange(clamp(value + delta))
  }

  return (
    <div className="weight-input">
      <button type="button" className="step-btn" onClick={() => nudge(-step)} aria-label={`Decrease ${label}`}>
        −
      </button>
      <div className="weight-field">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft ?? String(value)}
          aria-label={`${label} in pounds`}
          onFocus={(event) => {
            setDraft(event.currentTarget.value)
            event.currentTarget.select()
          }}
          onChange={(event) => setDraft(event.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span className="unit">lb</span>
      </div>
      <button type="button" className="step-btn" onClick={() => nudge(step)} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}
