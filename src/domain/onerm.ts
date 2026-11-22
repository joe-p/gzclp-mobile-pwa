/**
 * Epley estimate. AMRAP sets are the only place we apply this, and the
 * estimate is rounded to the nearest pound.
 */
export function epley1rm(weight: number, reps: number | null | undefined): number | null {
  if (reps == null || !Number.isFinite(reps) || reps <= 0) return null
  if (!Number.isFinite(weight) || weight <= 0) return null
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}
