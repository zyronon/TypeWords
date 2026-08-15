import { describe, expect, it } from 'vitest'
import {
  canAutoResumeVisibilityTimer,
  getIdlePauseTime,
  normalizePracticeTimer,
} from '@/core/composables/practice-words/usePracticeIdleTimer.ts'

describe('practice visibility timer resume', () => {
  it('only allows a pending callback to resume an auto-visibility pause', () => {
    expect(canAutoResumeVisibilityTimer({ timerPaused: true, timerPauseReason: 'auto_visibility' })).toBe(true)
    expect(canAutoResumeVisibilityTimer({ timerPaused: false, timerPauseReason: null })).toBe(false)
    expect(canAutoResumeVisibilityTimer({ timerPaused: true, timerPauseReason: 'manual' })).toBe(false)
  })
})

describe('practice timer normalization', () => {
  it('closes a delayed idle pause at the idle deadline instead of wake-up time', () => {
    const start = Date.parse('2026-08-01T08:00:00+08:00')
    const wakeUp = start + 40 * 60 * 60 * 1000
    expect(getIdlePauseTime(start, wakeUp, 3 * 60 * 1000)).toBe(start + 3 * 60 * 1000)
  })

  it('limits a sleep-inflated segment using the interval spend', () => {
    const start = Date.parse('2026-08-01T08:00:00+08:00')
    const result = normalizePracticeTimer(
      [[start, start + 40 * 60 * 60 * 1000]],
      5 * 60 * 1000,
      start + 40 * 60 * 60 * 1000
    )
    expect(result.spend).toBeLessThanOrEqual(5 * 60 * 1000 + 2000)
  })

  it('merges overlapping segments before calculating spend', () => {
    const start = Date.parse('2026-08-01T08:00:00+08:00')
    const result = normalizePracticeTimer(
      [[start, start + 60_000], [start + 30_000, start + 90_000]],
      90_000,
      start + 90_000
    )
    expect(result.segments).toEqual([[start, start + 90_000]])
    expect(result.spend).toBe(90_000)
  })

  it('keeps legacy spend when the cache has no segments', () => {
    expect(normalizePracticeTimer([], 90_000)).toEqual({ segments: [], spend: 90_000 })
  })

  it('splits a segment at local midnight', () => {
    const start = new Date(2026, 7, 1, 23, 59, 0).getTime()
    const end = new Date(2026, 7, 2, 0, 1, 0).getTime()
    const midnight = new Date(2026, 7, 2, 0, 0, 0).getTime()
    const result = normalizePracticeTimer([[start, end]], 120_000, end)
    expect(result.segments).toEqual([[start, midnight], [midnight, end]])
    expect(result.spend).toBe(120_000)
  })
})
