import { describe, expect, it } from 'vitest'
import { applyProgression, exerciseSucceeded } from './progression'
import { epley1rm } from './onerm'
import { incrementFor, stageSpec, trackKey } from './program'
import type { ExerciseRecord, SetRecord, Tier } from './types'

function makeRecord(tier: Tier, weight: number, results: (boolean | null)[]): ExerciseRecord {
  const sets: SetRecord[] = results.map((success, index) => ({
    target: 3,
    reps: success === true ? 3 : null,
    success,
    amrap: index === results.length - 1,
  }))
  return { liftId: 'squat', tier, weight, stage: 0, sets, e1rm: null, outcome: null }
}

describe('exerciseSucceeded', () => {
  it('requires every set to be logged and successful', () => {
    expect(exerciseSucceeded(makeRecord('T1', 135, [true, true, true]))).toBe(true)
    expect(exerciseSucceeded(makeRecord('T1', 135, [true, false, true]))).toBe(false)
    expect(exerciseSucceeded(makeRecord('T1', 135, [true, null, true]))).toBe(false)
    expect(exerciseSucceeded(makeRecord('T1', 135, []))).toBe(false)
  })
})

describe('applyProgression', () => {
  it('adds 10 lb to lower-body T1 lifts after a clean session', () => {
    const outcome = applyProgression('squat', 'T1', { weight: 135, stage: 0 }, true)
    expect(outcome.action).toBe('increase')
    expect(outcome.weightAfter).toBe(145)
    expect(outcome.stageAfter).toBe(0)
  })

  it('adds 5 lb to upper-body T1 lifts', () => {
    const outcome = applyProgression('bench', 'T1', { weight: 95, stage: 0 }, true)
    expect(outcome.weightAfter).toBe(100)
  })

  it('demotes 5x3 to 6x2 at the same weight on a miss', () => {
    const outcome = applyProgression('squat', 'T1', { weight: 185, stage: 0 }, false)
    expect(outcome.action).toBe('demote')
    expect(outcome.weightAfter).toBe(185)
    expect(outcome.stageAfter).toBe(1)
    expect(outcome.setsAfter).toBe(6)
    expect(outcome.repsAfter).toBe(2)
  })

  it('demotes 6x2 to 10x1, then resets to 5x3 at 90%', () => {
    const stage1 = applyProgression('squat', 'T1', { weight: 185, stage: 1 }, false)
    expect(stage1.stageAfter).toBe(2)
    expect(stage1.setsAfter).toBe(10)

    const reset = applyProgression('squat', 'T1', { weight: 165, stage: 2 }, false)
    expect(reset.action).toBe('reset')
    expect(reset.stageAfter).toBe(0)
    expect(reset.weightAfter).toBe(150) // 165 * 0.9 = 148.5 -> 150
    expect(reset.setsAfter).toBe(5)
    expect(reset.repsAfter).toBe(3)
  })

  it('never resets below an empty bar', () => {
    const outcome = applyProgression('squat', 'T1', { weight: 45, stage: 2 }, false)
    expect(outcome.weightAfter).toBe(45)
  })

  it('adds weight but stays demoted after a successful 6x2', () => {
    const outcome = applyProgression('squat', 'T1', { weight: 185, stage: 1 }, true)
    expect(outcome.action).toBe('increase')
    expect(outcome.weightAfter).toBe(195)
    expect(outcome.stageAfter).toBe(1)
    expect(outcome.setsAfter).toBe(6)
  })

  it('uses T2 rep schemes', () => {
    const demote = applyProgression('bench', 'T2', { weight: 55, stage: 0 }, false)
    expect(demote.stageAfter).toBe(1)
    expect(demote.setsAfter).toBe(3)
    expect(demote.repsAfter).toBe(8)

    const reset = applyProgression('bench', 'T2', { weight: 115, stage: 2 }, false)
    expect(reset.stageAfter).toBe(0)
    expect(reset.weightAfter).toBe(105) // 115 * 0.9 = 103.5 -> 105
  })

  it('never auto-progresses T3 accessories', () => {
    const success = applyProgression('row', 'T3', { weight: 95, stage: 0 }, true)
    expect(success.action).toBe('none')
    expect(success.weightAfter).toBe(95)

    const missed = applyProgression('row', 'T3', { weight: 95, stage: 0 }, false)
    expect(missed.action).toBe('none')
    expect(missed.weightAfter).toBe(95)
  })
})

describe('program helpers', () => {
  it('builds track keys and schemes', () => {
    expect(trackKey('bench', 'T2')).toBe('bench:T2')
    expect(stageSpec('T1', 0)).toEqual({ sets: 5, reps: 3 })
    expect(stageSpec('T1', 99)).toEqual({ sets: 10, reps: 1 })
    expect(stageSpec('T2', -1)).toEqual({ sets: 3, reps: 10 })
    expect(stageSpec('T3', 0)).toEqual({ sets: 3, reps: 15 })
  })

  it('uses 10 lb increments only for lower-body T1/T2 lifts', () => {
    expect(incrementFor('squat', 'T1')).toBe(10)
    expect(incrementFor('bench', 'T2')).toBe(5)
    expect(incrementFor('row', 'T3')).toBe(0)
  })
})

describe('epley1rm', () => {
  it('estimates from an AMRAP set', () => {
    expect(epley1rm(135, 5)).toBe(158)
    expect(epley1rm(135, 1)).toBe(135)
    expect(epley1rm(135, 0)).toBeNull()
    expect(epley1rm(135, null)).toBeNull()
  })
})
