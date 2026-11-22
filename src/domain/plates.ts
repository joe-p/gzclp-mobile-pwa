import type { LiftDefinition, PlateInventory, PlateStack } from './types'
import { roundToIncrement } from './units'

/** Plate sizes in pounds that the inventory editor exposes, heaviest first. */
export const STANDARD_PLATE_SIZES: readonly number[] = [45, 35, 25, 10, 5, 2.5]

/** Common bar weights in pounds. */
export const BAR_CHOICES: readonly number[] = [45, 35, 25]

/** Upper bound for the editor's pair steppers. */
export const MAX_PLATE_PAIRS = 20

/**
 * Default to a well-stocked commercial gym: enough 45s for a pair per side,
 * a spare 25 pair, and small plates down to 2.5 lb.
 */
const DEFAULT_PAIR_COUNTS: readonly (readonly [number, number])[] = [
  [45, 2],
  [35, 1],
  [25, 2],
  [10, 2],
  [5, 1],
  [2.5, 1],
]

export function defaultPlateInventory(): PlateInventory {
  return {
    bar: 45,
    plates: DEFAULT_PAIR_COUNTS.map(([size, pairs]) => ({ size, pairs })),
  }
}

/** Custom accessories default to machine/other until marked as barbell-loaded. */
export function isBarbellLift(lift: LiftDefinition | undefined): boolean {
  return lift?.barbell === true
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clampPairs(pairs: number): number {
  if (!Number.isFinite(pairs)) return 0
  return Math.min(MAX_PLATE_PAIRS, Math.max(0, Math.trunc(pairs)))
}

/**
 * Cleans up stored/imported inventory: positive plate sizes, deduplicated,
 * ordered heaviest-first, with every standard size present so the editor
 * always has a row to render. Missing standard sizes mean "not owned".
 */
export function normalizePlateInventory(input: PlateInventory | null | undefined): PlateInventory {
  if (!input) return defaultPlateInventory()

  const bar = Number.isFinite(input.bar) ? Math.min(500, Math.max(0, roundToIncrement(input.bar))) : 45
  const pairsBySize = new Map<number, number>()

  for (const plate of input.plates) {
    if (!plate || !Number.isFinite(plate.size) || plate.size <= 0) continue
    const size = round2(plate.size)
    pairsBySize.set(size, Math.max(pairsBySize.get(size) ?? 0, clampPairs(plate.pairs)))
  }

  const sizes = Array.from(new Set([...STANDARD_PLATE_SIZES, ...pairsBySize.keys()])).sort(
    (a, b) => b - a,
  )

  return {
    bar,
    plates: sizes.map((size) => ({ size, pairs: pairsBySize.get(size) ?? 0 })),
  }
}

export interface PlateLoad {
  bar: number
  /** Weight that should hang on each side of the bar. */
  targetPerSide: number
  /** Plate sizes for one side, heaviest first. */
  perSide: number[]
  perSideWeight: number
  /** Bar plus both sides — the weight actually on the bar. */
  loadedWeight: number
  exact: boolean
  /** Pounds per side that could not be loaded. */
  shortPerSide: number
  /** Working weight is lighter than the bar itself. */
  belowBar: boolean
}

/**
 * Finds the best plate combination for one side of the bar. A dynamic program
 * over the available pairs (rather than a greedy pick) matters once counts are
 * limited: with one 45, one 35 and one 25 pair, 60 lb per side is 35 + 25 even
 * though greedy would stop at 45.
 */
export function computePlateLoad(weight: number, inventory: PlateInventory): PlateLoad {
  const { bar, plates } = normalizePlateInventory(inventory)
  const available = plates.filter((plate) => plate.pairs > 0)
  const targetPerSide = round2((weight - bar) / 2)

  if (!Number.isFinite(weight) || weight <= bar) {
    return {
      bar,
      targetPerSide: Math.max(0, targetPerSide),
      perSide: [],
      perSideWeight: 0,
      loadedWeight: bar,
      exact: weight === bar,
      shortPerSide: Math.max(0, targetPerSide),
      belowBar: weight < bar,
    }
  }

  // sum (per side) -> plate sizes used. Keeping only the fewest-plates option
  // for each sum is safe because the remaining sizes are processed afterwards.
  let states = new Map<number, number[]>()
  states.set(0, [])

  for (const plate of available) {
    const next = new Map(states)
    for (const [sum, used] of states) {
      for (let count = 1; count <= plate.pairs; count++) {
        const nextSum = round2(sum + plate.size * count)
        if (nextSum > targetPerSide + 0.01) break
        const candidate = [...used, ...Array<number>(count).fill(plate.size)]
        const existing = next.get(nextSum)
        if (!existing || candidate.length < existing.length) next.set(nextSum, candidate)
      }
    }
    states = next
  }

  let perSide: number[] = []
  let perSideWeight = 0
  for (const [sum, used] of states) {
    if (sum > perSideWeight + 0.01 || (Math.abs(sum - perSideWeight) <= 0.01 && used.length < perSide.length)) {
      perSide = used
      perSideWeight = sum
    }
  }

  return {
    bar,
    targetPerSide,
    perSide,
    perSideWeight,
    loadedWeight: round2(bar + perSideWeight * 2),
    exact: perSideWeight >= targetPerSide - 0.01,
    shortPerSide: round2(Math.max(0, targetPerSide - perSideWeight)),
    belowBar: false,
  }
}

/** Total pounds of plates owned (both sides). */
export function totalPlateWeight(inventory: PlateInventory): number {
  return normalizePlateInventory(inventory).plates.reduce(
    (total, plate) => total + plate.size * plate.pairs * 2,
    0,
  )
}

export function pairsFor(inventory: PlateInventory, size: number): number {
  return inventory.plates.find((plate) => Math.abs(plate.size - size) < 0.01)?.pairs ?? 0
}

export function withPairs(inventory: PlateInventory, size: number, pairs: number): PlateInventory {
  const key = round2(size)
  const nextPairs = clampPairs(pairs)
  const exists = inventory.plates.some((plate) => Math.abs(plate.size - key) < 0.01)
  const plates: PlateStack[] = exists
    ? inventory.plates.map((plate) => (Math.abs(plate.size - key) < 0.01 ? { ...plate, pairs: nextPairs } : plate))
    : [...inventory.plates, { size: key, pairs: nextPairs }]
  return normalizePlateInventory({ ...inventory, plates })
}
