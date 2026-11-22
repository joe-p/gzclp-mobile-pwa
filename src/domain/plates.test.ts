import { describe, expect, it } from 'vitest'
import {
  computePlateLoad,
  defaultPlateInventory,
  isBarbellLift,
  normalizePlateInventory,
  pairsFor,
  totalPlateWeight,
  withPairs,
} from './plates'
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
    expect(isBarbellLift('latpulldown')).toBe(false)
    expect(isBarbellLift('squat')).toBe(true)
    expect(isBarbellLift('row')).toBe(true)
  })
})
