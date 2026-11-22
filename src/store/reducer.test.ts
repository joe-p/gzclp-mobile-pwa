import { describe, expect, it } from 'vitest'
import type { AppData, TrackKey } from '../domain/types'
import { createInitialData } from './defaults'
import { reducer } from './reducer'

function setup(): AppData {
  let state = createInitialData()
  const weights = Object.fromEntries(
    Object.entries(state.tracks).map(([key, track]) => [key, track.weight]),
  ) as Record<TrackKey, number>
  state = reducer(state, {
    type: 'saveSetup',
    weights,
    restByTier: { T1: 180, T2: 120, T3: 60 },
    plates: state.settings.plates,
  })
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

  it('keeps a lift open until its final set, then expands the next lift', () => {
    let state = setup()
    const first = state.activeSession?.exercises[0]
    if (!first) throw new Error('exercise missing')

    first.sets.slice(0, -1).forEach((_, setIndex) => {
      state = reducer(state, { type: 'recordSet', exerciseIndex: 0, setIndex, success: true })
      expect(state.activeSession?.exerciseIndex).toBe(0)
    })

    state = reducer(state, { type: 'recordAmrap', exerciseIndex: 0, reps: first.sets[first.sets.length - 1].target })
    expect(state.activeSession?.exerciseIndex).toBe(1)
  })

  it('expands the next lift when the AMRAP is the only thing left', () => {
    let state = setup()
    const first = state.activeSession?.exercises[0]
    if (!first) throw new Error('exercise missing')
    const lastIndex = first.sets.length - 1

    first.sets.slice(0, lastIndex).forEach((_, setIndex) => {
      state = reducer(state, { type: 'recordSet', exerciseIndex: 0, setIndex, success: true })
    })
    expect(state.activeSession?.exerciseIndex).toBe(0)

    state = reducer(state, { type: 'recordAmrap', exerciseIndex: 0, reps: first.sets[lastIndex].target + 1 })
    expect(state.activeSession?.exerciseIndex).toBe(1)
  })

  it('collapses every lift once the whole session is logged', () => {
    let state = setup()
    for (const index of [0, 1, 2]) state = logExercise(state, index, true)
    expect(state.activeSession?.exerciseIndex).toBe(-1)
  })

  it('stays put when updating an already-finished lift', () => {
    let state = setup()
    state = logExercise(state, 0, true)
    expect(state.activeSession?.exerciseIndex).toBe(1)

    state = reducer(state, { type: 'showExercise', index: 0 })
    state = reducer(state, { type: 'recordAmrap', exerciseIndex: 0, reps: 2 })
    expect(state.activeSession?.exerciseIndex).toBe(0)
  })

  it('skips lifts that are already logged and wraps when needed', () => {
    let state = setup()
    state = logExercise(state, 1, true)
    expect(state.activeSession?.exerciseIndex).toBe(2)

    state = reducer(state, { type: 'showExercise', index: 0 })
    state = logExercise(state, 0, true)
    expect(state.activeSession?.exerciseIndex).toBe(2)
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

function onboarded(): AppData {
  const state = createInitialData()
  const weights = Object.fromEntries(
    Object.entries(state.tracks).map(([key, track]) => [key, track.weight]),
  ) as Record<TrackKey, number>
  return reducer(state, {
    type: 'saveSetup',
    weights,
    restByTier: { T1: 180, T2: 120, T3: 60 },
    plates: state.settings.plates,
  })
}

function liftIdFor(state: AppData, name: string): string {
  const lift = Object.values(state.lifts).find((item) => item.name === name)
  if (!lift) throw new Error(`missing lift ${name}`)
  return lift.id
}

describe('reducer T3 accessories', () => {
  it('adds a custom accessory with a track and a slot in the next session', () => {
    let state = onboarded()
    state = reducer(state, { type: 'addT3', dayId: 'A1', name: '  Leg   Press ', barbell: false })
    const id = liftIdFor(state, 'Leg Press')

    expect(state.lifts[id]).toMatchObject({ name: 'Leg Press', barbell: false })
    expect(state.t3ByDay.A1).toEqual(['latpulldown', id])
    expect(state.tracks[`${id}:T3`]).toEqual({ weight: 45, stage: 0 })

    state = reducer(state, { type: 'startSession' })
    expect(state.activeSession?.exercises.map((exercise) => exercise.liftId)).toEqual([
      'squat',
      'bench',
      'latpulldown',
      id,
    ])
  })

  it('shares one progression when the same accessory is added to two days', () => {
    let state = onboarded()
    state = reducer(state, { type: 'addT3', dayId: 'A1', name: 'Leg Press', barbell: false })
    const id = liftIdFor(state, 'Leg Press')
    state = reducer(state, { type: 'addT3', dayId: 'A2', name: 'leg press', barbell: false })

    expect(state.t3ByDay.A2).toContain(id)
    expect(
      Object.values(state.lifts).filter((lift) => lift.name.toLowerCase() === 'leg press'),
    ).toHaveLength(1)

    state = reducer(state, { type: 'updateTrackWeight', key: `${id}:T3`, weight: 120 })
    state = reducer(state, { type: 'addT3', dayId: 'B1', name: 'Leg Press', barbell: false })
    expect(state.tracks[`${id}:T3`]).toEqual({ weight: 120, stage: 0 })
  })

  it('removes an accessory from one day but keeps its lift and track', () => {
    let state = onboarded()
    state = reducer(state, { type: 'addT3', dayId: 'A1', name: 'Leg Press', barbell: false })
    const id = liftIdFor(state, 'Leg Press')
    state = reducer(state, { type: 'addT3', dayId: 'A2', name: 'Leg Press', barbell: false })

    state = reducer(state, { type: 'removeT3', dayId: 'A1', liftId: id })
    expect(state.t3ByDay.A1).not.toContain(id)
    expect(state.t3ByDay.A2).toContain(id)
    expect(state.lifts[id]).toBeDefined()
    expect(state.tracks[`${id}:T3`]).toBeDefined()
  })

  it('reuses a built-in lift and its weight when re-added by name', () => {
    let state = onboarded()
    state = reducer(state, { type: 'removeT3', dayId: 'A1', liftId: 'latpulldown' })
    state = reducer(state, { type: 'addT3', dayId: 'A1', name: 'lat pulldown', barbell: false })

    expect(state.t3ByDay.A1).toEqual(['latpulldown'])
    expect(state.lifts.latpulldown.barbell).toBe(false)
    expect(state.tracks['latpulldown:T3']).toEqual({ weight: 70, stage: 0 })
  })

  it('automatically prefixes barbell accessories with "Barbell"', () => {
    const before = onboarded()
    const added = reducer(before, { type: 'addT3', dayId: 'A1', name: ' Curl ', barbell: true })
    const id = liftIdFor(added, 'Barbell Curl')

    expect(added.lifts[id].barbell).toBe(true)
    expect(added.t3ByDay.A1).toContain(id)
  })

  it('does not add the Barbell prefix twice', () => {
    const before = onboarded()
    const added = reducer(before, {
      type: 'addT3',
      dayId: 'A1',
      name: 'barbell curl',
      barbell: true,
    })
    const id = liftIdFor(added, 'barbell curl')

    expect(added.lifts[id].name).toBe('barbell curl')
  })

  it('ignores blank and duplicate additions', () => {
    const before = onboarded()
    expect(reducer(before, { type: 'addT3', dayId: 'A1', name: '   ', barbell: false })).toBe(before)

    const added = reducer(before, { type: 'addT3', dayId: 'A1', name: 'Leg Press', barbell: false })
    expect(reducer(added, { type: 'addT3', dayId: 'A1', name: ' leg press ', barbell: false })).toBe(
      added,
    )
  })
})
