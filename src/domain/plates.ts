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
  /** Plates added plus plates removed compared with the previously loaded stack. */
  changes: number
}

export interface PlateLoadOptions {
  /**
   * Plates already hanging on one side of the bar. The solver prefers to leave
   * them in place, so a session ramping 135 → 145 keeps the 45s and adds 5s
   * instead of stripping the bar for two 25s.
   */
  loaded?: readonly number[]
}

interface LoadState {
  /** Plate sizes used on one side, heaviest first. */
  used: number[]
  plates: number
  /** Running plate swaps against the loaded stack; see {@link plateChanges}. */
  changes: number
}

function countBySize(plates: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const size of plates) {
    if (!Number.isFinite(size) || size <= 0) continue
    const key = round2(size)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * How much handling a stack costs: plates to pull off plus plates to slide on.
 * For each size that is just the difference in how many of them hang per side.
 */
export function plateChanges(used: readonly number[], loaded: readonly number[]): number {
  const counts = countBySize(loaded)
  for (const size of used) {
    const key = round2(size)
    counts.set(key, (counts.get(key) ?? 0) - 1)
  }
  let total = 0
  for (const remaining of counts.values()) total += Math.abs(remaining)
  return total
}

/** Deterministic tie-break: prefer the stack that keeps the heaviest plates. */
function compareStacks(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index++) {
    const left = a[index] ?? -1
    const right = b[index] ?? -1
    if (left !== right) return left - right
  }
  return 0
}

function isBetter(candidate: LoadState, existing: LoadState): boolean {
  if (candidate.changes !== existing.changes) return candidate.changes < existing.changes
  if (candidate.plates !== existing.plates) return candidate.plates < existing.plates
  return compareStacks(candidate.used, existing.used) > 0
}

/**
 * Finds the best plate combination for one side of the bar. A dynamic program
 * over the available pairs (rather than a greedy pick) matters once counts are
 * limited: with one 45, one 35 and one 25 pair, 60 lb per side is 35 + 25 even
 * though greedy would stop at 45.
 *
 * Candidates are ranked by weight first, then by fewest plate changes against
 * `options.loaded`, then by fewest plates. Every size is decided exactly once
 * while walking the inventory, so the change cost is additive and the DP can
 * still keep a single best state per reachable sum.
 */
export function computePlateLoad(
  weight: number,
  inventory: PlateInventory,
  options: PlateLoadOptions = {},
): PlateLoad {
  const { bar, plates } = normalizePlateInventory(inventory)
  const available = plates.filter((plate) => plate.pairs > 0)
  const targetPerSide = round2((weight - bar) / 2)
  const loaded = options.loaded ?? []

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
      changes: plateChanges([], loaded),
    }
  }

  const loadedCounts = countBySize(loaded)
  // sum (per side) -> best stack for that sum. Keeping only the best option is
  // safe because the remaining sizes are processed afterwards and their change
  // cost only depends on the size being decided.
  let states = new Map<number, LoadState>()
  states.set(0, { used: [], plates: 0, changes: 0 })

  for (const plate of available) {
    const alreadyLoaded = loadedCounts.get(plate.size) ?? 0
    // Carrying a stack forward without this size means removing whatever of it
    // is on the bar, which costs the same as adding plates later. Every carried
    // state is registered before any candidate so a candidate for the same sum
    // still competes on merit instead of clobbering it.
    const carried = new Map<number, LoadState>()
    for (const [sum, state] of states) {
      carried.set(
        sum,
        alreadyLoaded === 0 ? state : { ...state, changes: state.changes + alreadyLoaded },
      )
    }
    const next = new Map(carried)
    // Candidates build on the uncharged state: their own |count - loaded| term
    // already prices this size, so reuse the pre-removal numbers.
    for (const [sum, state] of states) {
      for (let count = 1; count <= plate.pairs; count++) {
        const nextSum = round2(sum + plate.size * count)
        if (nextSum > targetPerSide + 0.01) break
        const candidate: LoadState = {
          used: [...state.used, ...Array<number>(count).fill(plate.size)],
          plates: state.plates + count,
          // Removals plus additions for this size: |used - already loaded|.
          changes: state.changes + Math.abs(count - alreadyLoaded),
        }
        const existing = next.get(nextSum)
        if (!existing || isBetter(candidate, existing)) next.set(nextSum, candidate)
      }
    }
    states = next
  }

  let best: LoadState = { used: [], plates: 0, changes: 0 }
  let perSideWeight = 0
  for (const [sum, state] of states) {
    const heavier = sum > perSideWeight + 0.01
    const asHeavy = Math.abs(sum - perSideWeight) <= 0.01
    if (heavier || (asHeavy && isBetter(state, best))) {
      best = state
      perSideWeight = sum
    }
  }

  return {
    bar,
    targetPerSide,
    perSide: best.used,
    perSideWeight,
    loadedWeight: round2(bar + perSideWeight * 2),
    exact: perSideWeight >= targetPerSide - 0.01,
    shortPerSide: round2(Math.max(0, targetPerSide - perSideWeight)),
    belowBar: false,
    // Recomputed against the full loaded stack so plates of sizes the inventory
    // no longer tracks still count as removals.
    changes: plateChanges(best.used, loaded),
  }
}

/**
 * Solves a whole ramp in order, each step starting from the plates the previous
 * one left on the bar. Use this for warmups plus work sets so the suggested
 * loading only ever adds plates as the weight climbs.
 */
export function computePlateLoadSequence(
  weights: readonly number[],
  inventory: PlateInventory,
  initial: readonly number[] = [],
): PlateLoad[] {
  let loaded: readonly number[] = initial
  return weights.map((weight) => {
    const load = computePlateLoad(weight, inventory, { loaded })
    loaded = load.perSide
    return load
  })
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
