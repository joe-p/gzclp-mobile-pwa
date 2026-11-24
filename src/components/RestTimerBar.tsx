import { useEffect, useRef, useState } from 'react'
import { restStatus } from '../domain/rest'
import type { RestPhase } from '../domain/rest'
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
  const lastPhaseRef = useRef<RestPhase | null>(null)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, 250)
    // Backgrounded timers are throttled (or paused), so resync the moment the
    // app is visible again instead of waiting for the next tick.
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  const elapsed = Math.max(0, (now - startedAt) / 1000)
  const status = restStatus(min, max, elapsed)
  const blocked = status.phase === 'blocked'
  const maxed = status.phase === 'max'
  const timeLabel = blocked
    ? formatDuration(status.toMin)
    : `+${formatDuration(status.overtime)}`
  const markerLeft = max > 0 ? Math.min(100, (min / max) * 100) : 100

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
      {min < max && (
        <div className="rest-mark" style={{ left: `${markerLeft}%` }} aria-hidden="true" />
      )}
      <div className="rest-inner">
        <span className="rest-label">{PHASE_LABELS[status.phase]}</span>
        <span className="rest-time">{timeLabel}</span>
        {!maxed && (
          <span className="rest-max" title="Time left before max rest">
            max {formatDuration(status.toMax)}
          </span>
        )}
        <span className="rest-spacer" />
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
