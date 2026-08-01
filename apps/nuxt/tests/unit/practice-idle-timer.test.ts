import { describe, expect, it } from 'vitest'
import { canAutoResumeVisibilityTimer } from '../../app/composables/practice-words/usePracticeIdleTimer.ts'

describe('practice visibility timer resume', () => {
  it('only allows a pending callback to resume an auto-visibility pause', () => {
    expect(canAutoResumeVisibilityTimer({ timerPaused: true, timerPauseReason: 'auto_visibility' })).toBe(true)
    expect(canAutoResumeVisibilityTimer({ timerPaused: false, timerPauseReason: null })).toBe(false)
    expect(canAutoResumeVisibilityTimer({ timerPaused: true, timerPauseReason: 'manual' })).toBe(false)
  })
})
