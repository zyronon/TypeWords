import { describe, expect, it } from 'vitest'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import type { TaskWords } from '@typewords/core/types/types.ts'
import { addRandomReviewWhenNoDue } from '../../apps/nuxt/app/composables/practice-words/study-task-v2.ts'

const word = (value: string) => ({ ...getDefaultWord(), word: value })

function createTask(review: string[] = []): TaskWords {
  return {
    new: [word('new-word')],
    review: review.map(word),
  }
}

const options = {
  words: ['one', 'two', 'three', 'ignored', 'new-word'].map(word),
  lastLearnIndex: 5,
  perDayStudyNumber: 2,
  wordReviewRatio: 1,
  ignoreSet: new Set(['ignored']),
  enabled: true,
}

describe('v2 study task random review supplement', () => {
  it('does not supplement when due reviews exist', () => {
    const result = addRandomReviewWhenNoDue(createTask(['due']), options)

    expect(result.dueReviewCount).toBe(1)
    expect(result.randomReviewCount).toBe(0)
    expect(result.taskWords.review.map(item => item.word)).toEqual(['due'])
  })

  it('does not supplement when the preference is disabled', () => {
    const result = addRandomReviewWhenNoDue(createTask(), { ...options, enabled: false })

    expect(result.dueReviewCount).toBe(0)
    expect(result.randomReviewCount).toBe(0)
    expect(result.taskWords.review).toEqual([])
  })

  it('uses the review ratio and excludes new and ignored words', () => {
    const result = addRandomReviewWhenNoDue(createTask(), options)
    const selected = result.taskWords.review.map(item => item.word)

    expect(result.dueReviewCount).toBe(0)
    expect(result.randomReviewCount).toBe(2)
    expect(selected).toHaveLength(2)
    expect(new Set(selected).size).toBe(2)
    expect(selected).not.toContain('new-word')
    expect(selected).not.toContain('ignored')
    expect(selected.every(item => ['one', 'two', 'three'].includes(item))).toBe(true)
  })

  it('returns the available count when candidates are insufficient', () => {
    const result = addRandomReviewWhenNoDue(createTask(), {
      ...options,
      words: [word('only'), word('ignored')],
      lastLearnIndex: 2,
      perDayStudyNumber: 10,
    })

    expect(result.randomReviewCount).toBe(1)
    expect(result.taskWords.review.map(item => item.word)).toEqual(['only'])
  })
})
