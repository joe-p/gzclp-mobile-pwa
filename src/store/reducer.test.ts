import { describe, expect, it } from 'vitest'
import type { AppData, TrackKey } from '../domain/types'
import { createInitialData } from './defaults'
import { reducer } from './reducer'

function setup(): AppData {
  let state = createInitialData()
  const weights = Object.fromEntries(
    Object.entries(state.tracks).map(([key, track]) => [key, track.weight]),
  ) as Record<TrackKey, number>
  state = reducer(state, { type: 'saveSetup', weights, restSeconds: 120 })
  state = reducer(state, { type: 'startSession' })
  return state
}

function logExercise(state: AppData, index: number, success: boolean): AppData {
  const exercise = state.activeSession?.exercises[index]
  if (!exercise) throw new Error('exercise missing')

  exercise.sets.forEach((set, setIndex) => {
    if (set.amrap) {
      state = reducer(state, {
        type: 'recordAmrap',
        exerciseIndex: index,
        reps: success ? set.target + 2 : Math.max(0, set.target - 1),
      })
    } else {
      state = reducer(state, { type: 'recordSet', exerciseIndex: index, setIndex, success })
    }
  })
  return state
}

describe('reducer session lifecycle', () => {
  it('marks setup complete and starts day A1', () => {
    const state = setup()
    expect(state.settings.setupComplete).toBe(true)
    expect(state.activeSession?.dayId).toBe('A1')
    expect(state.activeSession?.exercises).toHaveLength(3)
  })

  it('adds weight on a clean session and advances the rotation', () => {
    let state = setup()
    for (const index of [0, 1, 2]) state = logExercise(state, index, true)
    state = reducer(state, { type: 'finishSession' })

    expect(state.activeSession).toBeNull()
    expect(state.sessions).toHaveLength(1)
    expect(state.nextDayIndex).toBe(1)
    expect(state.tracks['squat:T1']).toEqual({ weight: 145, stage: 0 })
    expect(state.tracks['bench:T2']).toEqual({ weight: 60, stage: 0 })
    expect(state.tracks['latpulldown:T3']).toEqual({ weight: 70, stage: 0 })
    expect(state.lastSummaryId).toBe(state.sessions[0].id)

    const squat = state.sessions[0].exercises[0]
    expect(squat.outcome?.action).toBe('increase')
    expect(squat.e1rm).toBe(158)
  })

  it('demotes a lift when any set is missed', () => {
    let state = setup()
    state = logExercise(state, 0, false)
    state = logExercise(state, 1, true)
    state = logExercise(state, 2, true)
    state = reducer(state, { type: 'finishSession' })

    expect(state.tracks['squat:T1']).toEqual({ weight: 135, stage: 1 })
    expect(state.sessions[0].exercises[0].outcome).toMatchObject({
      action: 'demote',
      weightAfter: 135,
      setsAfter: 6,
      repsAfter: 2,
    })
  })

  it('saves a partial session without changing unfinished lifts', () => {
    let state = setup()
    state = reducer(state, { type: 'recordSet', exerciseIndex: 0, setIndex: 0, success: true })
    state = reducer(state, { type: 'finishSession' })

    expect(state.sessions).toHaveLength(1)
    expect(state.tracks['squat:T1']).toEqual({ weight: 135, stage: 0 })
    expect(state.sessions[0].exercises[0].outcome).toBeNull()
    expect(state.sessions[0].exercises[0].sets[1].success).toBeNull()
  })

  it('refuses to finish a session with nothing logged', () => {
    const state = setup()
    expect(reducer(state, { type: 'finishSession' })).toBe(state)
  })

  it('discards the active session without logging it', () => {
    let state = setup()
    state = reducer(state, { type: 'recordSet', exerciseIndex: 0, setIndex: 0, success: true })
    state = reducer(state, { type: 'discardSession' })
    expect(state.activeSession).toBeNull()
    expect(state.sessions).toHaveLength(0)
    expect(state.nextDayIndex).toBe(0)
  })

  it('resets everything back to onboarding defaults', () => {
    let state = setup()
    for (const index of [0, 1, 2]) state = logExercise(state, index, true)
    state = reducer(state, { type: 'finishSession' })
    state = reducer(state, { type: 'resetData' })

    expect(state.settings.setupComplete).toBe(false)
    expect(state.sessions).toHaveLength(0)
    expect(state.tracks['squat:T1']).toEqual({ weight: 135, stage: 0 })
  })
})
