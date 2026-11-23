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
    restByTier: { T1: { min: 180, max: 300 }, T2: { min: 120, max: 180 }, T3: { min: 60, max: 90 } },
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

  it('tracks warmup sets without affecting work-set progress', () => {
    let state = setup()
    expect(state.activeSession?.exercises[0].warmups.length).toBeGreaterThan(0)

    state = reducer(state, {
      type: 'recordWarmup',
      exerciseIndex: 0,
      warmupIndex: 0,
      completed: true,
    })

    expect(state.activeSession?.exercises[0].warmups[0].completed).toBe(true)
    expect(state.activeSession?.exercises[0].sets.every((set) => set.success === null)).toBe(true)
    expect(state.activeSession?.exerciseIndex).toBe(0)

    state = reducer(state, {
      type: 'recordWarmup',
      exerciseIndex: 0,
      warmupIndex: 0,
      completed: false,
    })
    expect(state.activeSession?.exercises[0].warmups[0].completed).toBe(false)
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

  it('ignores a set logged before the sets above it', () => {
    const state = setup()
    const next = reducer(state, { type: 'recordSet', exerciseIndex: 0, setIndex: 2, success: true })
    expect(next).toBe(state)

    const afterFirst = reducer(state, { type: 'recordSet', exerciseIndex: 0, setIndex: 0, success: true })
    const stillLocked = reducer(afterFirst, {
      type: 'recordAmrap',
      exerciseIndex: 0,
      reps: 5,
    })
    expect(stillLocked).toBe(afterFirst)
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

  it('starts a day the user picked instead of the next one in the rotation', () => {
    let state = onboarded()
    state = reducer(state, { type: 'selectDay', dayIndex: 3 })
    expect(state.nextDayIndex).toBe(3)

    state = reducer(state, { type: 'startSession' })
    expect(state.activeSession?.dayId).toBe('B2')
  })

  it('keeps the rotation moving from the picked day', () => {
    let state = onboarded()
    state = reducer(state, { type: 'selectDay', dayIndex: 3 })
    state = reducer(state, { type: 'startSession' })
    for (const index of [0, 1, 2]) state = logExercise(state, index, true)
    state = reducer(state, { type: 'finishSession' })

    expect(state.nextDayIndex).toBe(0)
  })

  it('ignores day picks that are out of range or mid-session', () => {
    let state = onboarded()
    expect(reducer(state, { type: 'selectDay', dayIndex: 4 })).toBe(state)
    expect(reducer(state, { type: 'selectDay', dayIndex: -1 })).toBe(state)
    expect(reducer(state, { type: 'selectDay', dayIndex: Number.NaN })).toBe(state)
    expect(reducer(state, { type: 'selectDay', dayIndex: 0 })).toBe(state)

    state = reducer(state, { type: 'selectDay', dayIndex: 2 })
    state = reducer(state, { type: 'startSession' })
    expect(reducer(state, { type: 'selectDay', dayIndex: 3 })).toBe(state)
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
    restByTier: { T1: { min: 180, max: 300 }, T2: { min: 120, max: 180 }, T3: { min: 60, max: 90 } },
    plates: state.settings.plates,
  })
}

function liftIdFor(state: AppData, name: string): string {
  const lift = Object.values(state.lifts).find((item) => item.name === name)
  if (!lift) throw new Error(`missing lift ${name}`)
  return lift.id
}

describe('reducer T3 accessories', () => {
  it('creates an accessory in the library with a track and no day yet', () => {
    let state = onboarded()
    state = reducer(state, { type: 'createT3', name: '  Leg   Press ', barbell: false })
    const id = liftIdFor(state, 'Leg Press')

    expect(state.lifts[id]).toMatchObject({ name: 'Leg Press', barbell: false })
    expect(state.t3Library).toEqual(['latpulldown', 'row', id])
    expect(state.t3ByDay.A1).toEqual(['latpulldown'])
    expect(state.tracks[`${id}:T3`]).toEqual({ weight: 45, stage: 0 })
  })

  it('adds a library accessory to a day and keeps that order in a session', () => {
    let state = onboarded()
    state = reducer(state, { type: 'createT3', name: 'Leg Press', barbell: false })
    const id = liftIdFor(state, 'Leg Press')
    state = reducer(state, { type: 'assignT3', dayId: 'A1', liftId: id })

    expect(state.t3ByDay.A1).toEqual(['latpulldown', id])

    state = reducer(state, { type: 'startSession' })
    expect(state.activeSession?.exercises.map((exercise) => exercise.liftId)).toEqual([
      'squat',
      'bench',
      'latpulldown',
      id,
    ])
  })

  it('ignores assigning an accessory that is not in the library or already there', () => {
    let state = onboarded()
    expect(reducer(state, { type: 'assignT3', dayId: 'A1', liftId: 'nope' })).toBe(state)
    expect(reducer(state, { type: 'assignT3', dayId: 'A1', liftId: 'latpulldown' })).toBe(state)

    state = reducer(state, { type: 'createT3', name: 'Leg Press', barbell: false })
    const id = liftIdFor(state, 'Leg Press')
    state = reducer(state, { type: 'assignT3', dayId: 'A1', liftId: id })
    expect(reducer(state, { type: 'assignT3', dayId: 'A1', liftId: id })).toBe(state)
  })

  it('shares one weight when the same accessory is used on two days', () => {
    let state = onboarded()
    state = reducer(state, { type: 'createT3', name: 'Leg Press', barbell: false })
    const id = liftIdFor(state, 'Leg Press')
    state = reducer(state, { type: 'assignT3', dayId: 'A1', liftId: id })
    state = reducer(state, { type: 'assignT3', dayId: 'A2', liftId: id })

    expect(state.t3ByDay.A2).toContain(id)
    expect(
      Object.values(state.lifts).filter((lift) => lift.name.toLowerCase() === 'leg press'),
    ).toHaveLength(1)

    state = reducer(state, { type: 'updateTrackWeight', key: `${id}:T3`, weight: 120 })
    state = reducer(state, { type: 'assignT3', dayId: 'B1', liftId: id })
    expect(state.tracks[`${id}:T3`]).toEqual({ weight: 120, stage: 0 })
  })

  it('removes an accessory from one day but keeps its lift and track', () => {
    let state = onboarded()
    state = reducer(state, { type: 'createT3', name: 'Leg Press', barbell: false })
    const id = liftIdFor(state, 'Leg Press')
    state = reducer(state, { type: 'assignT3', dayId: 'A1', liftId: id })
    state = reducer(state, { type: 'assignT3', dayId: 'A2', liftId: id })

    state = reducer(state, { type: 'unassignT3', dayId: 'A1', liftId: id })
    expect(state.t3ByDay.A1).not.toContain(id)
    expect(state.t3ByDay.A2).toContain(id)
    expect(state.t3Library).toContain(id)
    expect(state.lifts[id]).toBeDefined()
    expect(state.tracks[`${id}:T3`]).toBeDefined()
  })

  it('deletes a library accessory from every day but keeps its weight', () => {
    let state = onboarded()
    state = reducer(state, { type: 'updateTrackWeight', key: 'row:T3', weight: 105 })
    state = reducer(state, { type: 'deleteT3', liftId: 'row' })

    expect(state.t3Library).toEqual(['latpulldown'])
    expect(state.t3ByDay).toEqual({ A1: ['latpulldown'], B1: [], A2: ['latpulldown'], B2: [] })
    expect(state.tracks['row:T3']).toEqual({ weight: 105, stage: 0 })
    expect(reducer(state, { type: 'deleteT3', liftId: 'row' })).toBe(state)
  })

  it('reuses a built-in lift and its weight when re-added by name', () => {
    let state = onboarded()
    state = reducer(state, { type: 'deleteT3', liftId: 'latpulldown' })
    state = reducer(state, { type: 'createT3', name: 'lat pulldown', barbell: false })

    expect(state.t3Library).toContain('latpulldown')
    expect(state.lifts.latpulldown.barbell).toBe(false)
    expect(state.tracks['latpulldown:T3']).toEqual({ weight: 70, stage: 0 })
  })

  it('automatically prefixes barbell accessories with "Barbell"', () => {
    const before = onboarded()
    const added = reducer(before, { type: 'createT3', name: ' Curl ', barbell: true })
    const id = liftIdFor(added, 'Barbell Curl')

    expect(added.lifts[id].barbell).toBe(true)
    expect(added.t3Library).toContain(id)
  })

  it('does not add the Barbell prefix twice', () => {
    const before = onboarded()
    const added = reducer(before, {
      type: 'createT3',
      name: 'barbell curl',
      barbell: true,
    })
    const id = liftIdFor(added, 'barbell curl')

    expect(added.lifts[id].name).toBe('barbell curl')
  })

  it('reorders accessories within a day and keeps the new order in a session', () => {
    let state = onboarded()
    state = reducer(state, { type: 'createT3', name: 'Leg Press', barbell: false })
    state = reducer(state, { type: 'createT3', name: 'Curl', barbell: false })
    const legPress = liftIdFor(state, 'Leg Press')
    const curl = liftIdFor(state, 'Curl')
    state = reducer(state, { type: 'assignT3', dayId: 'A1', liftId: legPress })
    state = reducer(state, { type: 'assignT3', dayId: 'A1', liftId: curl })

    expect(state.t3ByDay.A1).toEqual(['latpulldown', legPress, curl])

    state = reducer(state, { type: 'moveT3', dayId: 'A1', liftId: curl, direction: -1 })
    expect(state.t3ByDay.A1).toEqual(['latpulldown', curl, legPress])

    // Reordering one day leaves the others alone.
    expect(state.t3ByDay.B1).toEqual(['row'])

    state = reducer(state, { type: 'startSession' })
    expect(state.activeSession?.exercises.map((exercise) => exercise.liftId)).toEqual([
      'squat',
      'bench',
      'latpulldown',
      curl,
      legPress,
    ])
  })

  it('ignores moves past either end of the list', () => {
    const state = onboarded()
    const last = state.t3ByDay.A1[state.t3ByDay.A1.length - 1]

    expect(reducer(state, { type: 'moveT3', dayId: 'A1', liftId: last, direction: 1 })).toBe(state)
    expect(
      reducer(state, { type: 'moveT3', dayId: 'A1', liftId: state.t3ByDay.A1[0], direction: -1 }),
    ).toBe(state)
    expect(reducer(state, { type: 'moveT3', dayId: 'A1', liftId: 'nope', direction: 1 })).toBe(
      state,
    )
  })

  it('lets T3 weights drop to 0 lb but keeps the floor on T1/T2', () => {
    let state = onboarded()
    state = reducer(state, { type: 'updateTrackWeight', key: 'latpulldown:T3', weight: 0 })
    expect(state.tracks['latpulldown:T3'].weight).toBe(0)

    state = reducer(state, { type: 'updateTrackWeight', key: 'squat:T1', weight: 0 })
    expect(state.tracks['squat:T1'].weight).toBe(5)
    state = reducer(state, { type: 'updateTrackWeight', key: 'bench:T2', weight: -10 })
    expect(state.tracks['bench:T2'].weight).toBe(5)
  })

  it('keeps a 0 lb T3 through setup and a finished session', () => {
    let state = onboarded()
    const weights = Object.fromEntries(
      Object.entries(state.tracks).map(([key, track]) => [key, track.weight]),
    ) as Record<TrackKey, number>
    weights['latpulldown:T3'] = 0

    state = reducer(state, {
      type: 'saveSetup',
      weights,
      restByTier: { T1: { min: 180, max: 300 }, T2: { min: 120, max: 180 }, T3: { min: 60, max: 90 } },
      plates: state.settings.plates,
    })
    expect(state.tracks['latpulldown:T3'].weight).toBe(0)

    state = reducer(state, { type: 'startSession' })
    for (const index of [0, 1, 2]) state = logExercise(state, index, true)
    state = reducer(state, { type: 'finishSession' })

    expect(state.tracks['latpulldown:T3'].weight).toBe(0)
    expect(state.sessions[0].exercises[2].weight).toBe(0)
  })

  it('ignores blank and duplicate creations', () => {
    const before = onboarded()
    expect(reducer(before, { type: 'createT3', name: '   ', barbell: false })).toBe(before)

    const added = reducer(before, { type: 'createT3', name: 'Leg Press', barbell: false })
    expect(reducer(added, { type: 'createT3', name: ' leg press ', barbell: false })).toBe(added)
  })
})

describe('reducer rest ranges', () => {
  it('clamps a range and keeps max at or above min when settings change', () => {
    let state = onboarded()
    state = reducer(state, {
      type: 'updateSettings',
      patch: {
        restByTier: {
          T1: { min: 5000, max: 60 },
          T2: { min: -10, max: 5000 },
          T3: { min: 90, max: 60 },
        },
      },
    })

    expect(state.settings.restByTier).toEqual({
      T1: { min: 900, max: 900 },
      T2: { min: 0, max: 900 },
      T3: { min: 90, max: 90 },
    })
  })
})
