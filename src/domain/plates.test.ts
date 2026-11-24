import { describe, expect, it } from 'vitest'
import {
  computePlateLoad,
  computePlateLoadSequence,
  defaultPlateInventory,
  isBarbellLift,
  normalizePlateInventory,
  pairsFor,
  plateChanges,
  totalPlateWeight,
  withPairs,
} from './plates'
import { LIFTS } from './program'
import type { PlateInventory } from './types'

function inventory(bar: number, pairCounts: Record<number, number>): PlateInventory {
  return {
    bar,
    plates: Object.entries(pairCounts).map(([size, pairs]) => ({ size: Number(size), pairs })),
  }
}

describe('computePlateLoad', () => {
  it('loads an exact weight with the default gym set', () => {
    const load = computePlateLoad(135, defaultPlateInventory())
    expect(load.perSide).toEqual([45])
    expect(load.loadedWeight).toBe(135)
    expect(load.exact).toBe(true)
  })

  it('uses small plates for weights that land between 10 lb jumps', () => {
    const load = computePlateLoad(95, defaultPlateInventory())
    expect(load.perSide).toEqual([25])
    expect(load.loadedWeight).toBe(95)

    const benchT2 = computePlateLoad(60, defaultPlateInventory())
    expect(benchT2.perSide).toEqual([5, 2.5])
    expect(benchT2.loadedWeight).toBe(60)
  })

  it('loads an empty bar when the working weight equals the bar', () => {
    const load = computePlateLoad(45, defaultPlateInventory())
    expect(load.perSide).toEqual([])
    expect(load.loadedWeight).toBe(45)
    expect(load.exact).toBe(true)
  })

  it('flags weights below the bar', () => {
    const load = computePlateLoad(25, defaultPlateInventory())
    expect(load.belowBar).toBe(true)
    expect(load.exact).toBe(false)
    expect(load.loadedWeight).toBe(45)
  })

  it('finds a non-greedy combination when pair counts are limited', () => {
    // 60 per side with one 45, one 35 and one 25 pair: greedy takes 45 and
    // stops, but 35 + 25 is exact.
    const load = computePlateLoad(165, inventory(45, { 45: 1, 35: 1, 25: 1 }))
    expect(load.perSide).toEqual([35, 25])
    expect(load.loadedWeight).toBe(165)
    expect(load.exact).toBe(true)
  })

  it('reports the closest achievable load and the shortfall', () => {
    const load = computePlateLoad(135, inventory(45, { 25: 1 }))
    // 45 lb per side is needed, but a single 25 pair caps the side at 25.
    expect(load.loadedWeight).toBe(95)
    expect(load.exact).toBe(false)
    expect(load.shortPerSide).toBe(20)
  })

  it('only uses each pair once per side', () => {
    const load = computePlateLoad(225, inventory(45, { 45: 1 }))
    // One 45 pair = 45 per side → 135 total. A second 45 would be needed for 225.
    expect(load.perSide).toEqual([45])
    expect(load.loadedWeight).toBe(135)
  })

  it('falls back to the closest lighter load rather than overshooting', () => {
    const load = computePlateLoad(187.5, inventory(45, { 45: 1, 25: 1, 10: 1 }))
    expect(load.loadedWeight).toBeLessThanOrEqual(187.5)
    expect(load.exact).toBe(false)
  })

  it('breaks ties toward keeping the heaviest plates', () => {
    // 50 per side is 45 + 5 or 25 + 25; both are two plates, but the 45 keeps
    // the stack consistent with the weights either side of it.
    expect(computePlateLoad(145, defaultPlateInventory()).perSide).toEqual([45, 5])
  })

  it('keeps the loaded stack when it only needs extra plates', () => {
    const load = computePlateLoad(145, defaultPlateInventory(), { loaded: [45] })
    expect(load.perSide).toEqual([45, 5])
    expect(load.exact).toBe(true)
    expect(load.changes).toBe(1)
  })

  it('adds a plate instead of swapping to a shorter stack', () => {
    // 60 per side from 45 + 10: 45 + 10 + 5 is one addition, 35 + 25 would be
    // four plates of handling.
    const load = computePlateLoad(165, defaultPlateInventory(), { loaded: [45, 10] })
    expect(load.perSide).toEqual([45, 10, 5])
    expect(load.changes).toBe(1)
  })

  it('removes plates when the loaded stack is heavier than needed', () => {
    const load = computePlateLoad(95, defaultPlateInventory(), { loaded: [45, 5] })
    expect(load.perSide).toEqual([25])
    expect(load.changes).toBe(3)
  })

  it('prices removals and additions the same way', () => {
    expect(plateChanges([], [])).toBe(0)
    expect(plateChanges([45], [])).toBe(1)
    expect(plateChanges([45, 5], [45])).toBe(1)
    expect(plateChanges([25, 10], [25])).toBe(1)
    expect(plateChanges([45, 5], [45, 10])).toBe(2)
  })
})

describe('computePlateLoadSequence', () => {
  it('only adds plates as the bench ramp climbs', () => {
    const loads = computePlateLoadSequence([45, 95, 115, 135, 145], defaultPlateInventory())

    expect(loads.map((load) => load.perSide)).toEqual([
      [],
      [25],
      [25, 10],
      [25, 10, 10],
      [25, 10, 10, 5],
    ])
    expect(loads.every((load) => load.exact)).toBe(true)
    // Every step is a single plate change, so nothing is ever stripped off.
    expect(loads.map((load) => load.changes)).toEqual([0, 1, 1, 1, 1])
  })

  it('starts from the plates already on the bar', () => {
    const loads = computePlateLoadSequence([145], defaultPlateInventory(), [45])
    expect(loads[0].perSide).toEqual([45, 5])
    expect(loads[0].changes).toBe(1)
  })

  it('reuses the same stack for repeated warmup weights', () => {
    const loads = computePlateLoadSequence([45, 45, 95], defaultPlateInventory())
    expect(loads.map((load) => load.changes)).toEqual([0, 0, 1])
  })
})

describe('normalizePlateInventory', () => {
  it('keeps every standard size and clamps pair counts', () => {
    const normalized = normalizePlateInventory({
      bar: 47,
      plates: [
        { size: 45, pairs: 3 },
        { size: 10, pairs: -4 },
        { size: 7.5, pairs: 1 },
        { size: 45, pairs: 2 },
      ],
    })

    expect(normalized.bar).toBe(45)
    expect(normalized.plates.map((plate) => plate.size)).toEqual([45, 35, 25, 10, 7.5, 5, 2.5])
    expect(pairsFor(normalized, 45)).toBe(3)
    expect(pairsFor(normalized, 10)).toBe(0)
    expect(pairsFor(normalized, 7.5)).toBe(1)
    expect(pairsFor(normalized, 35)).toBe(0)
  })

  it('defaults to a stocked gym when nothing is stored', () => {
    const normalized = normalizePlateInventory(undefined)
    expect(normalized.bar).toBe(45)
    expect(pairsFor(normalized, 45)).toBe(2)
    expect(totalPlateWeight(normalized)).toBeGreaterThan(200)
  })
})

describe('withPairs', () => {
  it('updates and adds plate sizes without losing the rest', () => {
    const start = normalizePlateInventory({ bar: 45, plates: [{ size: 45, pairs: 1 }] })
    const updated = withPairs(start, 45, 2)
    expect(pairsFor(updated, 45)).toBe(2)

    const added = withPairs(updated, 15, 1)
    expect(pairsFor(added, 15)).toBe(1)
    expect(pairsFor(added, 45)).toBe(2)
  })
})

describe('isBarbellLift', () => {
  it('treats the lat pulldown as a machine', () => {
    expect(isBarbellLift(LIFTS.latpulldown)).toBe(false)
    expect(isBarbellLift(LIFTS.squat)).toBe(true)
    expect(isBarbellLift(LIFTS.row)).toBe(true)
  })

  it('treats unknown or custom machine accessories as non-barbell', () => {
    expect(isBarbellLift(undefined)).toBe(false)
    expect(isBarbellLift({ ...LIFTS.row, id: 'custom_legpress', barbell: false })).toBe(false)
  })
})
