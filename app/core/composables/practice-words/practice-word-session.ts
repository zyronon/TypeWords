import { useBaseStore } from '@/core/stores/base.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import type { PracticeState } from '@/core/stores/practice.ts'
import type { PracticeData as LegacyPracticeData, Question, TaskWords, Word } from '@/core/types/types.ts'
import { CompareResult, SyncDataType } from '@/core/types/enum.ts'
import {
  checkAndUpgradePracticeWordCache,
  getPracticeWordCacheLocalWithMeta,
  PRACTICE_WORD_CACHE,
  type LocalCacheResult,
  type PracticeWordCacheStored,
} from '@/core/utils/cache.ts'
import { useDataSyncPersistence } from '@/core/composables/useDataSyncPersistence.ts'
import { shouldFetchRemote } from '@/core/utils/index.ts'
import type { PracticeSessionSnapshot } from './practice-flow-types.ts'

export type PracticeData = Omit<LegacyPracticeData, 'isTypingWrongWord' | 'question'> & {
  question: Question | null
}

export type PracticeWordCache = {
  taskWords: TaskWords
  practiceData?: PracticeData
  statStoreData?: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}

export type PracticeWordCacheCompact = {
  taskWordsStr: { new: string[]; review: string[] }
  practiceData?: Omit<PracticeData, 'words' | 'wrongWords'> & {
    wordsStr: string[]
    wrongWordsStr: string[]
  }
  statStoreData?: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}

export class UnsupportedPracticeCacheVersionError extends Error {
  constructor(public readonly version: number) {
    super(`UNSUPPORTED_PRACTICE_CACHE_VERSION:${version}`)
  }
}

export function addWrongWordKey(target: string[], word: string): boolean {
  if (!word || target.includes(word)) return false
  target.push(word)
  return true
}

export function resolveNewerRemotePracticeCacheTime(
  meta: { data_version?: number; updated_at?: string } | null,
  knownUpdatedAt: number
): number | null {
  if (!meta) return null
  const version = meta.data_version ?? 1
  if (version > PRACTICE_WORD_CACHE.version) {
    throw new UnsupportedPracticeCacheVersionError(version)
  }
  if (version !== PRACTICE_WORD_CACHE.version) return null
  const remoteUpdatedAt = Date.parse(meta.updated_at ?? '')
  return Number.isFinite(remoteUpdatedAt) && remoteUpdatedAt > knownUpdatedAt ? remoteUpdatedAt : null
}

export function getDefaultPracticeData(origin?: Partial<PracticeData>, val?: Partial<PracticeData>): PracticeData {
  return Object.assign(origin ?? {}, {
    index: 0,
    words: [],
    wrongWords: [],
    excludeWords: [],
    allWrongWords: [],
    wrongTimesMap: {},
    ratingMap: {},
    wrongTimes: 0,
    question: null,
    ...val,
  }) as PracticeData
}

function createWordMap(): Map<string, Word> {
  const store = useBaseStore()
  return new Map(store.sdict.words.map(word => [word.word, word]))
}

function restoreWords(words: unknown, wordMap: Map<string, Word>): Word[] {
  if (!Array.isArray(words)) return []
  return words
    .map(word => (typeof word === 'string' ? wordMap.get(word) : undefined))
    .filter((word): word is Word => !!word)
}

function serializePracticeWordCache(data: PracticeWordCache | null): PracticeWordCacheCompact | null {
  if (!data) return null
  const taskWordsStr = {
    new: data.taskWords.new.map(word => word.word),
    review: data.taskWords.review.map(word => word.word),
  }
  if (!data.practiceData && !data.statStoreData && !data.sessionSnapshot) return { taskWordsStr }
  if (!data.practiceData || !data.statStoreData || !data.sessionSnapshot) return null
  const { words, wrongWords, ...practiceData } = data.practiceData
  return {
    taskWordsStr,
    practiceData: {
      ...practiceData,
      wordsStr: words.map(word => word.word),
      wrongWordsStr: wrongWords.map(word => word.word),
    },
    statStoreData: data.statStoreData,
    sessionSnapshot: data.sessionSnapshot,
  }
}

function isCurrentSnapshot(value: unknown): value is PracticeSessionSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as PracticeSessionSnapshot
  const cursor = snapshot.cursor
  return (
    typeof snapshot.flowId === 'string' &&
    !!cursor &&
    Number.isInteger(cursor.nodeIndex) &&
    cursor.nodeIndex >= 0 &&
    Number.isInteger(cursor.stepIndex) &&
    cursor.stepIndex >= 0 &&
    typeof cursor.inWrongWordClear === 'boolean' &&
    (cursor.endActionIndex === null || (Number.isInteger(cursor.endActionIndex) && cursor.endActionIndex >= 0)) &&
    (cursor.loop === null ||
      (Number.isInteger(cursor.loop.startIndex) &&
        cursor.loop.startIndex >= 0 &&
        Number.isInteger(cursor.loop.endIndex) &&
        cursor.loop.endIndex >= cursor.loop.startIndex &&
        Number.isInteger(cursor.loop.subStepIndex) &&
        cursor.loop.subStepIndex >= 0))
  )
}

function restoreCurrentCache(value: unknown): PracticeWordCache | null {
  if (!value || typeof value !== 'object' || !('taskWordsStr' in value)) return null
  const data = value as PracticeWordCacheCompact
  if (!Array.isArray(data.taskWordsStr?.new) || !Array.isArray(data.taskWordsStr?.review)) return null
  const wordMap = createWordMap()
  const taskWords = {
    new: restoreWords(data.taskWordsStr.new, wordMap),
    review: restoreWords(data.taskWordsStr.review, wordMap),
  }
  if (!taskWords.new.length && !taskWords.review.length) return null
  if (!data.practiceData && !data.statStoreData && !data.sessionSnapshot) return { taskWords }
  if (!data.practiceData || !data.statStoreData || !isCurrentSnapshot(data.sessionSnapshot)) return null
  if (
    !Array.isArray(data.practiceData.wordsStr) ||
    !Array.isArray(data.practiceData.wrongWordsStr) ||
    !Number.isInteger(data.practiceData.index) ||
    data.practiceData.index < 0
  )
    return null
  const words = restoreWords(data.practiceData.wordsStr, wordMap)
  const wrongWords = restoreWords(data.practiceData.wrongWordsStr, wordMap)
  const index = words.length ? Math.min(Math.max(data.practiceData.index, 0), words.length - 1) : 0
  const { wordsStr: _wordsStr, wrongWordsStr: _wrongWordsStr, ...practiceData } = data.practiceData
  return {
    taskWords,
    practiceData: { ...practiceData, index, words, wrongWords, question: null },
    statStoreData: data.statStoreData,
    sessionSnapshot: data.sessionSnapshot,
  }
}

export function usePracticeWordPersistence() {
  const dataSync = useDataSyncPersistence()
  const settingStore = useSettingStore()

  async function save(data: PracticeWordCache | null) {
    const compact = serializePracticeWordCache(data)
    return await dataSync.saveLocalAndSync(SyncDataType.practice_word, compact, { pullWhenRemoteNewer: false })
  }

  async function load(): Promise<PracticeWordCache | null> {
    const [local, remote] = await Promise.all([
      getPracticeWordCacheLocalWithMeta() as Promise<LocalCacheResult<PracticeWordCacheStored> | null>,
      dataSync.getRemoteData(SyncDataType.practice_word),
    ])

    let selected: LocalCacheResult<unknown> | null = local
    if (remote) {
      const remoteCache: LocalCacheResult<unknown> = {
        val: remote.data,
        version: remote.data_version ?? 1,
        updated_at: remote.updated_at,
      }
      if (
        !selected ||
        shouldFetchRemote(selected.updated_at, remoteCache.updated_at, remoteCache.version, selected.version) ===
          CompareResult.RemoteNewer
      ) {
        selected = remoteCache
      }
    }
    if (!selected) return null
    if (selected.version > PRACTICE_WORD_CACHE.version) {
      throw new UnsupportedPracticeCacheVersionError(selected.version)
    }

    if (selected.version !== PRACTICE_WORD_CACHE.version) {
      const upgraded = checkAndUpgradePracticeWordCache(
        {
          val: selected.val,
          version: selected.version,
          updated_at: selected.updated_at,
        },
        settingStore
      )
      if (upgraded.val == null) {
        await save(null)
        return null
      }
      const restored = restoreCurrentCache(upgraded.val)
      if (!restored) return null
      await save(restored)
      return restored
    }

    if (selected.val == null) return null
    return restoreCurrentCache(selected.val)
  }

  async function clear() {
    return await save(null)
  }

  async function getRemoteUpdateTime(knownUpdatedAt: number): Promise<number | null> {
    const meta = await dataSync.getRemoteMeta(SyncDataType.practice_word)
    return resolveNewerRemotePracticeCacheTime(meta, knownUpdatedAt)
  }

  return { load, save, clear, getRemoteUpdateTime }
}
