import { PROGRAM_DAYS } from '../domain/program'
import { useApp } from '../store/context'

export function TopBar() {
  const { data } = useApp()
  const active = data.activeSession
  const next = PROGRAM_DAYS[data.nextDayIndex] ?? PROGRAM_DAYS[0]

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          GZ
        </span>
        <span className="brand-text">
          <strong>GZCLP</strong>
          <small>Linear progression</small>
        </span>
      </div>
      <span className={`pill ${active ? 'pill-live' : ''}`}>
        <span className="pill-dot" aria-hidden="true" />
        {active ? `Day ${active.dayId}` : `Next ${next.label}`}
      </span>
    </header>
  )
}
