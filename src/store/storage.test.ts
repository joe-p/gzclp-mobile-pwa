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
    expect(data?.settings.restSeconds).toBe(120)
    expect(data?.settings.haptics).toBe(true)
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
    initial.settings = { ...initial.settings, setupComplete: true, restSeconds: 180 }
    expect(parseImportText(JSON.stringify(initial))).toEqual(initial)
  })

  it('returns null for invalid JSON', () => {
    expect(parseImportText('not json')).toBeNull()
  })
})
