import { describe, expect, it } from 'vitest'
import {
  buildFreePracticeSummary,
  describeWholeWordMistake,
  renderFreePracticeSummaryMarkdown,
  renderFreePracticeSummaryText,
} from '../../app/core/composables/practice-words/practice-summary.ts'
import type { PracticeSpellingMistake } from '../../app/core/types/types.ts'

describe('free practice summary', () => {
  const mistakes: PracticeSpellingMistake[] = [
    { word: 'receive', expected: 'receive', actual: 'recieve', mode: 'wholeWord' },
    { word: 'receive', expected: 'receive', actual: 'recieve', mode: 'wholeWord' },
    { word: 'receive', expected: 'receive', actual: 'receve', mode: 'wholeWord' },
    {
      word: 'book',
      expected: 'book',
      actual: 'bk',
      mode: 'instant',
      position: 1,
      expectedCharacter: 'o',
      actualCharacter: 'k',
    },
  ]

  it('filters words by an inclusive threshold and aggregates spelling patterns', () => {
    const summary = buildFreePracticeSummary(mistakes, 2)

    expect(summary.totalMistakes).toBe(4)
    expect(summary.wrongWords).toEqual([{ word: 'receive', count: 3 }])
    expect(summary.spellingPatterns[0]).toMatchObject({
      word: 'receive',
      count: 2,
      mode: 'wholeWord',
    })
    expect(summary.spellingPatterns[0].label).toContain('字母颠倒')
    expect(summary.spellingWordGroups[0]).toMatchObject({
      word: 'receive',
      totalCount: 3,
    })
    expect(summary.spellingWordGroups[0].patterns).toHaveLength(2)
  })

  it('describes common single-edit mistakes', () => {
    expect(describeWholeWordMistake('word', 'wrd')).toContain('漏写')
    expect(describeWholeWordMistake('word', 'woard')).toContain('多写')
    expect(describeWholeWordMistake('the', 'teh')).toContain('字母颠倒')
    expect(describeWholeWordMistake('book', 'back')).toContain('第 2 位')
  })

  it('renders complete TXT and Markdown exports', () => {
    const summary = buildFreePracticeSummary(mistakes, 2)
    const info = {
      dictName: '测试词典',
      startedAt: '2026-08-17 10:00:00',
      duration: '5分钟',
      totalWords: 10,
      newWords: 7,
      reviewWords: 3,
    }

    const text = renderFreePracticeSummaryText(summary, info)
    const markdown = renderFreePracticeSummaryMarkdown(summary, info)

    expect(text).toContain('错误达到 2 次的单词')
    expect(text).toContain('receive：3 次')
    expect(markdown).toContain('# 自由练习总结')
    expect(markdown).toContain('| receive | 3 |')
    expect(markdown).toContain('### receive（共 3 次）')
    expect(markdown).toContain('recieve')
  })

  it('keeps every word in exports so the UI can independently limit itself to ten groups', () => {
    const manyMistakes: PracticeSpellingMistake[] = Array.from({ length: 11 }, (_, index) => ({
      word: `word${index + 1}`,
      expected: `word${index + 1}`,
      actual: `ward${index + 1}`,
      mode: 'wholeWord',
    }))
    const summary = buildFreePracticeSummary(manyMistakes, 1)
    const info = {
      dictName: '测试词典',
      startedAt: '2026-08-17 10:00:00',
      duration: '5分钟',
      totalWords: 11,
      newWords: 11,
      reviewWords: 0,
    }

    expect(summary.spellingWordGroups).toHaveLength(11)
    expect(renderFreePracticeSummaryText(summary, info)).toContain('word11')
    expect(renderFreePracticeSummaryMarkdown(summary, info)).toContain('### word11')
  })
})
