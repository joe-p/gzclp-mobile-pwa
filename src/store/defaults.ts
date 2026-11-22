import { defaultTracks } from '../domain/program'
import type { AppData, Settings } from '../domain/types'

export const DATA_VERSION = 1

export const DEFAULT_SETTINGS: Settings = {
  restSeconds: 120,
  setupComplete: false,
  haptics: true,
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
