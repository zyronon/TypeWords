/** V2 练习会话的数据结构、默认值和本地持久化。 */
import { useBaseStore } from '@typewords/core/stores/base.ts'
import type { PracticeState } from '@typewords/core/stores/practice.ts'
import type { PracticeData, Question, TaskWords, Word } from '@typewords/core/types/types.ts'
import { get, set } from 'idb-keyval'
import type { PracticeSessionSnapshot } from './practice-flow-types.ts'

/** V2 的流程位置由 Navigator Cursor 表达，不再保留 V1 的 isTypingWrongWord 镜像字段。 */
export type PracticeDataV2 = Omit<PracticeData, 'isTypingWrongWord' | 'question'> & {
  question: Question | null
}

export type PracticeWordCacheV2 = {
  taskWords: TaskWords
  practiceData?: PracticeDataV2
  statStoreData?: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}

type PracticeWordCacheCompactV2 = {
  taskWordsStr: {
    new: string[]
    review: string[]
  }
  practiceData: Omit<PracticeDataV2, 'words' | 'wrongWords'> & {
    wordsStr: string[]
    wrongWordsStr: string[]
  }
  statStoreData: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}

type PracticeWordCacheStoredV2 = PracticeWordCacheV2 | PracticeWordCacheCompactV2
type LocalCacheResult<T> = { val: T; updated_at?: string; version: number }

const PRACTICE_WORD_CACHE_V2 = {
  key: 'PracticeSaveWordV2',
  version: 1,
}

export function getDefaultPracticeData(
  origin?: Partial<PracticeDataV2>,
  val?: Partial<PracticeDataV2>
): PracticeDataV2 {
  // 旧版 V2 缓存可能仍带有 V1 字段，恢复时主动清除，避免继续持久化双状态。
  const target = (origin ?? {}) as Partial<PracticeData>
  const sanitizedVal = { ...(val ?? {}) } as Partial<PracticeData>
  delete target.isTypingWrongWord
  delete sanitizedVal.isTypingWrongWord

  return Object.assign(target, {
    index: 0,
    words: [],
    wrongWords: [],
    excludeWords: [],
    allWrongWords: [],
    wrongTimesMap: {},
    ratingMap: {},
    wrongTimes: 0,
    question: null,
    ...sanitizedVal,
  }) as PracticeDataV2
}

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

  return {
    taskWords,
    practiceData: {
      ...practiceDataRest,
      index,
      words,
      wrongWords,
    },
    statStoreData: data.statStoreData,
    sessionSnapshot: data.sessionSnapshot,
  }
}

async function getPracticeWordCacheLocal(): Promise<PracticeWordCacheStoredV2 | null> {
  const raw = await get(PRACTICE_WORD_CACHE_V2.key)
  if (!raw) return null

  let result: LocalCacheResult<PracticeWordCacheStoredV2>
  if (typeof raw === 'string') {
    try {
      result = JSON.parse(raw)
    } catch {
      return null
    }
  } else {
    result = raw
  }
  return result?.val && Object.keys(result.val).length > 0 ? result.val : null
}

async function setPracticeWordCacheLocal(cache: PracticeWordCacheStoredV2 | null): Promise<void> {
  const payload: LocalCacheResult<PracticeWordCacheStoredV2 | null> = {
    version: PRACTICE_WORD_CACHE_V2.version,
    val: cache,
    updated_at: new Date().toISOString(),
  }
  await set(PRACTICE_WORD_CACHE_V2.key, JSON.stringify(payload))
}

/** V2 练习持久化：仅读写本地 `PracticeSaveWordV2`，不走 V1 云端同步。 */
export function usePracticeWordPersistenceV2() {
  async function load(): Promise<PracticeWordCacheV2 | null> {
    return restorePracticeWordCache(await getPracticeWordCacheLocal())
  }

  async function save(data: PracticeWordCacheV2 | null) {
    await setPracticeWordCacheLocal(serializePracticeWordCache(data))
  }

  async function clear() {
    await setPracticeWordCacheLocal(null)
  }

  return { load, save, clear }
}
