import { describe, expect, it } from 'vitest'
import { defaultTracks, PROGRAM_DAYS } from './program'
import {
  createSession,
  finishesWarmupRamp,
  isSessionComplete,
  isSetLocked,
  nextOpenSet,
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
    const session = createSession(PROGRAM_DAYS[0], defaultTracks(), { bar: 45 })

    expect(session.exercises[0].warmups).toEqual([
      { weight: 45, reps: 5, completed: false },
      { weight: 60, reps: 5, completed: false },
      { weight: 90, reps: 3, completed: false },
      { weight: 115, reps: 2, completed: false },
    ])
    expect(session.exercises[2].warmups).toEqual([])
  })
})

describe('set recording', () => {
  const base = () => createSession(PROGRAM_DAYS[0], defaultTracks())

  /** Logs the straight sets ahead of the AMRAP so the last set is unlocked. */
  const readyForAmrap = (exerciseIndex = 0) => {
    let session = base()
    for (let setIndex = 0; setIndex < session.exercises[exerciseIndex].sets.length - 1; setIndex++) {
      session = recordSetResult(session, exerciseIndex, setIndex, true)
    }
    return session
  }

  it('marks a normal set and clears it again', () => {
    const marked = recordSetResult(base(), 0, 0, true)
    expect(marked.exercises[0].sets[0]).toMatchObject({ success: true, reps: 3 })

    const cleared = recordSetResult(marked, 0, 0, null)
    expect(cleared.exercises[0].sets[0]).toMatchObject({ success: null, reps: null })
  })

  it('records a miss without inventing reps', () => {
    const missed = recordSetResult(recordSetResult(base(), 0, 0, true), 0, 1, false)
    expect(missed.exercises[0].sets[1]).toMatchObject({ success: false, reps: null })
  })

  it('ignores set results on the AMRAP set', () => {
    const session = base()
    const unchanged = recordSetResult(session, 0, 4, true)
    expect(unchanged).toBe(session)
  })

  it('derives AMRAP success and e1RM from reps', () => {
    const hit = recordAmrapResult(readyForAmrap(), 0, 5)
    const amrap = hit.exercises[0].sets[4]
    expect(amrap).toMatchObject({ success: true, reps: 5 })
    expect(hit.exercises[0].e1rm).toBe(158)

    const missed = recordAmrapResult(readyForAmrap(), 0, 2)
    expect(missed.exercises[0].sets[4].success).toBe(false)
    expect(missed.exercises[0].e1rm).toBe(144)
  })

  it('does not compute e1RM for T3 accessories', () => {
    const session = recordAmrapResult(readyForAmrap(2), 2, 18)
    expect(session.exercises[2].e1rm).toBeNull()
  })

  it('locks every set after the first one without a result', () => {
    const session = base()
    expect(isSetLocked(session.exercises[0].sets, 0)).toBe(false)
    expect(isSetLocked(session.exercises[0].sets, 1)).toBe(true)
    expect(isSetLocked(session.exercises[0].sets, 4)).toBe(true)

    const afterFirst = recordSetResult(session, 0, 0, true)
    expect(isSetLocked(afterFirst.exercises[0].sets, 1)).toBe(false)
    expect(isSetLocked(afterFirst.exercises[0].sets, 2)).toBe(true)
  })

  it('points at the next set to log, crossing into the following lift', () => {
    const session = base()
    expect(nextOpenSet(session)).toEqual({ exerciseIndex: 0, setIndex: 0 })

    const afterFirst = recordSetResult(session, 0, 0, true)
    expect(nextOpenSet(afterFirst)).toEqual({ exerciseIndex: 0, setIndex: 1 })

    let done = afterFirst
    for (let setIndex = 1; setIndex < 4; setIndex += 1) {
      done = recordSetResult(done, 0, setIndex, true)
    }
    expect(nextOpenSet(done)).toEqual({ exerciseIndex: 0, setIndex: 4 })

    const afterAmrap = recordAmrapResult(done, 0, 5)
    expect(nextOpenSet(afterAmrap)).toEqual({ exerciseIndex: 1, setIndex: 0 })
  })

  it('has no next set once everything is logged', () => {
    let session = base()
    for (let exerciseIndex = 0; exerciseIndex < session.exercises.length; exerciseIndex += 1) {
      const setCount = session.exercises[exerciseIndex].sets.length
      for (let setIndex = 0; setIndex < setCount - 1; setIndex += 1) {
        session = recordSetResult(session, exerciseIndex, setIndex, true)
      }
      session = recordAmrapResult(session, exerciseIndex, 20)
    }
    expect(nextOpenSet(session)).toBeNull()
  })

  it('refuses a result while the set before it is still open', () => {
    const session = base()
    expect(recordSetResult(session, 0, 1, true)).toBe(session)
    expect(recordSetResult(session, 0, 3, false)).toBe(session)
    expect(recordAmrapResult(session, 0, 8)).toBe(session)
  })

  it('keeps logged sets editable so a past result can be corrected', () => {
    const session = recordSetResult(base(), 0, 0, true)
    expect(isSetLocked(session.exercises[0].sets, 0)).toBe(false)

    const corrected = recordSetResult(session, 0, 0, false)
    expect(corrected.exercises[0].sets[0]).toMatchObject({ success: false, reps: null })
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

describe('finishesWarmupRamp', () => {
  const warmups = [
    { weight: 45, reps: 5, completed: true },
    { weight: 70, reps: 5, completed: true },
    { weight: 115, reps: 2, completed: false },
  ]

  it('is true only for the warmup that leaves the ramp complete', () => {
    expect(finishesWarmupRamp(warmups, 2)).toBe(true)
    expect(finishesWarmupRamp(warmups, 1)).toBe(false)
  })

  it('handles out-of-order check-offs and empty ramps', () => {
    const outOfOrder = [
      { weight: 45, reps: 5, completed: true },
      { weight: 70, reps: 5, completed: false },
      { weight: 115, reps: 2, completed: true },
    ]
    expect(finishesWarmupRamp(outOfOrder, 1)).toBe(true)
    expect(finishesWarmupRamp([], 0)).toBe(false)
    expect(finishesWarmupRamp(warmups, 99)).toBe(false)
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
