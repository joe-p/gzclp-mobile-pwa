import { PROGRAM_DAYS, trackKey } from '../domain/program'
import { applyProgression, exerciseSucceeded } from '../domain/progression'
import { createSession, isExerciseComplete, recordAmrapResult, recordSetResult, sessionProgress } from '../domain/session'
import type {
  ActiveSession,
  AppData,
  ExerciseRecord,
  SessionRecord,
  Settings,
  TrackKey,
} from '../domain/types'
import { sanitizeWeight } from '../domain/units'
import { createInitialData } from './defaults'

export type Action =
  | { type: 'saveSetup'; weights: Record<TrackKey, number>; restSeconds: number }
  | { type: 'startSession' }
  | { type: 'discardSession' }
  | { type: 'showExercise'; index: number }
  | { type: 'recordSet'; exerciseIndex: number; setIndex: number; success: boolean | null }
  | { type: 'recordAmrap'; exerciseIndex: number; reps: number }
  | { type: 'finishSession' }
  | { type: 'dismissSummary' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'updateTrackWeight'; key: TrackKey; weight: number }
  | { type: 'importData'; data: AppData }
  | { type: 'resetData' }

/**
 * Applies a set result and, when that finishes the lift, collapses it and expands
 * the next unfinished lift (wrapping to the top, or collapsing all when done).
 */
function recordAndAdvance(
  state: AppData,
  exerciseIndex: number,
  record: (session: ActiveSession) => ActiveSession,
): AppData {
  const session = state.activeSession
  const current = session?.exercises[exerciseIndex]
  if (!session || !current) return state

  const wasComplete = isExerciseComplete(current)
  const next = record(session)
  if (next === session) return state
  if (wasComplete || !isExerciseComplete(next.exercises[exerciseIndex])) {
    return { ...state, activeSession: next }
  }

  return { ...state, activeSession: { ...next, exerciseIndex: nextIncompleteLift(next, exerciseIndex) } }
}

function nextIncompleteLift(session: ActiveSession, completedIndex: number): number {
  for (let step = 1; step <= session.exercises.length; step++) {
    const index = (completedIndex + step) % session.exercises.length
    if (!isExerciseComplete(session.exercises[index])) return index
  }
  return -1
}

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'saveSetup': {
      const tracks = { ...state.tracks }
      for (const key of Object.keys(tracks) as TrackKey[]) {
        const weight = action.weights[key]
        if (typeof weight === 'number' && Number.isFinite(weight)) {
          tracks[key] = { ...tracks[key], weight: sanitizeWeight(weight) }
        }
      }
      return {
        ...state,
        tracks,
        settings: {
          ...state.settings,
          setupComplete: true,
          restSeconds: Math.min(900, Math.max(0, Math.trunc(action.restSeconds))),
        },
      }
    }

    case 'startSession': {
      if (state.activeSession) return state
      const day = PROGRAM_DAYS[state.nextDayIndex] ?? PROGRAM_DAYS[0]
      return {
        ...state,
        activeSession: createSession(day, state.tracks),
        lastSummaryId: null,
      }
    }

    case 'discardSession':
      return { ...state, activeSession: null }

    case 'showExercise': {
      const session = state.activeSession
      if (!session) return state
      const index = Math.min(Math.max(action.index, -1), session.exercises.length - 1)
      return { ...state, activeSession: { ...session, exerciseIndex: index } }
    }

    case 'recordSet':
      return recordAndAdvance(state, action.exerciseIndex, (session) =>
        recordSetResult(session, action.exerciseIndex, action.setIndex, action.success),
      )

    case 'recordAmrap':
      return recordAndAdvance(state, action.exerciseIndex, (session) =>
        recordAmrapResult(session, action.exerciseIndex, action.reps),
      )

    case 'finishSession': {
      const session = state.activeSession
      if (!session || sessionProgress(session).logged === 0) return state

      const tracks = { ...state.tracks }
      const exercises: ExerciseRecord[] = session.exercises.map((exercise) => {
        // Unfinished lifts keep their current weight instead of counting as a failure.
        if (!isExerciseComplete(exercise)) return { ...exercise, outcome: null }
        const key = trackKey(exercise.liftId, exercise.tier)
        const outcome = applyProgression(
          exercise.liftId,
          exercise.tier,
          tracks[key],
          exerciseSucceeded(exercise),
        )
        tracks[key] = { weight: outcome.weightAfter, stage: outcome.stageAfter }
        return { ...exercise, outcome }
      })

      const finished: SessionRecord = {
        id: session.id,
        dayId: session.dayId,
        startedAt: session.startedAt,
        finishedAt: new Date().toISOString(),
        exercises,
      }

      return {
        ...state,
        tracks,
        sessions: [finished, ...state.sessions].slice(0, 500),
        activeSession: null,
        lastSummaryId: finished.id,
        nextDayIndex: (state.nextDayIndex + 1) % PROGRAM_DAYS.length,
      }
    }

    case 'dismissSummary':
      return { ...state, lastSummaryId: null }

    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'updateTrackWeight': {
      const track = state.tracks[action.key]
      if (!track) return state
      return {
        ...state,
        tracks: { ...state.tracks, [action.key]: { ...track, weight: sanitizeWeight(action.weight) } },
      }
    }

    case 'importData':
      return action.data

    case 'resetData':
      return createInitialData()

    default:
      return state
  }
}
