import { describe, expect, it } from 'vitest'
import { parseRestTimer, REST_TIMER_TTL_SECONDS } from './restTimer'

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)

function timer(overrides: Record<string, unknown> = {}) {
  return { startedAt: NOW - 60_000, min: 180, max: 300, sessionId: 'session-1', ...overrides }
}

describe('parseRestTimer', () => {
  it('rejects payloads that are not timers', () => {
    expect(parseRestTimer(null, NOW)).toBeNull()
    expect(parseRestTimer('{"a":1}', NOW)).toBeNull()
    expect(parseRestTimer(timer({ sessionId: '' }), NOW)).toBeNull()
    expect(parseRestTimer(timer({ startedAt: 'now' }), NOW)).toBeNull()
    expect(parseRestTimer(timer({ min: undefined }), NOW)).toBeNull()
    expect(parseRestTimer(timer({ min: 0, max: 0 }), NOW)).toBeNull()
  })

  it('keeps the original start time and clocks time spent away', () => {
    const restored = parseRestTimer(timer(), NOW)
    expect(restored?.startedAt).toBe(NOW - 60_000)
    expect(restored?.sessionId).toBe('session-1')
    expect(restored?.min).toBe(180)
    expect(restored?.max).toBe(300)
  })

  it('recomputes whether rest is still blocking from the elapsed time', () => {
    expect(parseRestTimer(timer(), NOW)?.blocked).toBe(true)
    expect(parseRestTimer(timer({ startedAt: NOW - 180_000 }), NOW)?.blocked).toBe(false)
    expect(parseRestTimer(timer({ startedAt: NOW - 400_000 }), NOW)?.blocked).toBe(false)
  })

  it('drops timers that are too old to be worth resuming', () => {
    const fresh = timer({ startedAt: NOW - (REST_TIMER_TTL_SECONDS - 1) * 1000 })
    expect(parseRestTimer(fresh, NOW)).not.toBeNull()
    const stale = timer({ startedAt: NOW - (REST_TIMER_TTL_SECONDS + 1) * 1000 })
    expect(parseRestTimer(stale, NOW)).toBeNull()
  })

  it('drops timers started in the future by a clock change', () => {
    expect(parseRestTimer(timer({ startedAt: NOW + 60_000 }), NOW)).toBeNull()
  })

  it('clamps a hand-edited range instead of trusting it', () => {
    const restored = parseRestTimer(timer({ min: 5000, max: 9000 }), NOW)
    expect(restored?.min).toBe(900)
    expect(restored?.max).toBe(900)
  })
})
