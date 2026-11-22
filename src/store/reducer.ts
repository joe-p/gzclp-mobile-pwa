import { normalizePlateInventory } from '../domain/plates'
import {
  defaultWeightFor,
  newCustomLiftId,
  normalizeLiftName,
  PROGRAM_DAY_IDS,
  programDays,
  shortForName,
  TIERS,
  trackKey,
} from '../domain/program'
import { applyProgression, exerciseSucceeded } from '../domain/progression'
import { createSession, isExerciseComplete, recordAmrapResult, recordSetResult, sessionProgress } from '../domain/session'
import type {
  ActiveSession,
  AppData,
  DayId,
  ExerciseRecord,
  LiftDefinition,
  LiftId,
  PlateInventory,
  RestByTier,
  SessionRecord,
  Settings,
  TrackKey,
} from '../domain/types'
import { sanitizeWeight } from '../domain/units'
import { clampRestSeconds, createInitialData } from './defaults'

export type Action =
  | {
      type: 'saveSetup'
      weights: Record<TrackKey, number>
      restByTier: RestByTier
      plates: PlateInventory
    }
  | { type: 'startSession' }
  | { type: 'discardSession' }
  | { type: 'showExercise'; index: number }
  | { type: 'recordSet'; exerciseIndex: number; setIndex: number; success: boolean | null }
  | { type: 'recordAmrap'; exerciseIndex: number; reps: number }
  | { type: 'finishSession' }
  | { type: 'dismissSummary' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'updateTrackWeight'; key: TrackKey; weight: number }
  | { type: 'addT3'; dayId: DayId; name: string; barbell: boolean }
  | { type: 'removeT3'; dayId: DayId; liftId: LiftId }
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

function normalizeRestByTier(restByTier: RestByTier): RestByTier {
  const normalized = {} as RestByTier
  for (const tier of TIERS) {
    normalized[tier] = clampRestSeconds(restByTier[tier])
  }
  return normalized
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
          restByTier: normalizeRestByTier(action.restByTier),
          plates: normalizePlateInventory(action.plates),
        },
      }
    }

    case 'startSession': {
      if (state.activeSession) return state
      const days = programDays(state.t3ByDay)
      const day = days[state.nextDayIndex] ?? days[0]
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
        nextDayIndex: (state.nextDayIndex + 1) % PROGRAM_DAY_IDS.length,
      }
    }

    case 'dismissSummary':
      return { ...state, lastSummaryId: null }

    case 'updateSettings': {
      const settings = { ...state.settings, ...action.patch }
      return {
        ...state,
        settings: {
          ...settings,
          restByTier: normalizeRestByTier(settings.restByTier ?? state.settings.restByTier),
          plates: normalizePlateInventory(settings.plates ?? state.settings.plates),
        },
      }
    }

    case 'updateTrackWeight': {
      const track = state.tracks[action.key]
      if (!track) return state
      return {
        ...state,
        tracks: { ...state.tracks, [action.key]: { ...track, weight: sanitizeWeight(action.weight) } },
      }
    }

    case 'addT3': {
      const name = normalizeLiftName(action.name)
      if (name.length === 0) return state

      // Reusing a lift by name gives the same accessory one shared progression
      // across every day it appears on.
      const existing = Object.values(state.lifts).find(
        (lift) => lift.name.toLowerCase() === name.toLowerCase(),
      )
      const lift: LiftDefinition = existing ?? {
        id: newCustomLiftId(),
        name,
        short: shortForName(name),
        body: 'upper',
        barbell: action.barbell,
      }

      const dayT3 = state.t3ByDay[action.dayId] ?? []
      if (dayT3.includes(lift.id)) return state

      const key = trackKey(lift.id, 'T3')
      return {
        ...state,
        lifts: existing ? state.lifts : { ...state.lifts, [lift.id]: lift },
        t3ByDay: { ...state.t3ByDay, [action.dayId]: [...dayT3, lift.id] },
        tracks: state.tracks[key]
          ? state.tracks
          : {
              ...state.tracks,
              [key]: { weight: sanitizeWeight(defaultWeightFor(lift.id, 'T3')), stage: 0 },
            },
      }
    }

    case 'removeT3': {
      const dayT3 = state.t3ByDay[action.dayId]
      if (!dayT3?.includes(action.liftId)) return state
      // Keep the lift definition and track so history stays intact and re-adding
      // the accessory later restores its working weight.
      return {
        ...state,
        t3ByDay: {
          ...state.t3ByDay,
          [action.dayId]: dayT3.filter((liftId) => liftId !== action.liftId),
        },
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
