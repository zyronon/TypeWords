import type { Word } from '@/core/types/types.ts'

/** 从词典 phrase 标签解析学科，如 "[阅读·考古]" → "阅读·考古" */
export function getWordSubjects(word: Word): string[] {
  const out: string[] = []
  for (const ph of word.phrases || []) {
    const c = ph.c || ''
    if (c.startsWith('[') && c.endsWith(']')) {
      const tag = c.slice(1, -1).trim()
      if (tag && !out.includes(tag)) out.push(tag)
    }
  }
  return out
}

export function listDictSubjects(words: Word[]): { tag: string; count: number }[] {
  const map = new Map<string, number>()
  for (const w of words) {
    for (const tag of getWordSubjects(w)) {
      map.set(tag, (map.get(tag) ?? 0) + 1)
    }
  }
  return Array.from(map, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)
}

/** subjects 为空表示不过滤；否则返回带任一所选学科标签的词 */
export function filterWordsBySubjects(words: Word[], subjects: string[]): Word[] {
  if (!subjects.length) return words.slice()
  const set = new Set(subjects)
  return words.filter(w => getWordSubjects(w).some(t => set.has(t)))
}
