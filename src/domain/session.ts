import { stageSpec, trackKey } from './program'
import { epley1rm } from './onerm'
import { warmupRecords } from './warmup'
import type {
  ActiveSession,
  ExerciseRecord,
  ProgramDay,
  SessionRecord,
  SetRecord,
  TrackKey,
  TrackState,
  WarmupMethod,
} from './types'

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export interface SessionOptions {
  now?: Date
  /** Bar weight and warmup method are snapshotted into the session. */
  bar?: number
  warmupMethod?: WarmupMethod
}

export function createSession(
  day: ProgramDay,
  tracks: Record<TrackKey, TrackState>,
  options: SessionOptions = {},
): ActiveSession {
  const now = options.now ?? new Date()
  const bar = options.bar ?? 45
  const warmupMethod = options.warmupMethod ?? 'even'

  const exercises: ExerciseRecord[] = day.slots.map((slot) => {
    const track = tracks[trackKey(slot.liftId, slot.tier)]
    const spec = stageSpec(slot.tier, track.stage)
    const sets: SetRecord[] = Array.from({ length: spec.sets }, (_, index) => ({
      target: spec.reps,
      reps: null,
      success: null,
      amrap: index === spec.sets - 1,
    }))
    return {
      liftId: slot.liftId,
      tier: slot.tier,
      weight: track.weight,
      stage: track.stage,
      warmups: warmupRecords(slot.liftId, slot.tier, track.weight, bar, warmupMethod),
      sets,
      e1rm: null,
      outcome: null,
    }
  })

  return {
    id: newId(),
    dayId: day.id,
    startedAt: now.toISOString(),
    finishedAt: null,
    exerciseIndex: 0,
    exercises,
  }
}

export function isExerciseComplete(exercise: ExerciseRecord): boolean {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.success !== null)
}

export function isSessionComplete(session: SessionRecord): boolean {
  return session.exercises.length > 0 && session.exercises.every(isExerciseComplete)
}

export function sessionProgress(session: SessionRecord): { logged: number; total: number } {
  let logged = 0
  let total = 0
  for (const exercise of session.exercises) {
    total += exercise.sets.length
    logged += exercise.sets.filter((set) => set.success !== null).length
  }
  return { logged, total }
}

export function recordSetResult(
  session: ActiveSession,
  exerciseIndex: number,
  setIndex: number,
  success: boolean | null,
): ActiveSession {
  const exercise = session.exercises[exerciseIndex]
  const target = exercise?.sets[setIndex]
  if (!exercise || !target || target.amrap) return session

  const sets = exercise.sets.map((set, index) =>
    index === setIndex ? { ...set, success, reps: success === true ? set.target : null } : set,
  )
  return replaceExercise(session, exerciseIndex, { ...exercise, sets })
}

export function recordWarmupResult(
  session: ActiveSession,
  exerciseIndex: number,
  warmupIndex: number,
  completed: boolean,
): ActiveSession {
  const exercise = session.exercises[exerciseIndex]
  const warmup = exercise?.warmups[warmupIndex]
  if (!exercise || !warmup || warmup.completed === completed) return session

  const warmups = exercise.warmups.map((item, index) =>
    index === warmupIndex ? { ...item, completed } : item,
  )
  return replaceExercise(session, exerciseIndex, { ...exercise, warmups })
}

export function recordAmrapResult(
  session: ActiveSession,
  exerciseIndex: number,
  reps: number,
): ActiveSession {
  const exercise = session.exercises[exerciseIndex]
  if (!exercise) return session
  const lastIndex = exercise.sets.length - 1
  const last = exercise.sets[lastIndex]
  if (!last?.amrap) return session

  const count = Math.max(0, Math.round(reps))
  const success = count >= last.target
  const sets = exercise.sets.map((set, index) =>
    index === lastIndex ? { ...set, reps: count, success } : set,
  )
  const e1rm = exercise.tier === 'T3' ? null : epley1rm(exercise.weight, count)
  return replaceExercise(session, exerciseIndex, { ...exercise, sets, e1rm })
}

function replaceExercise(
  session: ActiveSession,
  exerciseIndex: number,
  exercise: ExerciseRecord,
): ActiveSession {
  return {
    ...session,
    exercises: session.exercises.map((item, index) => (index === exerciseIndex ? exercise : item)),
  }
}
