import { normalizePlateInventory } from '../domain/plates'
import {
  barbellLiftName,
  defaultTrack,
  newCustomLiftId,
  normalizeLiftName,
  PROGRAM_DAY_IDS,
  programDays,
  shortForName,
  TIERS,
  tierForTrackKey,
  trackKey,
} from '../domain/program'
import { applyProgression, exerciseSucceeded } from '../domain/progression'
import { normalizeRestRange } from '../domain/rest'
import {
  createSession,
  isExerciseComplete,
  recordAmrapResult,
  recordSetResult,
  recordWarmupResult,
  sessionProgress,
} from '../domain/session'
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
import { minWeightForTier, sanitizeWeight } from '../domain/units'
import { createInitialData } from './defaults'

export type Action =
  | {
      type: 'saveSetup'
      weights: Record<TrackKey, number>
      restByTier: RestByTier
      plates: PlateInventory
    }
  | { type: 'startSession' }
  | { type: 'selectDay'; dayIndex: number }
  | { type: 'discardSession' }
  | { type: 'showExercise'; index: number }
  | { type: 'recordSet'; exerciseIndex: number; setIndex: number; success: boolean | null }
  | { type: 'recordAmrap'; exerciseIndex: number; reps: number }
  | { type: 'recordWarmup'; exerciseIndex: number; warmupIndex: number; completed: boolean }
  | { type: 'finishSession' }
  | { type: 'dismissSummary' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'updateTrackWeight'; key: TrackKey; weight: number }
  | { type: 'createT3'; name: string; barbell: boolean }
  | { type: 'deleteT3'; liftId: LiftId }
  | { type: 'assignT3'; dayId: DayId; liftId: LiftId }
  | { type: 'unassignT3'; dayId: DayId; liftId: LiftId }
  | { type: 'moveT3'; dayId: DayId; liftId: LiftId; direction: -1 | 1 }
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
    normalized[tier] = normalizeRestRange(restByTier[tier])
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
          tracks[key] = {
            ...tracks[key],
            weight: sanitizeWeight(weight, minWeightForTier(tierForTrackKey(key))),
          }
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
        activeSession: createSession(day, state.tracks, {
          bar: state.settings.plates.bar,
          warmupMethod: state.settings.warmupMethod,
        }),
        lastSummaryId: null,
      }
    }

    case 'selectDay': {
      // Lets the user jump to any day in the rotation, e.g. skip A1 and do B2.
      if (state.activeSession) return state
      const dayIndex = Math.trunc(action.dayIndex)
      if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= PROGRAM_DAY_IDS.length) {
        return state
      }
      if (dayIndex === state.nextDayIndex) return state
      return { ...state, nextDayIndex: dayIndex }
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

    case 'recordWarmup': {
      const session = state.activeSession
      if (!session) return state
      const next = recordWarmupResult(
        session,
        action.exerciseIndex,
        action.warmupIndex,
        action.completed,
      )
      return next === session ? state : { ...state, activeSession: next }
    }

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
        tracks: {
          ...state.tracks,
          [action.key]: {
            ...track,
            weight: sanitizeWeight(action.weight, minWeightForTier(tierForTrackKey(action.key))),
          },
        },
      }
    }

    case 'createT3': {
      const name = action.barbell ? barbellLiftName(action.name) : normalizeLiftName(action.name)
      if (name.length === 0) return state

      // Reusing a lift by name keeps one library entry, one weight and one
      // progression no matter how many days pick it.
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
      if (state.t3Library.includes(lift.id)) return state

      const key = trackKey(lift.id, 'T3')
      return {
        ...state,
        lifts: existing ? state.lifts : { ...state.lifts, [lift.id]: lift },
        t3Library: [...state.t3Library, lift.id],
        tracks: state.tracks[key]
          ? state.tracks
          : { ...state.tracks, [key]: defaultTrack(lift.id, 'T3') },
      }
    }

    case 'deleteT3': {
      if (!state.t3Library.includes(action.liftId)) return state
      // Keep the lift definition and track so history stays intact and re-adding
      // the accessory later restores its working weight.
      const t3ByDay = { ...state.t3ByDay }
      for (const dayId of PROGRAM_DAY_IDS) {
        t3ByDay[dayId] = (state.t3ByDay[dayId] ?? []).filter((liftId) => liftId !== action.liftId)
      }
      return {
        ...state,
        t3Library: state.t3Library.filter((liftId) => liftId !== action.liftId),
        t3ByDay,
      }
    }

    case 'assignT3': {
      if (!state.t3Library.includes(action.liftId)) return state
      const dayT3 = state.t3ByDay[action.dayId] ?? []
      if (dayT3.includes(action.liftId)) return state
      const key = trackKey(action.liftId, 'T3')
      return {
        ...state,
        t3ByDay: { ...state.t3ByDay, [action.dayId]: [...dayT3, action.liftId] },
        tracks: state.tracks[key]
          ? state.tracks
          : { ...state.tracks, [key]: defaultTrack(action.liftId, 'T3') },
      }
    }

    case 'unassignT3': {
      const dayT3 = state.t3ByDay[action.dayId]
      if (!dayT3?.includes(action.liftId)) return state
      return {
        ...state,
        t3ByDay: {
          ...state.t3ByDay,
          [action.dayId]: dayT3.filter((liftId) => liftId !== action.liftId),
        },
      }
    }

    case 'moveT3': {
      const dayT3 = state.t3ByDay[action.dayId]
      if (!dayT3) return state
      const index = dayT3.indexOf(action.liftId)
      const target = index + Math.sign(action.direction)
      // Missing lift or already at the end of the list in that direction.
      if (index === -1 || target < 0 || target >= dayT3.length) return state
      const reordered = [...dayT3]
      reordered[index] = dayT3[target]
      reordered[target] = dayT3[index]
      return { ...state, t3ByDay: { ...state.t3ByDay, [action.dayId]: reordered } }
    }

    case 'importData':
      return action.data

    case 'resetData':
      return createInitialData()

    default:
      return state
  }
}
