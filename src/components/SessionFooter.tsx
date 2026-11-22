import { isSessionComplete, sessionProgress } from '../domain/session'
import { useApp } from '../store/context'

export function SessionFooter() {
  const { data, dispatch } = useApp()
  const session = data.activeSession
  if (!session) return null

  const { logged, total } = sessionProgress(session)
  const complete = isSessionComplete(session)
  const remaining = total - logged

  const finish = () => {
    if (!complete) {
      const plural = remaining === 1 ? 'set' : 'sets'
      const confirmed = window.confirm(
        `${remaining} ${plural} not logged. Finish anyway? Unfinished lifts keep their current weight.`,
      )
      if (!confirmed) return
    }
    dispatch({ type: 'finishSession' })
  }

  return (
    <div className="session-footer">
      <div className="session-footer-info">
        <span className="session-footer-label">
          {complete
            ? 'All sets logged'
            : logged === 0
              ? 'Log a set to finish'
              : `${remaining} set${remaining === 1 ? '' : 's'} left`}
        </span>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={logged}
          aria-label="Sets logged"
        >
          <div
            className="progress-fill"
            style={{ width: `${total > 0 ? (logged / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <button type="button" className="btn btn-primary" disabled={logged === 0} onClick={finish}>
        {complete ? 'Finish' : 'Finish early'}
      </button>
    </div>
  )
}
