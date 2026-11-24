import { defaultPlateInventory, normalizePlateInventory } from '../domain/plates'
import { cloneT3ByDay, cloneT3Library, defaultTracks, LIFTS } from '../domain/program'
import type { AppData, RestByTier, Settings } from '../domain/types'

export const DATA_VERSION = 7

export const DEFAULT_REST_BY_TIER: RestByTier = {
  T1: { min: 180, max: 300 },
  T2: { min: 120, max: 180 },
  T3: { min: 60, max: 90 },
}

export function cloneRestByTier(source: RestByTier = DEFAULT_REST_BY_TIER): RestByTier {
  return {
    T1: { ...source.T1 },
    T2: { ...source.T2 },
    T3: { ...source.T3 },
  }
}

export const DEFAULT_SETTINGS: Settings = {
  restByTier: cloneRestByTier(),
  plates: defaultPlateInventory(),
  setupComplete: false,
  haptics: true,
}

export function createInitialData(): AppData {
  return {
    version: DATA_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      restByTier: cloneRestByTier(),
      plates: normalizePlateInventory(DEFAULT_SETTINGS.plates),
    },
    lifts: { ...LIFTS },
    t3Library: cloneT3Library(),
    t3ByDay: cloneT3ByDay(),
    tracks: defaultTracks(cloneT3ByDay(), cloneT3Library()),
    nextDayIndex: 0,
    sessions: [],
    activeSession: null,
    lastSummaryId: null,
  }
}
