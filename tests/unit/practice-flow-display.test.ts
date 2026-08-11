import { describe, expect, it } from 'vitest'
import { getPracticeFlowDisplayState } from '../../app/core/composables/practice-words/practice-flow-display.ts'
import { BUILTIN_FLOWS } from '../../app/core/composables/practice-words/practice-flow-config.ts'

describe('practice flow display model', () => {
  it('renders a single progress bar for a one-step flow', () => {
    const state = getPracticeFlowDisplayState({
      config: BUILTIN_FLOWS.free,
      cursor: { nodeIndex: 0, stepIndex: 0, inWrongWordClear: false, loop: null, endActionIndex: null },
      wordIndex: 2,
      wordCount: 4,
    })
    expect(state.status).toBe('free_practice')
    expect(state.stages).toEqual([{ name: '', ratio: 100, percentage: 50, active: true }])
    expect(state.showSkipStep).toBe(false)
  })

  it('expands the active node into step progress', () => {
    const state = getPracticeFlowDisplayState({
      config: BUILTIN_FLOWS.system,
      cursor: { nodeIndex: 0, stepIndex: 1, inWrongWordClear: false, loop: null, endActionIndex: null },
      wordIndex: 1,
      wordCount: 4,
      translate: key => `t:${key}`,
    })
    expect(state.status).toBe('t:new_words · t:listen')
    expect(state.stages[0].ratio).toBe(70)
    expect(state.stages[0].children?.map(item => item.percentage)).toEqual([100, 25, 0])
    expect(state.showSkipStep).toBe(true)
  })

  it('exposes loop and wrong-clear status', () => {
    const base = { nodeIndex: 0, stepIndex: 0, endActionIndex: null }
    expect(
      getPracticeFlowDisplayState({
        config: BUILTIN_FLOWS.system,
        cursor: { ...base, inWrongWordClear: false, loop: { startIndex: 0, endIndex: 6, subStepIndex: 0 } },
        wordIndex: 0,
        wordCount: 7,
      }).status
    ).toBe('小组巩固')
    expect(
      getPracticeFlowDisplayState({
        config: BUILTIN_FLOWS.system,
        cursor: { ...base, inWrongWordClear: true, loop: null },
        wordIndex: 0,
        wordCount: 7,
        translate: key => `t:${key}`,
      }).status
    ).toBe('t:review_wrong_words')
  })
})
