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
    expect(data?.settings.restByTier).toEqual({
      T1: { min: 180, max: 300 },
      T2: { min: 120, max: 180 },
      T3: { min: 60, max: 90 },
    })
    expect(data?.settings.haptics).toBe(true)
  })

  it('upgrades a legacy single rest time to a range on every tier', () => {
    const data = migrate({
      version: 1,
      settings: { setupComplete: true, restSeconds: 240 },
      tracks: {},
    })

    expect(data?.settings.restByTier).toEqual({
      T1: { min: 240, max: 300 },
      T2: { min: 240, max: 240 },
      T3: { min: 240, max: 240 },
    })
  })

  it('upgrades pre-range per-tier rest times using the standard upper bound', () => {
    const data = migrate({
      version: 4,
      settings: { setupComplete: true, restByTier: { T1: 180, T2: 120, T3: 60 } },
      tracks: {},
    })

    expect(data?.settings.restByTier).toEqual({
      T1: { min: 180, max: 300 },
      T2: { min: 120, max: 180 },
      T3: { min: 60, max: 90 },
    })
  })

  it('reads and clamps per-tier rest ranges', () => {
    const data = migrate({
      version: 5,
      settings: {
        setupComplete: true,
        restByTier: {
          T1: { min: 300, max: 200 },
          T2: { min: -5, max: 5000 },
          T3: { min: 45, max: 90 },
        },
      },
      tracks: {},
    })

    expect(data?.settings.restByTier).toEqual({
      T1: { min: 300, max: 300 },
      T2: { min: 0, max: 900 },
      T3: { min: 45, max: 90 },
    })
  })

  it('gives pre-plate backups the default bar and plate set', () => {
    const data = migrate({ version: 2, settings: { setupComplete: true }, tracks: {} })
    expect(data?.settings.plates.bar).toBe(45)
    expect(data?.settings.plates.plates.find((plate) => plate.size === 45)?.pairs).toBe(2)
  })

  it('reads a custom plate inventory and keeps custom sizes', () => {
    const initial = createInitialData()
    const data = migrate({
      ...initial,
      settings: {
        ...initial.settings,
        plates: { bar: 35, plates: [{ size: 45, pairs: 0 }, { size: 20, pairs: 3 }] },
      },
    })

    expect(data?.settings.plates.bar).toBe(35)
    expect(data?.settings.plates.plates.find((plate) => plate.size === 45)?.pairs).toBe(0)
    expect(data?.settings.plates.plates.find((plate) => plate.size === 20)?.pairs).toBe(3)
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
    initial.settings = {
      ...initial.settings,
      setupComplete: true,
      restByTier: { T1: { min: 300, max: 300 }, T2: { min: 120, max: 180 }, T3: { min: 60, max: 90 } },
    }
    expect(parseImportText(JSON.stringify(initial))).toEqual(initial)
  })

  it('returns null for invalid JSON', () => {
    expect(parseImportText('not json')).toBeNull()
  })
})

describe('migrate accessories', () => {
  it('gives pre-accessory backups the default T3 program and built-in lifts', () => {
    const data = migrate({
      version: 3,
      settings: { setupComplete: true },
      tracks: {},
    })

    expect(data?.t3ByDay).toEqual({ A1: ['latpulldown'], B1: ['row'], A2: ['latpulldown'], B2: ['row'] })
    expect(data?.lifts.squat).toMatchObject({ name: 'Squat', barbell: true })
    expect(data?.lifts.latpulldown).toMatchObject({ name: 'Lat Pulldown', barbell: false })
  })

  it('preserves a 0 lb T3 weight and keeps the floor on T1/T2', () => {
    const initial = createInitialData()
    const data = migrate({
      ...initial,
      tracks: {
        ...initial.tracks,
        'latpulldown:T3': { weight: 0, stage: 0 },
        'squat:T1': { weight: 0, stage: 0 },
      },
    })

    expect(data?.tracks['latpulldown:T3']).toEqual({ weight: 0, stage: 0 })
    expect(data?.tracks['squat:T1']).toEqual({ weight: 5, stage: 0 })
  })

  it('round-trips custom accessories and their config', () => {
    const initial = createInitialData()
    const lift = {
      id: 'custom_legpress',
      name: 'Leg Press',
      short: 'LP',
      body: 'upper' as const,
      barbell: false,
    }
    initial.lifts[lift.id] = lift
    initial.t3Library.push(lift.id)
    initial.t3ByDay.A1 = ['latpulldown', lift.id]
    initial.tracks['custom_legpress:T3'] = { weight: 90, stage: 0 }

    expect(parseImportText(JSON.stringify(initial))).toEqual(initial)
  })

  it('respects a day with no T3 accessories', () => {
    const initial = createInitialData()
    const data = migrate({
      ...initial,
      t3Library: ['row'],
      t3ByDay: { A1: [], B1: ['row'], A2: [], B2: [] },
    })

    expect(data?.t3ByDay).toEqual({ A1: [], B1: ['row'], A2: [], B2: [] })
    expect(data?.t3Library).toEqual(['row'])
    // Library accessories keep their weight even while no day uses them.
    expect(data?.tracks['row:T3']).toEqual(initial.tracks['row:T3'])
  })

  it('rebuilds the library from the days when a backup has none', () => {
    const initial = createInitialData()
    const { t3Library, ...legacy } = initial
    expect(t3Library.length).toBeGreaterThan(0)

    const data = migrate(legacy)

    expect(data?.t3Library).toEqual(['latpulldown', 'row'])
    expect(data?.tracks['latpulldown:T3']).toEqual(initial.tracks['latpulldown:T3'])
  })

  it('keeps a library accessory the days no longer use', () => {
    const initial = createInitialData()
    const data = migrate({
      ...initial,
      t3Library: ['latpulldown', 'row'],
      t3ByDay: { A1: [], B1: [], A2: [], B2: [] },
      tracks: { ...initial.tracks, 'row:T3': { weight: 105, stage: 0 } },
    })

    expect(data?.t3Library).toEqual(['latpulldown', 'row'])
    expect(data?.tracks['row:T3']).toEqual({ weight: 105, stage: 0 })
  })

  it('drops malformed custom lifts and unknown day ids', () => {
    const initial = createInitialData()
    const data = migrate({
      ...initial,
      lifts: {
        ...initial.lifts,
        bad: { id: 'bad', name: '' },
        'with:colon': { id: 'with:colon', name: 'Nope' },
      },
      t3ByDay: { A1: ['nope', 'latpulldown'], B1: [], A2: [], B2: [] },
    })

    expect(data?.lifts.bad).toBeUndefined()
    expect(data?.lifts['with:colon']).toBeUndefined()
    expect(data?.t3ByDay.A1).toEqual(['latpulldown'])
  })

  it('keeps sessions whose custom lift definition is missing', () => {
    const initial = createInitialData()
    const data = migrate({
      ...initial,
      sessions: [
        {
          id: 's1',
          dayId: 'A1',
          startedAt: '2026-01-02T10:00:00.000Z',
          finishedAt: '2026-01-02T11:00:00.000Z',
          exercises: [
            {
              liftId: 'custom_ghost',
              tier: 'T3',
              weight: 50,
              stage: 0,
              sets: [{ target: 15, reps: 15, success: true, amrap: true }],
              e1rm: null,
              outcome: null,
            },
          ],
        },
      ],
    })

    expect(data?.sessions).toHaveLength(1)
    expect(data?.lifts.custom_ghost).toMatchObject({ name: 'custom_ghost', barbell: false })
  })

  it('keeps a removed accessory track so its weight survives', () => {
    const initial = createInitialData()
    const data = migrate({
      ...initial,
      t3ByDay: { A1: [], B1: [], A2: [], B2: [] },
      tracks: { ...initial.tracks, 'row:T3': { weight: 105, stage: 0 } },
    })

    expect(data?.tracks['row:T3']).toEqual({ weight: 105, stage: 0 })
  })
})
