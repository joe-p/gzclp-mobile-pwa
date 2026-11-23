import { describe, expect, it } from 'vitest'
import { e1rmForStage } from './onerm'

describe('e1rmForStage', () => {
  it('uses the rep target of the current T1 stage', () => {
    expect(e1rmForStage(135, 'T1', 0)).toBe(149)
    expect(e1rmForStage(135, 'T1', 1)).toBe(144)
    expect(e1rmForStage(135, 'T1', 2)).toBe(135)
  })

  it('uses the rep target of the current T2 stage', () => {
    expect(e1rmForStage(100, 'T2', 0)).toBe(133)
    expect(e1rmForStage(100, 'T2', 1)).toBe(127)
    expect(e1rmForStage(100, 'T2', 2)).toBe(120)
  })

  it('clamps out-of-range stages to the nearest scheme', () => {
    expect(e1rmForStage(135, 'T1', 99)).toBe(135)
    expect(e1rmForStage(100, 'T2', -1)).toBe(133)
  })

  it('has no estimate for T3 or invalid weights', () => {
    expect(e1rmForStage(50, 'T3', 0)).toBeNull()
    expect(e1rmForStage(0, 'T1', 0)).toBeNull()
  })
})
