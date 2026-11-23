import type { ProgramDay } from './types'

export interface UpcomingWorkout {
  day: ProgramDay
  /** Position of the day in the rotation. */
  index: number
  /** Distance from the next workout, starting at 0. */
  offset: number
}

/**
 * The next `count` workouts in the rotation, wrapping around at the end. The
 * `nextDayIndex` is clamped defensively because it comes from stored data.
 */
export function upcomingWorkouts(
  days: readonly ProgramDay[],
  nextDayIndex: number,
  count: number,
): UpcomingWorkout[] {
  if (days.length === 0 || count <= 0) return []

  const raw = Number.isFinite(nextDayIndex) ? Math.trunc(nextDayIndex) : 0
  const start = ((raw % days.length) + days.length) % days.length

  return Array.from({ length: count }, (_, offset) => {
    const index = (start + offset) % days.length
    return { day: days[index], index, offset }
  })
}
