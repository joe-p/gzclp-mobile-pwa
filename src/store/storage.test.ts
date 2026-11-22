import { describe, expect, it } from 'vitest'
import { createInitialData } from './defaults'
import { migrate, parseImportText } from './storage'

describe('migrate', () => {
  it('rejects payloads that are not backups', () => {
    expect(migrate(null)).toBeNull()
    expect(migrate('{"a":1}')).toBeNull()
    expect(migrate({ settings: {} })).toBeNull()
  })

  it('fills missing tracks with defaults and clamps the day index', () => {
    const initial = createInitialData()
    const data = migrate({
      version: 1,
      settings: { setupComplete: true },
      tracks: { 'squat:T1': { weight: 200, stage: 1 } },
      nextDayIndex: 9,
      sessions: [],
    })

    expect(data).not.toBeNull()
    expect(data?.tracks['squat:T1']).toEqual({ weight: 200, stage: 1 })
    expect(data?.tracks['bench:T1'].weight).toBe(initial.tracks['bench:T1'].weight)
    expect(data?.nextDayIndex).toBe(3)
    expect(data?.settings.setupComplete).toBe(true)
    expect(data?.settings.restByTier).toEqual({ T1: 180, T2: 120, T3: 60 })
    expect(data?.settings.haptics).toBe(true)
  })

  it('applies a legacy single rest time to every tier', () => {
    const data = migrate({
      version: 1,
      settings: { setupComplete: true, restSeconds: 240 },
      tracks: {},
    })

    expect(data?.settings.restByTier).toEqual({ T1: 240, T2: 240, T3: 240 })
  })

  it('reads and clamps per-tier rest times', () => {
    const data = migrate({
      version: 2,
      settings: { setupComplete: true, restByTier: { T1: 300, T2: -5, T3: 5000 } },
      tracks: {},
    })

    expect(data?.settings.restByTier).toEqual({ T1: 300, T2: 0, T3: 900 })
  })

  it('drops malformed sessions and dangling summary ids', () => {
    const data = migrate({
      ...createInitialData(),
      sessions: [{ id: 'x' }, { nope: true }],
      lastSummaryId: 'x',
    })
    expect(data?.sessions).toEqual([])
    expect(data?.lastSummaryId).toBeNull()
  })

  it('round-trips an exported backup', () => {
    const initial = createInitialData()
    initial.settings = { ...initial.settings, setupComplete: true, restByTier: { T1: 300, T2: 180, T3: 60 } }
    expect(parseImportText(JSON.stringify(initial))).toEqual(initial)
  })

  it('returns null for invalid JSON', () => {
    expect(parseImportText('not json')).toBeNull()
  })
})
