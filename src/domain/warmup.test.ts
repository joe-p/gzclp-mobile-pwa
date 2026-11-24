import { describe, expect, it } from 'vitest'
import { warmupRecords, warmupSets } from './warmup'

describe('warmupSets', () => {
  it('scales warmups from the working weight by default', () => {
    // Percentages win the tie: 75 / 105 / 140 vs even jumps' 75 / 105 / 135.
    expect(warmupSets('squat', 'T1', 165, 45)).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 75, sets: 1, reps: 5 },
      { weight: 105, sets: 1, reps: 3 },
      { weight: 140, sets: 1, reps: 2 },
    ])

    // Bay Strength's 315 lb squat example: 140, 205, 270 after the empty bar.
    expect(warmupSets('squat', 'T1', 315, 45)).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 140, sets: 1, reps: 5 },
      { weight: 205, sets: 1, reps: 3 },
      { weight: 270, sets: 1, reps: 2 },
    ])
  })

  it('falls back to even jumps when percentages lose steps to the floor', () => {
    // 45% rounds to the empty bar, leaving only 60 and 80; even jumps fill the ramp.
    expect(warmupSets('squat', 'T1', 95, 45)).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 60, sets: 1, reps: 5 },
      { weight: 70, sets: 1, reps: 3 },
      { weight: 85, sets: 1, reps: 2 },
    ])
  })

  it('starts a deadlift ramp with a loaded bar at its 135 lb floor', () => {
    // 45% of 225 is below the floor, so even jumps give the fuller ramp.
    expect(warmupSets('deadlift', 'T1', 225, 45)).toEqual([
      { weight: 135, sets: 1, reps: 5 },
      { weight: 160, sets: 1, reps: 5 },
      { weight: 180, sets: 1, reps: 3 },
      { weight: 205, sets: 1, reps: 2 },
    ])
  })

  it('drops ramp weights at or below the bar, and duplicate rounded weights', () => {
    expect(warmupSets('bench', 'T2', 60, 45)).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 50, sets: 1, reps: 5 },
      { weight: 55, sets: 1, reps: 3 },
    ])

    // 47.5 and 50 both round to 50; 55 is the work weight.
    expect(warmupSets('bench', 'T2', 55, 45)).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 50, sets: 1, reps: 5 },
    ])
  })

  it('accepts sub-45 warmups for bench and OHP with dumbbells', () => {
    // 45/65/85% of the working weight, rounded to 5 lb, with no empty bar.
    expect(warmupSets('bench', 'T2', 40, 45)).toEqual([
      { weight: 20, sets: 1, reps: 5 },
      { weight: 25, sets: 1, reps: 3 },
      { weight: 35, sets: 1, reps: 2 },
    ])

    expect(warmupSets('ohp', 'T1', 25, 45)).toEqual([
      { weight: 10, sets: 1, reps: 5 },
      { weight: 15, sets: 1, reps: 3 },
      { weight: 20, sets: 1, reps: 2 },
    ])

    // An empty bar is still light enough to start with dumbbells.
    expect(warmupSets('bench', 'T2', 45, 45)).toEqual([
      { weight: 20, sets: 1, reps: 5 },
      { weight: 30, sets: 1, reps: 3 },
      { weight: 40, sets: 1, reps: 2 },
    ])
  })

  it('returns no warmup for T3 or when the work weight cannot clear the floor', () => {
    expect(warmupSets('latpulldown', 'T3', 100, 45)).toEqual([])
    expect(warmupSets('squat', 'T1', 45, 45)).toEqual([])
    expect(warmupSets('deadlift', 'T1', 135, 45)).toEqual([])
    expect(warmupSets('bench', 'T2', 5, 45)).toEqual([])
  })

  it('keeps the squat floor at 45 lb even on a lighter bar', () => {
    expect(warmupSets('squat', 'T2', 95, 35)).toEqual([
      { weight: 45, sets: 2, reps: 5 },
      { weight: 60, sets: 1, reps: 5 },
      { weight: 70, sets: 1, reps: 3 },
      { weight: 85, sets: 1, reps: 2 },
    ])
  })

  it('works with a non-standard bar weight', () => {
    expect(warmupSets('ohp', 'T1', 95, 35)).toEqual([
      { weight: 35, sets: 2, reps: 5 },
      { weight: 45, sets: 1, reps: 5 },
      { weight: 60, sets: 1, reps: 3 },
      { weight: 80, sets: 1, reps: 2 },
    ])
  })
})

describe('warmupRecords', () => {
  it('flattens grouped warmups into unchecked individual sets', () => {
    expect(warmupRecords('squat', 'T1', 165, 45)).toEqual([
      { weight: 45, reps: 5, completed: false },
      { weight: 45, reps: 5, completed: false },
      { weight: 75, reps: 5, completed: false },
      { weight: 105, reps: 3, completed: false },
      { weight: 140, reps: 2, completed: false },
    ])
  })
})
