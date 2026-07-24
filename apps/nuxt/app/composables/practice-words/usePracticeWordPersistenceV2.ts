import { useBaseStore } from '@typewords/core/stores/base.ts'
import type { PracticeData, TaskWords, Word } from '@typewords/core/types/types.ts'
import type { PracticeState } from '@typewords/core/stores/practice.ts'
import {
  getPracticeWordCacheV2Local,
  setPracticeWordCacheV2Local,
  type PracticeWordCacheCompactV2,
  type PracticeWordCacheStoredV2,
  type PracticeWordCacheV2,
  type PracticeDataV2,
} from './practice-word-cache-v2.ts'

function isCompactPracticeWordCache(data: PracticeWordCacheStoredV2 | null): data is PracticeWordCacheCompactV2 {
  return !!data && 'taskWordsStr' in data
}

function createWordMap(): Map<string, Word> {
  const store = useBaseStore()
  return new Map(store.sdict.words.map(word => [word.word, word]))
}

function restoreWords(words: string[], wordMap: Map<string, Word>): Word[] {
  return words.map(word => wordMap.get(word)).filter((word): word is Word => !!word)
}

function serializePracticeWordCache(data: PracticeWordCacheV2 | null): PracticeWordCacheStoredV2 | null {
  if (!data?.practiceData || !data.statStoreData) return data
  const { words, wrongWords, ...practiceDataRest } = data.practiceData
  return {
    taskWordsStr: {
      new: data.taskWords.new.map(v => v.word),
      review: data.taskWords.review.map(v => v.word),
    },
    practiceData: {
      ...practiceDataRest,
      wordsStr: (words ?? []).map(v => v.word),
      wrongWordsStr: (wrongWords ?? []).map(v => v.word),
    },
    statStoreData: data.statStoreData,
    sessionSnapshot: data.sessionSnapshot,
  }
}

function restorePracticeWordCache(data: PracticeWordCacheStoredV2 | null): PracticeWordCacheV2 | null {
  if (!data) return null
  if (!isCompactPracticeWordCache(data)) {
    if (!data.taskWords?.new.length && !data.taskWords?.review.length) return null
    if (!data.practiceData) return data
    const { isTypingWrongWord: _legacyWrongWordState, ...practiceData } = data.practiceData as PracticeDataV2 &
      Partial<Pick<PracticeData, 'isTypingWrongWord'>>
    return { ...data, practiceData }
  }
  if (!data.taskWordsStr?.new.length && !data.taskWordsStr?.review.length) return null
  const wordMap = createWordMap()
  const taskWords: TaskWords = {
    new: restoreWords(data.taskWordsStr.new, wordMap),
    review: restoreWords(data.taskWordsStr.review, wordMap),
  }

  const words = restoreWords(data.practiceData?.wordsStr ?? [], wordMap)
  const wrongWords = restoreWords(data.practiceData?.wrongWordsStr ?? [], wordMap)
  const index = words.length ? Math.min(data.practiceData.index, words.length - 1) : 0

  const { isTypingWrongWord: _legacyWrongWordState, ...practiceDataRest } = data.practiceData as typeof data.practiceData &
    Partial<Pick<PracticeData, 'isTypingWrongWord'>>
  const practiceData: PracticeDataV2 = {
    ...practiceDataRest,
    index,
    words,
    wrongWords,
  }
  return {
    taskWords,
    practiceData,
    statStoreData: data.statStoreData,
    sessionSnapshot: data.sessionSnapshot,
  }
}

/**
 * v2 练习持久化：仅读写本地 `PracticeSaveWordV2`，不走 v1 云端同步。
 */
export function usePracticeWordPersistenceV2() {
  async function load(): Promise<PracticeWordCacheV2 | null> {
    return restorePracticeWordCache(await getPracticeWordCacheV2Local())
  }

  async function save(data: PracticeWordCacheV2 | null) {
    const compactData = serializePracticeWordCache(data)
    await setPracticeWordCacheV2Local(compactData)
  }

  async function clear() {
    await setPracticeWordCacheV2Local(null)
  }

  return { load, save, clear }
}
