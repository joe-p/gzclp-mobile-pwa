import { describe, expect, it } from 'vitest'
import { defaultTracks, PROGRAM_DAYS } from './program'
import {
  createSession,
  isSessionComplete,
  recordAmrapResult,
  recordSetResult,
  recordWarmupResult,
  sessionProgress,
} from './session'

describe('createSession', () => {
  it('builds the standard 5x3 / 3x10 / 3x15 day with AMRAP last sets', () => {
    const session = createSession(PROGRAM_DAYS[0], defaultTracks(), {
      now: new Date('2026-01-02T10:00:00Z'),
    })

    expect(session.dayId).toBe('A1')
    expect(session.exercises.map((e) => `${e.liftId}:${e.tier}`)).toEqual([
      'squat:T1',
      'bench:T2',
      'latpulldown:T3',
    ])
    expect(session.exercises[0].sets).toHaveLength(5)
    expect(session.exercises[0].sets[4].amrap).toBe(true)
    expect(session.exercises[0].sets[4].target).toBe(3)
    expect(session.exercises[1].sets).toHaveLength(3)
    expect(session.exercises[2].sets[2].target).toBe(15)
    expect(session.exerciseIndex).toBe(0)
    expect(isSessionComplete(session)).toBe(false)
  })

  it('snapshots a warmup ramp for T1/T2 and none for T3', () => {
    const session = createSession(PROGRAM_DAYS[0], defaultTracks(), {
      bar: 45,
      warmupMethod: 'even',
    })

    expect(session.exercises[0].warmups).toEqual([
      { weight: 45, reps: 5, completed: false },
      { weight: 45, reps: 5, completed: false },
      { weight: 70, reps: 5, completed: false },
      { weight: 90, reps: 3, completed: false },
      { weight: 115, reps: 2, completed: false },
    ])
    expect(session.exercises[2].warmups).toEqual([])
  })
})

describe('set recording', () => {
  const base = () => createSession(PROGRAM_DAYS[0], defaultTracks())

  it('marks a normal set and clears it again', () => {
    const marked = recordSetResult(base(), 0, 0, true)
    expect(marked.exercises[0].sets[0]).toMatchObject({ success: true, reps: 3 })

    const cleared = recordSetResult(marked, 0, 0, null)
    expect(cleared.exercises[0].sets[0]).toMatchObject({ success: null, reps: null })
  })

  it('records a miss without inventing reps', () => {
    const missed = recordSetResult(base(), 0, 1, false)
    expect(missed.exercises[0].sets[1]).toMatchObject({ success: false, reps: null })
  })

  it('ignores set results on the AMRAP set', () => {
    const session = base()
    const unchanged = recordSetResult(session, 0, 4, true)
    expect(unchanged).toBe(session)
  })

  it('derives AMRAP success and e1RM from reps', () => {
    const hit = recordAmrapResult(base(), 0, 5)
    const amrap = hit.exercises[0].sets[4]
    expect(amrap).toMatchObject({ success: true, reps: 5 })
    expect(hit.exercises[0].e1rm).toBe(158)

    const missed = recordAmrapResult(base(), 0, 2)
    expect(missed.exercises[0].sets[4].success).toBe(false)
    expect(missed.exercises[0].e1rm).toBe(144)
  })

  it('does not compute e1RM for T3 accessories', () => {
    const session = recordAmrapResult(base(), 2, 18)
    expect(session.exercises[2].e1rm).toBeNull()
  })

  it('checks and unchecks a warmup without touching work sets', () => {
    const original = base()
    const marked = recordWarmupResult(original, 0, 0, true)
    expect(marked.exercises[0].warmups[0].completed).toBe(true)
    expect(marked.exercises[0].sets).toEqual(original.exercises[0].sets)

    const cleared = recordWarmupResult(marked, 0, 0, false)
    expect(cleared.exercises[0].warmups[0].completed).toBe(false)

    expect(recordWarmupResult(original, 0, 99, true)).toBe(original)
    expect(recordWarmupResult(original, 0, 0, false)).toBe(original)
  })
})

describe('completion', () => {
  it('counts logged sets and completes only when every set is logged', () => {
    let session = createSession(PROGRAM_DAYS[0], defaultTracks())
    for (const exerciseIndex of [0, 1, 2]) {
      for (let setIndex = 0; setIndex < session.exercises[exerciseIndex].sets.length; setIndex++) {
        const isLast = setIndex === session.exercises[exerciseIndex].sets.length - 1
        session = isLast
          ? recordAmrapResult(session, exerciseIndex, session.exercises[exerciseIndex].sets[setIndex].target)
          : recordSetResult(session, exerciseIndex, setIndex, true)
      }
    }
    expect(sessionProgress(session)).toEqual({ logged: 11, total: 11 })
    expect(isSessionComplete(session)).toBe(true)
  })
})
