export type BuiltInLiftId = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'latpulldown' | 'row'

/** Built-in lifts use fixed ids; user-created T3 accessories get opaque custom ids. */
export type LiftId = string

export type Tier = 'T1' | 'T2' | 'T3'

export type DayId = 'A1' | 'B1' | 'A2' | 'B2'

export type BodyArea = 'upper' | 'lower'

/** A lift and tier are tracked separately, e.g. T1 bench and T2 bench are distinct. */
export type TrackKey = `${LiftId}:${Tier}`

export interface LiftDefinition {
  readonly id: LiftId
  readonly name: string
  readonly short: string
  readonly body: BodyArea
  /** Loaded on a barbell, so plate math applies. */
  readonly barbell: boolean
}

export interface ProgramSlot {
  readonly liftId: LiftId
  readonly tier: Tier
}

export interface ProgramDay {
  readonly id: DayId
  readonly label: string
  readonly focus: string
  readonly slots: readonly ProgramSlot[]
}

export interface TrackState {
  weight: number
  stage: number
}

export interface SetRecord {
  target: number
  /** Reps performed. For AMRAP sets this is the recorded count, otherwise null when missed. */
  reps: number | null
  success: boolean | null
  amrap: boolean
}

export type ProgressionAction = 'increase' | 'demote' | 'reset' | 'none'

export interface ProgressionOutcome {
  success: boolean
  action: ProgressionAction
  weightBefore: number
  weightAfter: number
  stageBefore: number
  stageAfter: number
  setsBefore: number
  repsBefore: number
  setsAfter: number
  repsAfter: number
}

export interface ExerciseRecord {
  liftId: LiftId
  tier: Tier
  weight: number
  stage: number
  sets: SetRecord[]
  /** Estimated 1RM from the AMRAP set (T1/T2 only). */
  e1rm: number | null
  outcome: ProgressionOutcome | null
}

export interface SessionRecord {
  id: string
  dayId: DayId
  startedAt: string
  finishedAt: string | null
  exercises: ExerciseRecord[]
}

export interface ActiveSession extends SessionRecord {
  /** Index of the expanded exercise, -1 when all are collapsed. */
  exerciseIndex: number
}

export interface RestRange {
  /** Rest cannot be ended before this many seconds. */
  min: number
  /** Once this many seconds pass, warn that the rest is running long. */
  max: number
}

export type RestByTier = Record<Tier, RestRange>

/** A plate size and how many *pairs* of it the user owns. */
export interface PlateStack {
  size: number
  pairs: number
}

export interface PlateInventory {
  /** Bar weight in pounds. */
  bar: number
  plates: PlateStack[]
}

export interface Settings {
  restByTier: RestByTier
  plates: PlateInventory
  setupComplete: boolean
  haptics: boolean
}

export type T3ByDay = Record<DayId, LiftId[]>

export interface AppData {
  version: number
  settings: Settings
  /** Built-in lifts plus user-created T3 accessories. */
  lifts: Record<LiftId, LiftDefinition>
  /** Every T3 accessory the user has configured, in display order. */
  t3Library: LiftId[]
  /** T3 accessory lift ids picked per day, in display order. T1/T2 slots are fixed. */
  t3ByDay: T3ByDay
  tracks: Record<TrackKey, TrackState>
  nextDayIndex: number
  sessions: SessionRecord[]
  activeSession: ActiveSession | null
  lastSummaryId: string | null
}
