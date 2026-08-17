import type { PracticeSpellingMistake } from '@/core/types/types.ts'

export interface FreePracticeSummaryWord {
  word: string
  count: number
}

export interface FreePracticeSpellingPattern {
  key: string
  word: string
  label: string
  detail: string
  count: number
  mode: PracticeSpellingMistake['mode']
}

export interface FreePracticeSpellingWordGroup {
  word: string
  totalCount: number
  patterns: FreePracticeSpellingPattern[]
}

export interface FreePracticeSummary {
  threshold: number
  totalMistakes: number
  wrongWords: FreePracticeSummaryWord[]
  spellingPatterns: FreePracticeSpellingPattern[]
  spellingWordGroups: FreePracticeSpellingWordGroup[]
}

export interface FreePracticeSummaryDocumentInfo {
  dictName: string
  startedAt: string
  duration: string
  totalWords: number
  newWords: number
  reviewWords: number
}

function normalizeThreshold(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
}

function displayCharacter(value?: string): string {
  if (!value) return '空'
  return value === ' ' ? '空格' : value
}

function findSingleDeletion(expected: string, actual: string): number {
  if (expected.length !== actual.length + 1) return -1
  for (let index = 0; index < expected.length; index++) {
    if (expected.slice(0, index) + expected.slice(index + 1) === actual) return index
  }
  return -1
}

function findSingleInsertion(expected: string, actual: string): number {
  if (actual.length !== expected.length + 1) return -1
  for (let index = 0; index < actual.length; index++) {
    if (actual.slice(0, index) + actual.slice(index + 1) === expected) return index
  }
  return -1
}

/** 将一次完整误拼转换为可读的主要差异，不参与复习调度。 */
export function describeWholeWordMistake(expected: string, actual: string): string {
  if (!actual) return '未输入内容'

  if (expected.length === actual.length) {
    const differentIndexes = [...expected]
      .map((character, index) => (character === actual[index] ? -1 : index))
      .filter(index => index >= 0)

    if (
      differentIndexes.length === 2 &&
      differentIndexes[1] === differentIndexes[0] + 1 &&
      expected[differentIndexes[0]] === actual[differentIndexes[1]] &&
      expected[differentIndexes[1]] === actual[differentIndexes[0]]
    ) {
      const start = differentIndexes[0]
      return `第 ${start + 1}-${start + 2} 位字母颠倒：${expected.slice(start, start + 2)} → ${actual.slice(start, start + 2)}`
    }

    if (differentIndexes.length > 0 && differentIndexes.length <= 3) {
      return differentIndexes
        .map(index => `第 ${index + 1} 位 ${displayCharacter(expected[index])} → ${displayCharacter(actual[index])}`)
        .join('；')
    }
  }

  const deletionIndex = findSingleDeletion(expected, actual)
  if (deletionIndex >= 0) {
    return `漏写第 ${deletionIndex + 1} 位字母 ${displayCharacter(expected[deletionIndex])}`
  }

  const insertionIndex = findSingleInsertion(expected, actual)
  if (insertionIndex >= 0) {
    return `第 ${insertionIndex + 1} 位多写字母 ${displayCharacter(actual[insertionIndex])}`
  }

  return `拼写为“${actual}”`
}

function getPatternIdentity(mistake: PracticeSpellingMistake): { key: string; label: string; detail: string } {
  if (mistake.mode === 'instant') {
    const position = Math.max(0, Number(mistake.position ?? 0))
    const expectedCharacter = displayCharacter(mistake.expectedCharacter)
    const actualCharacter = displayCharacter(mistake.actualCharacter)
    const detail = `第 ${position + 1} 位 ${expectedCharacter} → ${actualCharacter}`
    return {
      key: ['instant', mistake.word, position, expectedCharacter, actualCharacter].join('\u0000'),
      label: `${mistake.word}：${detail}`,
      detail,
    }
  }

  const detail = `${mistake.actual || '（空）'}（${describeWholeWordMistake(mistake.expected, mistake.actual)}）`
  return {
    key: ['wholeWord', mistake.word, mistake.actual].join('\u0000'),
    label: `${mistake.word} → ${detail}`,
    detail,
  }
}

export function buildFreePracticeSummary(
  mistakes: PracticeSpellingMistake[] | null | undefined,
  thresholdValue: number
): FreePracticeSummary {
  const safeMistakes = Array.isArray(mistakes) ? mistakes.filter(item => !!item?.word) : []
  const threshold = normalizeThreshold(thresholdValue)
  const wordCountMap = new Map<string, number>()
  const patternMap = new Map<string, FreePracticeSpellingPattern>()

  for (const mistake of safeMistakes) {
    wordCountMap.set(mistake.word, (wordCountMap.get(mistake.word) ?? 0) + 1)
    const identity = getPatternIdentity(mistake)
    const pattern = patternMap.get(identity.key)
    if (pattern) {
      pattern.count++
    } else {
      patternMap.set(identity.key, {
        key: identity.key,
        word: mistake.word,
        label: identity.label,
        detail: identity.detail,
        count: 1,
        mode: mistake.mode,
      })
    }
  }

  const sortByCount = <T extends { count: number; word: string }>(a: T, b: T) =>
    b.count - a.count || a.word.localeCompare(b.word)
  const spellingPatterns = Array.from(patternMap.values()).sort(sortByCount)
  const spellingWordGroupMap = new Map<string, FreePracticeSpellingWordGroup>()

  for (const pattern of spellingPatterns) {
    const group = spellingWordGroupMap.get(pattern.word)
    if (group) {
      group.totalCount += pattern.count
      group.patterns.push(pattern)
    } else {
      spellingWordGroupMap.set(pattern.word, {
        word: pattern.word,
        totalCount: pattern.count,
        patterns: [pattern],
      })
    }
  }

  const spellingWordGroups = Array.from(spellingWordGroupMap.values())
    .map(group => ({
      ...group,
      patterns: group.patterns.sort((a, b) => b.count - a.count || a.detail.localeCompare(b.detail)),
    }))
    .sort((a, b) => b.totalCount - a.totalCount || a.word.localeCompare(b.word))

  return {
    threshold,
    totalMistakes: safeMistakes.length,
    wrongWords: Array.from(wordCountMap, ([word, count]) => ({ word, count }))
      .filter(item => item.count >= threshold)
      .sort(sortByCount),
    spellingPatterns,
    spellingWordGroups,
  }
}

function textList(lines: string[], emptyText: string): string[] {
  return lines.length ? lines.map(line => `- ${line}`) : [`- ${emptyText}`]
}

export function renderFreePracticeSummaryText(
  summary: FreePracticeSummary,
  info: FreePracticeSummaryDocumentInfo
): string {
  const wrongWordLines = summary.wrongWords.map(item => `${item.word}：${item.count} 次`)
  const patternLines = summary.spellingWordGroups.flatMap(group => [
    `- ${group.word}（共 ${group.totalCount} 次）`,
    ...group.patterns.map(item => `  - ${item.detail}：${item.count} 次`),
  ])

  return [
    '自由练习总结',
    '',
    `词典：${info.dictName}`,
    `开始时间：${info.startedAt}`,
    `练习时长：${info.duration}`,
    `练习词数：${info.totalWords}（新词 ${info.newWords}，复习 ${info.reviewWords}）`,
    `拼写错误总次数：${summary.totalMistakes}`,
    `错词筛选条件：错误次数 ≥ ${summary.threshold}`,
    '',
    `错误达到 ${summary.threshold} 次的单词`,
    ...textList(wrongWordLines, '无'),
    '',
    '常见拼写错误',
    ...(patternLines.length ? patternLines : ['- 无']),
    '',
  ].join('\n')
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

export function renderFreePracticeSummaryMarkdown(
  summary: FreePracticeSummary,
  info: FreePracticeSummaryDocumentInfo
): string {
  const lines = [
    '# 自由练习总结',
    '',
    `- 词典：${info.dictName}`,
    `- 开始时间：${info.startedAt}`,
    `- 练习时长：${info.duration}`,
    `- 练习词数：${info.totalWords}（新词 ${info.newWords}，复习 ${info.reviewWords}）`,
    `- 拼写错误总次数：${summary.totalMistakes}`,
    `- 错词筛选条件：错误次数 ≥ ${summary.threshold}`,
    '',
    `## 错误达到 ${summary.threshold} 次的单词`,
    '',
  ]

  if (summary.wrongWords.length) {
    lines.push('| 单词 | 错误次数 |', '| --- | ---: |')
    summary.wrongWords.forEach(item => lines.push(`| ${escapeMarkdownCell(item.word)} | ${item.count} |`))
  } else {
    lines.push('无。')
  }

  lines.push('', '## 常见拼写错误', '')
  if (summary.spellingWordGroups.length) {
    summary.spellingWordGroups.forEach(group => {
      lines.push(`### ${escapeMarkdownCell(group.word)}（共 ${group.totalCount} 次）`, '')
      lines.push('| 错误形式 | 出现次数 |', '| --- | ---: |')
      group.patterns.forEach(item => lines.push(`| ${escapeMarkdownCell(item.detail)} | ${item.count} |`))
      lines.push('')
    })
  } else {
    lines.push('无。')
  }
  lines.push('')
  return lines.join('\n')
}
