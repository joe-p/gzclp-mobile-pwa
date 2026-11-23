import { defaultPlateInventory, normalizePlateInventory } from '../domain/plates'
import {
  cloneT3ByDay,
  defaultTracks,
  LIFTS,
  normalizeLiftName,
  PROGRAM_DAY_IDS,
  shortForName,
  t3IdsInDays,
  trackKey,
} from '../domain/program'
import type {
  ActiveSession,
  AppData,
  DayId,
  ExerciseRecord,
  LiftDefinition,
  LiftId,
  PlateInventory,
  PlateStack,
  ProgressionOutcome,
  RestRange,
  SessionRecord,
  SetRecord,
  Settings,
  T3ByDay,
  Tier,
  TrackKey,
  TrackState,
} from '../domain/types'
import { clampRestSeconds, normalizeRestRange } from '../domain/rest'
import { minWeightForTier, sanitizeWeight } from '../domain/units'
import { cloneRestByTier, createInitialData, DATA_VERSION, DEFAULT_REST_BY_TIER } from './defaults'

export const STORAGE_KEY = 'gzclp.data.v1'

const TIERS: readonly Tier[] = ['T1', 'T2', 'T3']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isLiftId(value: unknown): value is LiftId {
  return typeof value === 'string' && value.length > 0 && value.length <= 100 && !value.includes(':')
}

function hasLift(lifts: Record<LiftId, LiftDefinition>, liftId: LiftId): boolean {
  return Object.hasOwn(lifts, liftId)
}

function fallbackLift(liftId: LiftId): LiftDefinition {
  return {
    id: liftId,
    name: liftId,
    short: shortForName(liftId),
    body: 'upper',
    barbell: false,
  }
}

/** Reads user-created lifts. Built-in definitions always come from code. */
function readLift(value: unknown): LiftDefinition | null {
  if (!isObject(value) || !isLiftId(value.id) || Object.hasOwn(LIFTS, value.id)) return null
  const name = typeof value.name === 'string' ? normalizeLiftName(value.name) : ''
  if (name.length === 0) return null
  return {
    id: value.id,
    name,
    short:
      typeof value.short === 'string' && value.short.trim().length > 0
        ? value.short.trim().slice(0, 4).toUpperCase()
        : shortForName(name),
    body: value.body === 'lower' ? 'lower' : 'upper',
    barbell: value.barbell === true,
  }
}

function readLifts(value: unknown): Record<LiftId, LiftDefinition> {
  const lifts: Record<LiftId, LiftDefinition> = { ...LIFTS }
  if (!isObject(value) || Array.isArray(value)) return lifts

  for (const entry of Object.values(value)) {
    const lift = readLift(entry)
    if (lift && !hasLift(lifts, lift.id)) lifts[lift.id] = lift
  }
  return lifts
}

/**
 * Reads the per-day T3 lists. Backups from before accessories were editable get
 * the default program; an explicitly empty list is respected.
 */
function readT3ByDay(value: unknown, lifts: Record<LiftId, LiftDefinition>): T3ByDay {
  if (!isObject(value) || Array.isArray(value)) return cloneT3ByDay()

  const t3ByDay = {} as T3ByDay
  for (const dayId of PROGRAM_DAY_IDS) {
    const stored = value[dayId]
    if (!Array.isArray(stored)) {
      t3ByDay[dayId] = []
      continue
    }

    const ids: LiftId[] = []
    for (const entry of stored) {
      if (!isLiftId(entry) || !hasLift(lifts, entry) || ids.includes(entry)) continue
      ids.push(entry)
    }
    t3ByDay[dayId] = ids
  }
  return t3ByDay
}

/**
 * Reads the accessory library. Backups from before accessories were picked per
 * day fall back to the unique accessories already used in the program.
 */
function readT3Library(value: unknown, t3ByDay: T3ByDay): LiftId[] {
  const ids: LiftId[] = []
  const add = (liftId: LiftId) => {
    if (!ids.includes(liftId)) ids.push(liftId)
  }

  if (Array.isArray(value)) {
    for (const entry of value) if (isLiftId(entry)) add(entry)
  }
  // Every accessory a day uses must stay pickable, so a backup with a partial
  // (or missing) library still works.
  for (const liftId of t3IdsInDays(t3ByDay)) add(liftId)
  return ids
}

function splitTrackKey(key: string): { liftId: LiftId; tier: Tier } | null {
  const separator = key.lastIndexOf(':')
  if (separator <= 0) return null
  const liftId = key.slice(0, separator)
  const tier = key.slice(separator + 1) as Tier
  if (!isLiftId(liftId) || !TIERS.includes(tier)) return null
  return { liftId, tier }
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
  const liftId = value.liftId
  const tier = value.tier as Tier
  if (!isLiftId(liftId) || !TIERS.includes(tier)) return null
  if (!Array.isArray(value.sets) || value.sets.length === 0) return null
  const sets = value.sets.map(readSet)
  if (sets.some((set) => set === null)) return null
  return {
    liftId,
    tier,
    weight: sanitizeWeight(readNumber(value.weight, 45), minWeightForTier(tier)),
    stage: Math.max(0, Math.trunc(readNumber(value.stage, 0))),
    sets: sets as SetRecord[],
    e1rm: typeof value.e1rm === 'number' && Number.isFinite(value.e1rm) ? value.e1rm : null,
    outcome: readOutcome(value.outcome),
  }
}

function readSession(value: unknown): SessionRecord | null {
  if (!isObject(value)) return null
  if (typeof value.id !== 'string' || value.id.length === 0) return null
  if (!PROGRAM_DAY_IDS.includes(value.dayId as DayId)) return null
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
 * Upgrades a pre-range rest time. The old single value becomes the minimum,
 * paired with the standard upper bound so existing installs get the new
 * blocking/warning behavior without losing their chosen rest time.
 */
function restRangeFromSeconds(seconds: number, tier: Tier): RestRange {
  const min = clampRestSeconds(seconds)
  return { min, max: Math.max(min, DEFAULT_REST_BY_TIER[tier].max) }
}

function readRestRange(value: unknown, tier: Tier): RestRange {
  if (typeof value === 'number' && Number.isFinite(value)) return restRangeFromSeconds(value, tier)
  if (!isObject(value)) return { ...DEFAULT_REST_BY_TIER[tier] }

  const fallback = DEFAULT_REST_BY_TIER[tier]
  return normalizeRestRange({
    min: readNumber(value.min, fallback.min),
    max: readNumber(value.max, fallback.max),
  })
}

/**
 * Reads per-tier rest ranges, falling back to the pre-v2 single `restSeconds`
 * value (applied to every tier) and then to defaults.
 */
function readRestByTier(rawSettings: Record<string, unknown>): Settings['restByTier'] {
  const legacy = readNumber(rawSettings.restSeconds, NaN)
  const perTier = isObject(rawSettings.restByTier) ? rawSettings.restByTier : null
  const restByTier = cloneRestByTier()

  for (const tier of TIERS) {
    const stored = perTier?.[tier]
    if (stored !== undefined) {
      restByTier[tier] = readRestRange(stored, tier)
    } else if (Number.isFinite(legacy)) {
      restByTier[tier] = restRangeFromSeconds(legacy, tier)
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

  const lifts = readLifts(raw.lifts)
  const t3ByDay = readT3ByDay(raw.t3ByDay, lifts)
  const libraryIds = readT3Library(raw.t3Library, t3ByDay)
  const tracks: Record<TrackKey, TrackState> = defaultTracks(t3ByDay, libraryIds)

  for (const [key, stored] of Object.entries(raw.tracks)) {
    if (!isObject(stored) || typeof stored.weight !== 'number' || !Number.isFinite(stored.weight)) continue
    const parsed = splitTrackKey(key)
    if (!parsed) continue
    // Keep tracks for accessories that were removed from every day, so adding
    // them back later restores the working weight.
    if (!hasLift(lifts, parsed.liftId)) lifts[parsed.liftId] = fallbackLift(parsed.liftId)
    tracks[trackKey(parsed.liftId, parsed.tier)] = {
      weight: sanitizeWeight(stored.weight, minWeightForTier(parsed.tier)),
      stage: Math.max(0, Math.trunc(readNumber(stored.stage, 0))),
    }
  }

  // Drop library entries whose lift definition is gone; the tracks loop above
  // rebuilds placeholders for anything still referenced by history.
  const t3Library = libraryIds.filter((liftId) => hasLift(lifts, liftId))

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

  // A backup can reference a custom lift whose definition was dropped; keep the
  // history readable with a placeholder instead of discarding the session.
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (!hasLift(lifts, exercise.liftId)) lifts[exercise.liftId] = fallbackLift(exercise.liftId)
    }
  }

  const lastSummaryId =
    typeof raw.lastSummaryId === 'string' && sessions.some((session) => session.id === raw.lastSummaryId)
      ? raw.lastSummaryId
      : null

  return {
    version: DATA_VERSION,
    settings,
    lifts,
    t3Library,
    t3ByDay,
    tracks,
    nextDayIndex: Math.min(
      PROGRAM_DAY_IDS.length - 1,
      Math.max(0, Math.trunc(readNumber(raw.nextDayIndex, 0))),
    ),
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
