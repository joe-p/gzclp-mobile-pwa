import { useState } from 'react'
import type { SetRecord } from '../domain/types'
import { CheckIcon, XIcon } from './icons'

interface SetRowProps {
  index: number
  set: SetRecord
  e1rm: number | null
  onMark: (success: boolean | null) => void
  onLogAmrap: (reps: number) => void
}

export function SetRow({ index, set, e1rm, onMark, onLogAmrap }: SetRowProps) {
  // Local draft while stepper editing; falls back to the logged value.
  const [draft, setDraft] = useState<number | null>(null)
  const reps = draft ?? set.reps ?? set.target

  const bump = (delta: number) => setDraft(Math.max(0, Math.min(99, reps + delta)))

  const log = () => {
    onLogAmrap(reps)
    setDraft(null)
  }

  if (set.amrap) {
    return (
      <li className={`set-row set-amrap ${set.success === null ? '' : set.success ? 'is-ok' : 'is-miss'}`}>
        <div className="set-line">
          <span className="set-label">
            Set {index + 1} <em>AMRAP</em>
          </span>
          <span className="set-target">{set.target}+ reps</span>
        </div>

        <div className="amrap-controls">
          <div className="stepper">
            <button type="button" onClick={() => bump(-1)} aria-label="Decrease reps">
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={reps}
              aria-label={`AMRAP reps for set ${index + 1}`}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(/[^0-9]/g, ''))
                setDraft(Number.isFinite(parsed) ? Math.min(99, parsed) : 0)
              }}
            />
            <button type="button" onClick={() => bump(1)} aria-label="Increase reps">
              +
            </button>
          </div>
          <button type="button" className="btn btn-ghost log-btn" onClick={log}>
            {set.success === null ? 'Log' : 'Update'}
          </button>
        </div>

        {set.success !== null && (
          <div className={`amrap-note ${set.success ? 'ok' : 'miss'}`}>
            <span>{set.success ? `Target hit · ${set.reps} reps` : `Short of ${set.target} · ${set.reps} reps`}</span>
            {e1rm !== null && <span className="e1rm">e1RM {e1rm} lb</span>}
          </div>
        )}
      </li>
    )
  }

  return (
    <li className={`set-row ${set.success === null ? '' : set.success ? 'is-ok' : 'is-miss'}`}>
      <div className="set-line">
        <span className="set-label">Set {index + 1}</span>
        <span className="set-target">{set.target} reps</span>
      </div>
      <div className="set-actions">
        <button
          type="button"
          className={`mark ok ${set.success === true ? 'is-active' : ''}`}
          aria-label={`Set ${index + 1} succeeded`}
          aria-pressed={set.success === true}
          onClick={() => onMark(set.success === true ? null : true)}
        >
          <CheckIcon />
        </button>
        <button
          type="button"
          className={`mark miss ${set.success === false ? 'is-active' : ''}`}
          aria-label={`Set ${index + 1} failed`}
          aria-pressed={set.success === false}
          onClick={() => onMark(set.success === false ? null : false)}
        >
          <XIcon />
        </button>
      </div>
    </li>
  )
}
