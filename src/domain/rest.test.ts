import { describe, expect, it } from 'vitest'
import { clampRestSeconds, normalizeRestRange, restStatus } from './rest'

describe('rest ranges', () => {
  it('clamps seconds and keeps max at or above min', () => {
    expect(clampRestSeconds(-5)).toBe(0)
    expect(clampRestSeconds(120.9)).toBe(120)
    expect(clampRestSeconds(5000)).toBe(900)
    expect(normalizeRestRange({ min: 300, max: 180 })).toEqual({ min: 300, max: 300 })
    expect(normalizeRestRange({ min: 60, max: 90 })).toEqual({ min: 60, max: 90 })
  })

  it('reports blocked, ready, and max phases across the range', () => {
    expect(restStatus(180, 300, 0)).toMatchObject({ phase: 'blocked', toMin: 180, overtime: 0 })
    expect(restStatus(180, 300, 179)).toMatchObject({ phase: 'blocked', toMin: 1, progress: 179 / 300 })
    expect(restStatus(180, 300, 180)).toMatchObject({
      phase: 'ready',
      toMin: 0,
      toMax: 120,
      overtime: 0,
    })
    expect(restStatus(180, 300, 240)).toMatchObject({
      phase: 'ready',
      toMax: 60,
      overtime: 60,
    })
    expect(restStatus(180, 300, 300)).toMatchObject({
      phase: 'max',
      toMax: 0,
      overtime: 120,
      progress: 1,
    })
    expect(restStatus(180, 300, 360)).toMatchObject({ phase: 'max', overtime: 180, progress: 1 })
  })

  it('handles an immediate-warning range with no gap', () => {
    expect(restStatus(60, 60, 59)).toMatchObject({ phase: 'blocked', toMin: 1 })
    expect(restStatus(60, 60, 60)).toMatchObject({ phase: 'max', overtime: 0 })
  })
})
