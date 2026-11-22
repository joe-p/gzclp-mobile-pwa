import type { LiftDefinition, LiftId, ProgramDay, Tier, TrackKey, TrackState } from './types'
import { roundToIncrement, sanitizeWeight } from './units'

export const LIFTS: Record<LiftId, LiftDefinition> = {
  squat: { id: 'squat', name: 'Squat', short: 'SQ', body: 'lower' },
  bench: { id: 'bench', name: 'Bench Press', short: 'BP', body: 'upper' },
  deadlift: { id: 'deadlift', name: 'Deadlift', short: 'DL', body: 'lower' },
  ohp: { id: 'ohp', name: 'Overhead Press', short: 'OHP', body: 'upper' },
  latpulldown: { id: 'latpulldown', name: 'Lat Pulldown', short: 'LPD', body: 'upper' },
  row: { id: 'row', name: 'Barbell Row', short: 'ROW', body: 'upper' },
}

/** Standard 4-day GZCLP rotation. */
export const PROGRAM_DAYS: readonly ProgramDay[] = [
  {
    id: 'A1',
    label: 'A1',
    focus: 'Squat day',
    slots: [
      { liftId: 'squat', tier: 'T1' },
      { liftId: 'bench', tier: 'T2' },
      { liftId: 'latpulldown', tier: 'T3' },
    ],
  },
  {
    id: 'B1',
    label: 'B1',
    focus: 'Press day',
    slots: [
      { liftId: 'ohp', tier: 'T1' },
      { liftId: 'deadlift', tier: 'T2' },
      { liftId: 'row', tier: 'T3' },
    ],
  },
  {
    id: 'A2',
    label: 'A2',
    focus: 'Bench day',
    slots: [
      { liftId: 'bench', tier: 'T1' },
      { liftId: 'squat', tier: 'T2' },
      { liftId: 'latpulldown', tier: 'T3' },
    ],
  },
  {
    id: 'B2',
    label: 'B2',
    focus: 'Deadlift day',
    slots: [
      { liftId: 'deadlift', tier: 'T1' },
      { liftId: 'ohp', tier: 'T2' },
      { liftId: 'row', tier: 'T3' },
    ],
  },
]

export function trackKey(liftId: LiftId, tier: Tier): TrackKey {
  return `${liftId}:${tier}`
}

export function liftName(liftId: LiftId): string {
  return LIFTS[liftId].name
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
  return LIFTS[liftId].body === 'lower' ? 10 : 5
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
  if (tier === 'T3') return T3_STARTING_WEIGHTS[liftId] ?? 65
  const base = T1_STARTING_WEIGHTS[liftId] ?? 95
  // T2 starts lighter: roughly 60% of the T1 working weight.
  return tier === 'T2' ? roundToIncrement(base * 0.6) : base
}

/** Unique track keys in program order (10 total: 4 T1, 4 T2, 2 T3). */
export const ALL_TRACK_KEYS: readonly TrackKey[] = PROGRAM_DAYS.reduce<TrackKey[]>((keys, day) => {
  for (const slot of day.slots) {
    const key = trackKey(slot.liftId, slot.tier)
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}, [])

export function defaultTracks(): Record<TrackKey, TrackState> {
  const tracks = {} as Record<TrackKey, TrackState>
  for (const day of PROGRAM_DAYS) {
    for (const slot of day.slots) {
      const key = trackKey(slot.liftId, slot.tier)
      if (tracks[key]) continue
      tracks[key] = { weight: sanitizeWeight(defaultWeightFor(slot.liftId, slot.tier)), stage: 0 }
    }
  }
  return tracks
}

const LIFT_ORDER: readonly LiftId[] = ['squat', 'bench', 'deadlift', 'ohp', 'latpulldown', 'row']

/** Program-style ordering (squat, bench, deadlift, press) rather than day order. */
export function slotsForTier(tier: Tier): readonly { liftId: LiftId; key: TrackKey }[] {
  return LIFT_ORDER.map((liftId) => ({ liftId, key: trackKey(liftId, tier) })).filter(({ key }) =>
    ALL_TRACK_KEYS.includes(key),
  )
}

export const REST_CHOICES: readonly number[] = [60, 120, 180, 300]
