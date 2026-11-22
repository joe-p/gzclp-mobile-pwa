import { defaultPlateInventory, normalizePlateInventory } from '../domain/plates'
import { ALL_TRACK_KEYS, LIFTS } from '../domain/program'
import type {
  ActiveSession,
  AppData,
  DayId,
  ExerciseRecord,
  LiftId,
  PlateInventory,
  PlateStack,
  ProgressionOutcome,
  SessionRecord,
  SetRecord,
  Settings,
  Tier,
} from '../domain/types'
import { sanitizeWeight } from '../domain/units'
import { clampRestSeconds, createInitialData, DATA_VERSION, DEFAULT_REST_BY_TIER } from './defaults'

export const STORAGE_KEY = 'gzclp.data.v1'

const DAY_IDS: readonly DayId[] = ['A1', 'B1', 'A2', 'B2']
const TIERS: readonly Tier[] = ['T1', 'T2', 'T3']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readSet(value: unknown): SetRecord | null {
  if (!isObject(value)) return null
  const target = readNumber(value.target, 0)
  if (target <= 0) return null
  const success = value.success === true ? true : value.success === false ? false : null
  const reps = typeof value.reps === 'number' && Number.isFinite(value.reps) ? Math.max(0, Math.round(value.reps)) : null
  return { target, reps, success, amrap: value.amrap === true }
}

function readOutcome(value: unknown): ProgressionOutcome | null {
  if (!isObject(value)) return null
  const action = value.action
  if (action !== 'increase' && action !== 'demote' && action !== 'reset' && action !== 'none') return null
  return {
    success: value.success === true,
    action,
    weightBefore: readNumber(value.weightBefore, 0),
    weightAfter: readNumber(value.weightAfter, 0),
    stageBefore: readNumber(value.stageBefore, 0),
    stageAfter: readNumber(value.stageAfter, 0),
    setsBefore: readNumber(value.setsBefore, 0),
    repsBefore: readNumber(value.repsBefore, 0),
    setsAfter: readNumber(value.setsAfter, 0),
    repsAfter: readNumber(value.repsAfter, 0),
  }
}

function readExercise(value: unknown): ExerciseRecord | null {
  if (!isObject(value)) return null
  const liftId = value.liftId as LiftId
  const tier = value.tier as Tier
  if (!(liftId in LIFTS) || !TIERS.includes(tier)) return null
  if (!Array.isArray(value.sets) || value.sets.length === 0) return null
  const sets = value.sets.map(readSet)
  if (sets.some((set) => set === null)) return null
  return {
    liftId,
    tier,
    weight: sanitizeWeight(readNumber(value.weight, 45)),
    stage: Math.max(0, Math.trunc(readNumber(value.stage, 0))),
    sets: sets as SetRecord[],
    e1rm: typeof value.e1rm === 'number' && Number.isFinite(value.e1rm) ? value.e1rm : null,
    outcome: readOutcome(value.outcome),
  }
}

function readSession(value: unknown): SessionRecord | null {
  if (!isObject(value)) return null
  if (typeof value.id !== 'string' || value.id.length === 0) return null
  if (!DAY_IDS.includes(value.dayId as DayId)) return null
  if (typeof value.startedAt !== 'string') return null
  if (!Array.isArray(value.exercises) || value.exercises.length === 0) return null
  const exercises = value.exercises.map(readExercise)
  if (exercises.some((exercise) => exercise === null)) return null
  return {
    id: value.id,
    dayId: value.dayId as DayId,
    startedAt: value.startedAt,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    exercises: exercises as ExerciseRecord[],
  }
}

function readActiveSession(value: unknown): ActiveSession | null {
  const session = readSession(value)
  if (!session || !isObject(value)) return null
  const index = Math.trunc(readNumber(value.exerciseIndex, 0))
  return {
    ...session,
    exerciseIndex: Math.min(Math.max(index, -1), session.exercises.length - 1),
  }
}

/**
 * Reads the plate inventory. Backups made before plates existed (no `plates`
 * key) get the default gym loadout; an explicit inventory is respected even
 * when every pair count is zero.
 */
function readPlateInventory(value: unknown): PlateInventory {
  if (!isObject(value) || !Array.isArray(value.plates)) return defaultPlateInventory()

  const plates: PlateStack[] = []
  for (const entry of value.plates) {
    if (!isObject(entry)) continue
    const size = readNumber(entry.size, NaN)
    if (!Number.isFinite(size) || size <= 0) continue
    plates.push({ size, pairs: Math.max(0, Math.trunc(readNumber(entry.pairs, 0))) })
  }

  return normalizePlateInventory({ bar: readNumber(value.bar, 45), plates })
}

/**
 * Reads per-tier rest times, falling back to the pre-v2 single `restSeconds`
 * value (applied to every tier) and then to defaults.
 */
function readRestByTier(rawSettings: Record<string, unknown>): Settings['restByTier'] {
  const legacy = readNumber(rawSettings.restSeconds, NaN)
  const perTier = isObject(rawSettings.restByTier) ? rawSettings.restByTier : null
  const restByTier = { ...DEFAULT_REST_BY_TIER }

  for (const tier of TIERS) {
    const stored = perTier?.[tier]
    if (typeof stored === 'number' && Number.isFinite(stored)) {
      restByTier[tier] = clampRestSeconds(stored)
    } else if (Number.isFinite(legacy)) {
      restByTier[tier] = clampRestSeconds(legacy)
    }
  }

  return restByTier
}

/**
 * Normalizes anything loaded from storage or a backup file. Returns null when
 * the payload is not plausibly a GZCLP backup, otherwise fills in every track
 * so new lifts added in a future version appear with defaults.
 */
export function migrate(raw: unknown): AppData | null {
  if (!isObject(raw) || !isObject(raw.tracks)) return null

  const initial = createInitialData()
  const tracks = { ...initial.tracks }
  for (const key of ALL_TRACK_KEYS) {
    const stored = raw.tracks[key]
    if (!isObject(stored) || typeof stored.weight !== 'number' || !Number.isFinite(stored.weight)) continue
    tracks[key] = {
      weight: sanitizeWeight(stored.weight),
      stage: Math.max(0, Math.trunc(readNumber(stored.stage, 0))),
    }
  }

  const rawSettings = isObject(raw.settings) ? raw.settings : {}
  const settings: Settings = {
    restByTier: readRestByTier(rawSettings),
    plates: readPlateInventory(rawSettings.plates),
    setupComplete: rawSettings.setupComplete === true,
    haptics: rawSettings.haptics !== false,
  }

  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions
        .map(readSession)
        .filter((session): session is SessionRecord => session !== null)
    : []

  const lastSummaryId =
    typeof raw.lastSummaryId === 'string' && sessions.some((session) => session.id === raw.lastSummaryId)
      ? raw.lastSummaryId
      : null

  return {
    version: DATA_VERSION,
    settings,
    tracks,
    nextDayIndex: Math.min(3, Math.max(0, Math.trunc(readNumber(raw.nextDayIndex, 0)))),
    sessions,
    activeSession: readActiveSession(raw.activeSession),
    lastSummaryId,
  }
}

export function loadData(): AppData {
  if (typeof localStorage === 'undefined') return createInitialData()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return createInitialData()
    return migrate(JSON.parse(stored)) ?? createInitialData()
  } catch {
    return createInitialData()
  }
}

export function saveData(data: AppData): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage can be full or blocked (private mode); the app still works in memory.
  }
}

export function clearData(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function parseImportText(text: string): AppData | null {
  try {
    return migrate(JSON.parse(text))
  } catch {
    return null
  }
}

export async function readImportFile(file: File): Promise<AppData> {
  const data = parseImportText(await file.text())
  if (!data) throw new Error('That file is not a GZCLP backup.')
  return data
}

export function downloadBackup(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `gzclp-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
