import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../domain/units'

interface RestTimerBarProps {
  endsAt: number
  total: number
  haptics: boolean
  onDismiss: () => void
}

export function RestTimerBar({ endsAt, total, haptics, onDismiss }: RestTimerBarProps) {
  const [now, setNow] = useState(() => Date.now())
  const [added, setAdded] = useState(0)
  const firedRef = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const remaining = Math.max(0, (endsAt + added * 1000 - now) / 1000)
  const done = remaining <= 0
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 1

  useEffect(() => {
    if (!done) {
      firedRef.current = false
      return
    }
    if (firedRef.current) return
    firedRef.current = true
    if (haptics && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([160, 80, 160])
    }
  }, [done, haptics])

  return (
    <div className={`rest-bar ${done ? 'is-done' : ''}`} role="status" aria-live="polite">
      <div className="rest-fill" style={{ width: `${progress * 100}%` }} />
      <div className="rest-inner">
        <span className="rest-label">{done ? 'Rest complete' : 'Resting'}</span>
        <span className="rest-time">{done ? 'Go' : formatDuration(remaining)}</span>
        <span className="rest-spacer" />
        {!done && (
          <button type="button" className="chip-btn" onClick={() => setAdded((value) => value + 30)}>
            +30s
          </button>
        )}
        <button type="button" className="chip-btn" onClick={onDismiss}>
          {done ? 'Done' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
