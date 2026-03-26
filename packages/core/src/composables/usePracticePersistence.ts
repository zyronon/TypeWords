import { useBaseStore } from '../stores/base.ts'
import type { PracticeData, TaskWords, Word } from '../types'
import type {
  PracticeArticleCache,
  PracticeWordCache,
  PracticeWordCacheCompact,
  PracticeWordCacheStored,
} from '../utils/cache'
import {
  getPracticeArticleCacheLocal,
  getPracticeWordCacheLocal,
} from '../utils/cache'
import { useDataSyncPersistence } from './useDataSyncPersistence'

function isCompactPracticeWordCache(data: PracticeWordCacheStored | null): data is PracticeWordCacheCompact {
  return !!data && 'taskWordsStr' in data
}

function createWordMap(): Map<string, Word> {
  const store = useBaseStore()
  return new Map(store.sdict.words.map(word => [word.word, word]))
}

function restoreWords(words: string[], wordMap: Map<string, Word>): Word[] {
  return words.map(word => wordMap.get(word)).filter((word): word is Word => !!word)
}

function serializePracticeWordCache(data: PracticeWordCache | null): PracticeWordCacheStored | null {
  if (!data) return null
  const { words, wrongWords, ...practiceDataRest } = data.practiceData
  return {
    taskWordsStr: {
      new: data.taskWords.new.map(v => v.word),
      review: data.taskWords.review.map(v => v.word),
    },
    practiceData: {
      ...practiceDataRest,
      wordsStr: words.map(v => v.word),
      wrongWordsStr: wrongWords.map(v => v.word),
    },
    statStoreData: data.statStoreData,
  }
}

function restorePracticeWordCache(data: PracticeWordCacheStored | null): PracticeWordCache | null {
  if (!data) return null
  if (!isCompactPracticeWordCache(data)) {
    if (!data.taskWords?.new.length && !data.taskWords?.review.length) return null
    return data
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

  const practiceData: PracticeData = {
    ...data.practiceData,
    index,
    words,
    wrongWords,
  }
  return {
    taskWords,
    practiceData,
    statStoreData: data.statStoreData,
  }
}

export function usePracticeWordPersistence() {
  const dataSync = useDataSyncPersistence()

  async function load(): Promise<PracticeWordCache | null> {
    const res = await fetch()
    return res ?? restorePracticeWordCache(getPracticeWordCacheLocal())
  }

  async function fetch(): Promise<PracticeWordCache | null> {
    const remote = await dataSync.pullIfRemoteNewer('practice_word')
    if (remote) {
      const remoteData = remote?.data as PracticeWordCacheStored
      return restorePracticeWordCache(remoteData)
    }
    return null
  }

  async function getLocalDataCompact(): Promise<PracticeWordCacheStored | null> {
    return getPracticeWordCacheLocal()
  }

  async function save(data: PracticeWordCache | null) {
    const compactData = serializePracticeWordCache(data)
    await dataSync.saveLocalAndSync('practice_word', compactData)
  }

  async function clear() {
    await dataSync.saveLocalAndSync('practice_word', null)
  }

  return { load, save, clear, fetch, getLocalDataCompact }
}

export function usePracticeArticlePersistence() {
  const dataSync = useDataSyncPersistence()

  async function load(): Promise<PracticeArticleCache | null> {
    const res = await fetch()
    return res ?? getPracticeArticleCacheLocal()
  }

  async function getLocalDataCompact(): Promise<PracticeArticleCache | null> {
    return getPracticeArticleCacheLocal()
  }

  async function fetch(): Promise<PracticeArticleCache | null> {
    const remote = await dataSync.pullIfRemoteNewer('practice_article')
    if (remote) {
      const remoteData = remote?.data as PracticeArticleCache
      return remoteData
    }
    return null
  }

  async function save(data: PracticeArticleCache | null): Promise<void> {
    await dataSync.saveLocalAndSync('practice_article', data ?? null)
  }

  async function clear() {
    await dataSync.saveLocalAndSync('practice_article', null)
  }

  return { load, save, clear, fetch, getLocalDataCompact }
}
