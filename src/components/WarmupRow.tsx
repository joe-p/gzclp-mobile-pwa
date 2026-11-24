import type { WarmupRecord } from '../domain/types'
import { formatWeight } from '../domain/units'
import { CheckIcon } from './icons'

interface WarmupRowProps {
  index: number
  warmup: WarmupRecord
  onToggle: (warmupIndex: number, completed: boolean) => void
}

/** A warmup set, rendered in the same row shape as a work set. */
export function WarmupRow({ index, warmup, onToggle }: WarmupRowProps) {
  const number = index + 1

  return (
    <li className={`set-row set-warmup ${warmup.completed ? 'is-ok' : ''}`}>
      <div className="set-line">
        <span className="set-label">Warmup {number}</span>
        <span className="set-target">
          {formatWeight(warmup.weight)} lb × {warmup.reps} reps
        </span>
      </div>
      <div className="set-actions">
        <button
          type="button"
          className={`mark ok warmup-mark ${warmup.completed ? 'is-active' : ''}`}
          aria-label={`${warmup.completed ? 'Unmark' : 'Mark'} warmup ${number}: ${formatWeight(warmup.weight)} lb for ${warmup.reps} reps`}
          aria-pressed={warmup.completed}
          onClick={() => onToggle(index, !warmup.completed)}
        >
          <CheckIcon />
        </button>
      </div>
    </li>
  )
}
