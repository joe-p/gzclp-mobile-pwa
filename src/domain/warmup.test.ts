import { describe, expect, it } from 'vitest'
import { warmupRecords, warmupSets } from './warmup'

describe('warmupSets', () => {
  it('uses even jumps from the empty bar to the work weight', () => {
    // Bay Strength's 165 lb squat example: 45, 75, 105, 135.
    expect(warmupSets('squat', 'T1', 165, 45, 'even')).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 75, sets: 1, reps: 5 },
      { weight: 105, sets: 1, reps: 3 },
      { weight: 135, sets: 1, reps: 2 },
    ])
  })

  it('uses 45%, 65% and 85% of the work weight for the percentage method', () => {
    // Bay Strength's 315 lb squat example: 140, 205, 270 after the empty bar.
    expect(warmupSets('squat', 'T1', 315, 45, 'percent')).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 140, sets: 1, reps: 5 },
      { weight: 205, sets: 1, reps: 3 },
      { weight: 270, sets: 1, reps: 2 },
    ])
  })

  it('skips the empty-bar sets on deadlift', () => {
    expect(warmupSets('deadlift', 'T1', 225, 45, 'even')).toEqual([
      { weight: 90, sets: 1, reps: 5 },
      { weight: 135, sets: 1, reps: 3 },
      { weight: 180, sets: 1, reps: 2 },
    ])
  })

  it('drops ramp weights at or below the bar, and duplicate rounded weights', () => {
    expect(warmupSets('bench', 'T2', 60, 45, 'percent')).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 50, sets: 1, reps: 5 },
    ])

    // 47.5 and 50 both round to 50; 55 is the work weight.
    expect(warmupSets('bench', 'T2', 55, 45, 'even')).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 50, sets: 1, reps: 5 },
    ])
  })

  it('returns no warmup for T3 or when the work weight is the bar or lighter', () => {
    expect(warmupSets('latpulldown', 'T3', 100, 45, 'even')).toEqual([])
    expect(warmupSets('bench', 'T2', 45, 45, 'even')).toEqual([])
    expect(warmupSets('bench', 'T2', 25, 45, 'percent')).toEqual([])
  })

  it('works with a non-standard bar weight', () => {
    expect(warmupSets('ohp', 'T1', 95, 35, 'even')).toEqual([
      { weight: 35, sets: 2, reps: 5 },
      { weight: 50, sets: 1, reps: 5 },
      { weight: 65, sets: 1, reps: 3 },
      { weight: 80, sets: 1, reps: 2 },
    ])
  })
})

describe('warmupRecords', () => {
  it('flattens grouped warmups into unchecked individual sets', () => {
    expect(warmupRecords('squat', 'T1', 165, 45, 'even')).toEqual([
      { weight: 45, reps: 5, completed: false },
      { weight: 45, reps: 5, completed: false },
      { weight: 75, reps: 5, completed: false },
      { weight: 105, reps: 3, completed: false },
      { weight: 135, reps: 2, completed: false },
    ])
  })
})
