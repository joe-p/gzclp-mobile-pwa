import type {
  BuiltInLiftId,
  DayId,
  LiftDefinition,
  LiftId,
  ProgramDay,
  T3ByDay,
  Tier,
  TrackKey,
  TrackState,
} from './types'
import { minWeightForTier, roundToIncrement, sanitizeWeight } from './units'

export const LIFTS: Record<BuiltInLiftId, LiftDefinition> = {
  squat: { id: 'squat', name: 'Squat', short: 'SQ', body: 'lower', barbell: true },
  bench: { id: 'bench', name: 'Bench Press', short: 'BP', body: 'upper', barbell: true },
  deadlift: { id: 'deadlift', name: 'Deadlift', short: 'DL', body: 'lower', barbell: true },
  ohp: { id: 'ohp', name: 'Overhead Press', short: 'OHP', body: 'upper', barbell: true },
  latpulldown: { id: 'latpulldown', name: 'Lat Pulldown', short: 'LPD', body: 'upper', barbell: false },
  row: { id: 'row', name: 'Barbell Row', short: 'ROW', body: 'upper', barbell: true },
}

export const PROGRAM_DAY_IDS: readonly DayId[] = ['A1', 'B1', 'A2', 'B2']

interface DayMeta {
  readonly id: DayId
  readonly label: string
  readonly focus: string
  readonly t1: BuiltInLiftId
  readonly t2: BuiltInLiftId
}

/** T1/T2 are fixed by GZCLP; only the T3 accessories are user-configurable. */
const DAY_META: readonly DayMeta[] = [
  { id: 'A1', label: 'A1', focus: 'Squat day', t1: 'squat', t2: 'bench' },
  { id: 'B1', label: 'B1', focus: 'Press day', t1: 'ohp', t2: 'deadlift' },
  { id: 'A2', label: 'A2', focus: 'Bench day', t1: 'bench', t2: 'squat' },
  { id: 'B2', label: 'B2', focus: 'Deadlift day', t1: 'deadlift', t2: 'ohp' },
]

/** The stock GZCLP rotation: one accessory per day, shared across the A/B pair. */
export const DEFAULT_T3_BY_DAY: T3ByDay = {
  A1: ['latpulldown'],
  B1: ['row'],
  A2: ['latpulldown'],
  B2: ['row'],
}

export function cloneT3ByDay(source: T3ByDay = DEFAULT_T3_BY_DAY): T3ByDay {
  return {
    A1: [...source.A1],
    B1: [...source.B1],
    A2: [...source.A2],
    B2: [...source.B2],
  }
}

/** Unique accessory ids across every day, in rotation order. */
export function t3IdsInDays(t3ByDay: T3ByDay): LiftId[] {
  const ids: LiftId[] = []
  for (const dayId of PROGRAM_DAY_IDS) {
    for (const liftId of t3ByDay[dayId] ?? []) {
      if (!ids.includes(liftId)) ids.push(liftId)
    }
  }
  return ids
}

/** Accessories the user can pick from, independent of which days use them. */
export const DEFAULT_T3_LIBRARY: readonly LiftId[] = t3IdsInDays(DEFAULT_T3_BY_DAY)

export function cloneT3Library(source: readonly LiftId[] = DEFAULT_T3_LIBRARY): LiftId[] {
  return [...source]
}

/** Builds the full program, keeping fixed T1/T2 slots and appending each day's T3 list. */
export function programDays(t3ByDay: T3ByDay = DEFAULT_T3_BY_DAY): ProgramDay[] {
  return DAY_META.map((day) => ({
    id: day.id,
    label: day.label,
    focus: day.focus,
    slots: [
      { liftId: day.t1, tier: 'T1' },
      { liftId: day.t2, tier: 'T2' },
      ...(t3ByDay[day.id] ?? []).map((liftId) => ({ liftId, tier: 'T3' as const })),
    ],
  }))
}

/** Standard 4-day GZCLP rotation with the default accessories. */
export const PROGRAM_DAYS: readonly ProgramDay[] = programDays()

export function trackKey(liftId: LiftId, tier: Tier): TrackKey {
  return `${liftId}:${tier}`
}

/** Tier encoded in a track key, e.g. `bench:T1` -> T1. */
export function tierForTrackKey(key: TrackKey): Tier {
  return key.slice(key.lastIndexOf(':') + 1) as Tier
}

/** Cleans a user-typed exercise name before it is stored or matched. */
export function normalizeLiftName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 50)
}

/** Names for barbell-loaded accessories must start with the word "Barbell". */
export function startsWithBarbell(name: string): boolean {
  return /^barbell\b/i.test(normalizeLiftName(name))
}

/** Adds the Barbell prefix once, so users can type just the exercise name. */
export function barbellLiftName(name: string): string {
  const normalized = normalizeLiftName(name)
  if (normalized.length === 0 || startsWithBarbell(normalized)) return normalized
  return normalizeLiftName(`Barbell ${normalized}`)
}

/** Short label used in compact contexts. */
export function shortForName(name: string): string {
  const words = normalizeLiftName(name).split(' ').filter(Boolean)
  if (words.length === 0) return 'EX'
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words
    .map((word) => word[0])
    .join('')
    .slice(0, 4)
    .toUpperCase()
}

/** Opaque id for a user-created lift. Colons are reserved for track keys. */
export function newCustomLiftId(): LiftId {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Looks up a lift, falling back to a readable placeholder for stale session data. */
export function resolveLift(
  lifts: Record<LiftId, LiftDefinition>,
  liftId: LiftId,
): LiftDefinition {
  return (
    (Object.hasOwn(lifts, liftId) ? lifts[liftId] : undefined) ?? {
      id: liftId,
      name: liftId,
      short: shortForName(liftId),
      body: 'upper',
      barbell: false,
    }
  )
}

export function liftName(lifts: Record<LiftId, LiftDefinition>, liftId: LiftId): string {
  return resolveLift(lifts, liftId).name
}

export interface StageSpec {
  readonly sets: number
  readonly reps: number
}

export const T1_STAGES: readonly StageSpec[] = [
  { sets: 5, reps: 3 },
  { sets: 6, reps: 2 },
  { sets: 10, reps: 1 },
]

export const T2_STAGES: readonly StageSpec[] = [
  { sets: 3, reps: 10 },
  { sets: 3, reps: 8 },
  { sets: 3, reps: 6 },
]

export const T3_STAGES: readonly StageSpec[] = [{ sets: 3, reps: 15 }]

export function stagesForTier(tier: Tier): readonly StageSpec[] {
  switch (tier) {
    case 'T1':
      return T1_STAGES
    case 'T2':
      return T2_STAGES
    default:
      return T3_STAGES
  }
}

export function stageSpec(tier: Tier, stage: number): StageSpec {
  const stages = stagesForTier(tier)
  const index = Math.min(Math.max(Math.trunc(stage), 0), stages.length - 1)
  return stages[index]
}

export function schemeLabel(sets: number, reps: number, amrap = true): string {
  return `${sets}×${reps}${amrap ? '+' : ''}`
}

/** T1/T2 add 10 lb on lower-body lifts and 5 lb on upper-body lifts. T3 has no auto-progression. */
export function incrementFor(liftId: LiftId, tier: Tier): number {
  if (tier === 'T3') return 0
  return LIFTS[liftId as BuiltInLiftId]?.body === 'lower' ? 10 : 5
}

const T1_STARTING_WEIGHTS: Partial<Record<LiftId, number>> = {
  squat: 135,
  bench: 95,
  deadlift: 155,
  ohp: 65,
}

const T3_STARTING_WEIGHTS: Partial<Record<LiftId, number>> = {
  latpulldown: 70,
  row: 65,
}

export function defaultWeightFor(liftId: LiftId, tier: Tier): number {
  if (tier === 'T3') return T3_STARTING_WEIGHTS[liftId] ?? 45
  const base = T1_STARTING_WEIGHTS[liftId] ?? 95
  // T2 starts lighter: roughly 60% of the T1 working weight.
  return tier === 'T2' ? roundToIncrement(base * 0.6) : base
}

/** Unique track keys in program order. */
export function allTrackKeys(
  t3ByDay: T3ByDay = DEFAULT_T3_BY_DAY,
  t3Library: readonly LiftId[] = t3IdsInDays(t3ByDay),
): TrackKey[] {
  const keys: TrackKey[] = []
  for (const day of programDays(t3ByDay)) {
    for (const slot of day.slots) {
      const key = trackKey(slot.liftId, slot.tier)
      if (!keys.includes(key)) keys.push(key)
    }
  }
  for (const liftId of t3Library) {
    const key = trackKey(liftId, 'T3')
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

/** The day that programs a lift at a tier, e.g. squat at T2 -> A2. */
export function dayForSlot(
  days: readonly ProgramDay[],
  liftId: LiftId,
  tier: Tier,
): ProgramDay | undefined {
  return days.find((day) => day.slots.some((slot) => slot.liftId === liftId && slot.tier === tier))
}

/** Default track state for one lift and tier. */
export function defaultTrack(liftId: LiftId, tier: Tier): TrackState {
  return {
    weight: sanitizeWeight(defaultWeightFor(liftId, tier), minWeightForTier(tier)),
    stage: 0,
  }
}

/**
 * Tracks for the whole program plus every library accessory, so a T3 keeps its
 * weight even while no day is using it.
 */
export function defaultTracks(
  t3ByDay: T3ByDay = DEFAULT_T3_BY_DAY,
  t3Library: readonly LiftId[] = t3IdsInDays(t3ByDay),
): Record<TrackKey, TrackState> {
  const tracks = {} as Record<TrackKey, TrackState>
  for (const day of programDays(t3ByDay)) {
    for (const slot of day.slots) {
      const key = trackKey(slot.liftId, slot.tier)
      if (tracks[key]) continue
      tracks[key] = defaultTrack(slot.liftId, slot.tier)
    }
  }
  for (const liftId of t3Library) {
    const key = trackKey(liftId, 'T3')
    if (tracks[key]) continue
    tracks[key] = defaultTrack(liftId, 'T3')
  }
  return tracks
}

/** Program-style ordering for fixed lifts (squat, bench, deadlift, press). */
const LIFT_ORDER: readonly BuiltInLiftId[] = [
  'squat',
  'bench',
  'deadlift',
  'ohp',
  'latpulldown',
  'row',
]

/** Unique lifts in a tier, ordered for setup rather than day order. */
export function slotsForTier(
  tier: Tier,
  t3ByDay: T3ByDay = DEFAULT_T3_BY_DAY,
): readonly { liftId: LiftId; key: TrackKey }[] {
  const slots: { liftId: LiftId; key: TrackKey }[] = []
  const seen = new Set<TrackKey>()

  for (const day of programDays(t3ByDay)) {
    for (const slot of day.slots) {
      if (slot.tier !== tier) continue
      const key = trackKey(slot.liftId, slot.tier)
      if (seen.has(key)) continue
      seen.add(key)
      slots.push({ liftId: slot.liftId, key })
    }
  }

  if (tier === 'T3') return slots

  return slots.sort((a, b) => {
    const aIndex = LIFT_ORDER.indexOf(a.liftId as BuiltInLiftId)
    const bIndex = LIFT_ORDER.indexOf(b.liftId as BuiltInLiftId)
    return (aIndex === -1 ? LIFT_ORDER.length : aIndex) - (bIndex === -1 ? LIFT_ORDER.length : bIndex)
  })
}

export const TIERS: readonly Tier[] = ['T1', 'T2', 'T3']
