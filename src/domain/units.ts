export const WEIGHT_STEP = 5

export const MIN_WEIGHT = 5

/** Everything is stored in pounds; the smallest plate jump we support is 5 lb. */
export function roundToIncrement(value: number, increment: number = WEIGHT_STEP): number {
  return Math.round(value / increment) * increment
}

export function sanitizeWeight(value: number, min: number = MIN_WEIGHT): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, roundToIncrement(value))
}

export function formatWeight(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return dateFormatter.format(date)
}

export function formatTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return timeFormatter.format(date)
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
