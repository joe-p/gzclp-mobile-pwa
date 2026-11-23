import { describe, expect, it } from 'vitest'
import { upcomingWorkouts } from './overview'
import { PROGRAM_DAYS } from './program'

describe('upcomingWorkouts', () => {
  it('returns the next four workouts starting at the next day', () => {
    const workouts = upcomingWorkouts(PROGRAM_DAYS, 0, 4)
    expect(workouts.map((workout) => workout.day.id)).toEqual(['A1', 'B1', 'A2', 'B2'])
    expect(workouts.map((workout) => workout.offset)).toEqual([0, 1, 2, 3])
  })

  it('wraps around the end of the rotation', () => {
    const workouts = upcomingWorkouts(PROGRAM_DAYS, 2, 4)
    expect(workouts.map((workout) => workout.day.id)).toEqual(['A2', 'B2', 'A1', 'B1'])
    expect(workouts.map((workout) => workout.index)).toEqual([2, 3, 0, 1])
  })

  it('normalizes negative and out-of-range indices', () => {
    expect(upcomingWorkouts(PROGRAM_DAYS, -1, 1)[0].day.id).toBe('B2')
    expect(upcomingWorkouts(PROGRAM_DAYS, 9, 1)[0].day.id).toBe('B1')
    expect(upcomingWorkouts(PROGRAM_DAYS, Number.NaN, 1)[0].day.id).toBe('A1')
  })

  it('returns an empty list when there is nothing to show', () => {
    expect(upcomingWorkouts(PROGRAM_DAYS, 0, 0)).toEqual([])
    expect(upcomingWorkouts([], 0, 4)).toEqual([])
  })
})
