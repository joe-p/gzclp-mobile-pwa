import { useEffect, useRef, useState } from 'react'
import { extendRest, restStatus, restWindow } from '../domain/rest'
import type { RestAddition, RestPhase } from '../domain/rest'
import { formatDuration } from '../domain/units'

interface RestTimerBarProps {
  startedAt: number
  min: number
  max: number
  haptics: boolean
  onDismiss: () => void
}

const PHASE_LABELS: Record<RestPhase, string> = {
  blocked: 'Resting',
  ready: 'Rest ready',
  max: 'Max rest',
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(pattern)
}

export function RestTimerBar({ startedAt, min, max, haptics, onDismiss }: RestTimerBarProps) {
  const [now, setNow] = useState(() => Date.now())
  const [added, setAdded] = useState<RestAddition>({ min: 0, max: 0 })
  const lastPhaseRef = useRef<RestPhase | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const range = restWindow(min, max, added)
  const elapsed = Math.max(0, (now - startedAt) / 1000)
  const status = restStatus(range.min, range.max, elapsed)
  const blocked = status.phase === 'blocked'
  const maxed = status.phase === 'max'
  const timeLabel = blocked
    ? formatDuration(status.toMin)
    : `+${formatDuration(status.overtime)}`
  const markerLeft = range.max > 0 ? Math.min(100, (range.min / range.max) * 100) : 100

  useEffect(() => {
    const previous = lastPhaseRef.current
    lastPhaseRef.current = status.phase
    if (!haptics || previous === null || previous === status.phase) return
    // A short buzz when rest is long enough, a triple buzz once it runs past max.
    if (status.phase === 'blocked') return
    vibrate(status.phase === 'max' ? [160, 80, 160] : 80)
  }, [status.phase, haptics])

  return (
    <div className={`rest-bar is-${status.phase}`} role="status" aria-live="polite">
      <div className="rest-fill" style={{ width: `${status.progress * 100}%` }} />
      {range.min < range.max && (
        <div className="rest-mark" style={{ left: `${markerLeft}%` }} aria-hidden="true" />
      )}
      <div className="rest-inner">
        <span className="rest-label">{PHASE_LABELS[status.phase]}</span>
        <span className="rest-time">{timeLabel}</span>
        <span className="rest-spacer" />
        {!maxed && (
          <button
            type="button"
            className="chip-btn"
            onClick={() => setAdded((current) => extendRest(current, status.phase))}
          >
            +30s
          </button>
        )}
        <button
          type="button"
          className="chip-btn"
          onClick={onDismiss}
          disabled={blocked}
          title={blocked ? `Skip unlocks in ${formatDuration(status.toMin)}` : undefined}
        >
          {blocked ? 'Skip' : 'Done'}
        </button>
      </div>
    </div>
  )
}
