export type LiftId = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'latpulldown' | 'row'

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

export type RestByTier = Record<Tier, number>

export interface Settings {
  restByTier: RestByTier
  setupComplete: boolean
  haptics: boolean
}

export interface AppData {
  version: number
  settings: Settings
  tracks: Record<TrackKey, TrackState>
  nextDayIndex: number
  sessions: SessionRecord[]
  activeSession: ActiveSession | null
  lastSummaryId: string | null
}
