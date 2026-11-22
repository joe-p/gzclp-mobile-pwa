import { defaultTracks } from '../domain/program'
import type { AppData, RestByTier, Settings } from '../domain/types'

export const DATA_VERSION = 2

export const DEFAULT_REST_BY_TIER: RestByTier = {
  T1: 180,
  T2: 120,
  T3: 60,
}

export const DEFAULT_SETTINGS: Settings = {
  restByTier: { ...DEFAULT_REST_BY_TIER },
  setupComplete: false,
  haptics: true,
}

/** Rest timers are capped at 15 minutes. */
export function clampRestSeconds(seconds: number): number {
  return Math.min(900, Math.max(0, Math.trunc(seconds)))
}

export function createInitialData(): AppData {
  return {
    version: DATA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    tracks: defaultTracks(),
    nextDayIndex: 0,
    sessions: [],
    activeSession: null,
    lastSummaryId: null,
  }
}
