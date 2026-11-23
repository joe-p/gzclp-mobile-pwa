import { useState } from 'react'
import type { SetRecord } from '../domain/types'
import { CheckIcon, XIcon } from './icons'

interface SetRowProps {
  index: number
  set: SetRecord
  e1rm: number | null
  /** True while an earlier set still needs a result, so this set cannot be logged yet. */
  locked: boolean
  /** 1-based number of the first set without a result, for the lock hint. */
  waitingOn: number | null
  onMark: (success: boolean | null) => void
  onLogAmrap: (reps: number) => void
}

export function SetRow({
  index,
  set,
  e1rm,
  locked,
  waitingOn,
  onMark,
  onLogAmrap,
}: SetRowProps) {
  // Local draft while stepper editing; falls back to the logged value.
  const [draft, setDraft] = useState<number | null>(null)
  const reps = draft ?? set.reps ?? set.target
  const number = index + 1
  const logged = set.success !== null
  const lockHint = waitingOn === null ? 'Not yet' : `Log set ${waitingOn} first`

  const bump = (delta: number) => setDraft(Math.max(0, Math.min(99, reps + delta)))

  /** Rewriting a set that already holds a result always asks first. */
  const confirmRewrite = (message: string) => !logged || window.confirm(message)

  const mark = (success: boolean | null) => {
    const from = set.success ? 'a hit' : 'a miss'
    const message =
      success === null
        ? `Clear set ${number}? It is already logged as ${from}.`
        : `Overwrite set ${number}? It is already logged as ${from} and will become a ${success ? 'hit' : 'miss'}.`
    if (confirmRewrite(message)) onMark(success)
  }

  const log = () => {
    // Re-logging the same rep count is not a change, so no confirmation.
    if (
      logged &&
      reps !== set.reps &&
      !window.confirm(
        `Overwrite set ${number}? It is logged at ${set.reps} reps and will become ${reps}.`,
      )
    ) {
      return
    }
    onLogAmrap(reps)
    setDraft(null)
  }

  if (set.amrap) {
    return (
      <li
        className={`set-row set-amrap ${locked ? 'is-locked' : ''} ${set.success === null ? '' : set.success ? 'is-ok' : 'is-miss'}`}
      >
        <div className="set-line">
          <span className="set-label">
            Set {number} <em>AMRAP</em>
          </span>
          <span className="set-target">{set.target}+ reps</span>
        </div>

        <div className="amrap-controls">
          <div className="stepper">
            <button
              type="button"
              onClick={() => bump(-1)}
              aria-label="Decrease reps"
              disabled={locked}
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={reps}
              aria-label={`AMRAP reps for set ${number}`}
              disabled={locked}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(/[^0-9]/g, ''))
                setDraft(Number.isFinite(parsed) ? Math.min(99, parsed) : 0)
              }}
            />
            <button
              type="button"
              onClick={() => bump(1)}
              aria-label="Increase reps"
              disabled={locked}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost log-btn"
            onClick={log}
            disabled={locked}
          >
            {logged ? 'Update' : 'Log'}
          </button>
        </div>

        {locked && <span className="set-lock">{lockHint}</span>}

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
    <li
      className={`set-row ${locked ? 'is-locked' : ''} ${set.success === null ? '' : set.success ? 'is-ok' : 'is-miss'}`}
    >
      <div className="set-line">
        <span className="set-label">Set {number}</span>
        <span className="set-target">{set.target} reps</span>
        {locked && <span className="set-lock">{lockHint}</span>}
      </div>
      <div className="set-actions">
        <button
          type="button"
          className={`mark ok ${set.success === true ? 'is-active' : ''}`}
          aria-label={`Set ${number} succeeded`}
          aria-pressed={set.success === true}
          disabled={locked}
          onClick={() => mark(set.success === true ? null : true)}
        >
          <CheckIcon />
        </button>
        <button
          type="button"
          className={`mark miss ${set.success === false ? 'is-active' : ''}`}
          aria-label={`Set ${number} failed`}
          aria-pressed={set.success === false}
          disabled={locked}
          onClick={() => mark(set.success === false ? null : false)}
        >
          <XIcon />
        </button>
      </div>
    </li>
  )
}
