import { useState } from 'react'
import { describeOutcome } from '../domain/progression'
import { programDays, resolveLift, schemeLabel, stageSpec } from '../domain/program'
import type { SessionRecord } from '../domain/types'
import { formatDate, formatTime, formatWeight } from '../domain/units'
import { useApp } from '../store/context'
import { ChevronIcon } from './icons'

export function HistoryScreen() {
  const { data } = useApp()
  const [openId, setOpenId] = useState<string | null>(null)

  if (data.sessions.length === 0) {
    return (
      <div className="stack">
        <h1 className="screen-title">History</h1>
        <section className="card empty">
          <p className="empty-title">No workouts yet</p>
          <p className="muted small">
            Finish your first session and it will land here with AMRAP reps, estimated 1RMs, and the
            weight you earned for next time.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="stack">
      <h1 className="screen-title">History</h1>
      <p className="muted small">
        {data.sessions.length} session{data.sessions.length === 1 ? '' : 's'} logged
      </p>
      <ul className="history-list">
        {data.sessions.map((session) => (
          <HistoryItem
            key={session.id}
            session={session}
            open={openId === session.id}
            onToggle={() => setOpenId(openId === session.id ? null : session.id)}
          />
        ))}
      </ul>
    </div>
  )
}

function HistoryItem({
  session,
  open,
  onToggle,
}: {
  session: SessionRecord
  open: boolean
  onToggle: () => void
}) {
  const { data } = useApp()
  const days = programDays(data.t3ByDay)
  const day = days.find((item) => item.id === session.dayId) ?? days[0]
  const successes = session.exercises.filter((exercise) => exercise.outcome?.success).length

  return (
    <li className={`history-item ${open ? 'is-open' : ''}`}>
      <button type="button" className="history-head" onClick={onToggle} aria-expanded={open}>
        <span className="history-day">{day.label}</span>
        <span className="history-main">
          <span className="history-focus">{day.focus}</span>
          <span className="muted tiny">
            {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
          </span>
        </span>
        <span className={`history-score ${successes === session.exercises.length ? 'is-all' : ''}`}>
          {successes}/{session.exercises.length}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="history-body">
          {session.exercises.map((exercise) => {
            const lift = resolveLift(data.lifts, exercise.liftId)
            const spec = stageSpec(exercise.tier, exercise.stage)
            const description = exercise.outcome ? describeOutcome(exercise.outcome) : null
            const warmupsDone = exercise.warmups.filter((warmup) => warmup.completed).length
            return (
              <div key={`${exercise.liftId}:${exercise.tier}`} className="history-ex">
                <div className="history-ex-head">
                  <span className={`tier-dot tier-${exercise.tier.toLowerCase()}`}>{exercise.tier}</span>
                  <span className="history-ex-name">{lift.name}</span>
                  <span className="muted small">
                    {schemeLabel(spec.sets, spec.reps)} · {formatWeight(exercise.weight)} lb
                  </span>
                </div>
                <div className="set-chips">
                  {exercise.sets.map((set, index) => (
                    <span
                      key={index}
                      className={`set-chip ${
                        set.amrap
                          ? 'amrap'
                          : set.success === true
                            ? 'ok'
                            : set.success === false
                              ? 'miss'
                              : ''
                      }`}
                      title={
                        set.amrap
                          ? `AMRAP: ${set.reps ?? 'not logged'} reps`
                          : set.success === true
                            ? 'Completed'
                            : set.success === false
                              ? 'Missed'
                              : 'Not logged'
                      }
                    >
                      {set.amrap
                        ? `AMRAP ${set.reps ?? '–'}`
                        : set.success === true
                          ? '✓'
                          : set.success === false
                            ? '✗'
                            : '–'}
                    </span>
                  ))}
                </div>
                {exercise.warmups.length > 0 && (
                  <div className="history-warmups">
                    <span className="muted tiny">Warmups</span>
                    <div className="set-chips">
                      {exercise.warmups.map((warmup, index) => (
                        <span
                          key={index}
                          className={`set-chip warmup-chip ${warmup.completed ? 'ok' : ''}`}
                          title={`${formatWeight(warmup.weight)} lb × ${warmup.reps} — ${
                            warmup.completed ? 'completed' : 'not logged'
                          }`}
                        >
                          {formatWeight(warmup.weight)}
                        </span>
                      ))}
                    </div>
                    <span className="muted tiny">
                      {warmupsDone}/{exercise.warmups.length}
                    </span>
                  </div>
                )}
                {(description !== null || exercise.e1rm !== null) && (
                  <div className="history-ex-foot">
                    {description && (
                      <span className={`tone-${description.tone}`}>
                        {description.title} <span className="muted">· {description.detail}</span>
                      </span>
                    )}
                    {exercise.e1rm !== null && (
                      <span className="muted tiny">e1RM {exercise.e1rm} lb</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <p className="muted tiny">
            Started {formatTime(session.startedAt)}
            {session.finishedAt ? ` · finished ${formatTime(session.finishedAt)}` : ''}
          </p>
        </div>
      )}
    </li>
  )
}
