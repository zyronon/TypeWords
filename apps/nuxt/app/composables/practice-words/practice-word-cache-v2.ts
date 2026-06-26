import type { PracticeData, TaskWords } from '@typewords/core/types/types.ts'
import type { PracticeState } from '@typewords/core/stores/practice.ts'
import type { PracticeSessionSnapshot } from './registry-types.ts'
import { get, set } from 'idb-keyval'

type CacheConfig = { key: string; version: number }

/** v2 专用练习缓存，与 v1 `PracticeSaveWord` 完全隔离 */
export const PRACTICE_WORD_CACHE_V2: CacheConfig = {
  key: 'PracticeSaveWordV2',
  version: 1,
}

export type PracticeWordCacheV2 = {
  taskWords: TaskWords
  practiceData?: PracticeData
  statStoreData?: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}

export type PracticeWordTaskWordsStrV2 = {
  new: string[]
  review: string[]
}

export type PracticeWordDataCompactV2 = Omit<PracticeData, 'words' | 'wrongWords'> & {
  wordsStr: string[]
  wrongWordsStr: string[]
}

export type PracticeWordCacheCompactV2 = {
  taskWordsStr: PracticeWordTaskWordsStrV2
  practiceData: PracticeWordDataCompactV2
  statStoreData: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}

export type PracticeWordCacheStoredV2 = PracticeWordCacheV2 | PracticeWordCacheCompactV2

type LocalCacheResult<T> = { val: T; updated_at?: string; version: number }

async function getLocalWithMeta<T>(config: CacheConfig): Promise<LocalCacheResult<T> | null> {
  const raw = await get(config.key)
  if (raw) {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as LocalCacheResult<T>
      } catch {
        return null
      }
    }
    return raw as LocalCacheResult<T>
  }
  return null
}

async function getLocal<T>(config: CacheConfig): Promise<T | null> {
  const result = await getLocalWithMeta<T>(config)
  if (result?.val) {
    if (Object.keys(result.val).length > 0) return result.val
  }
  return null
}

async function setLocal<T>(config: CacheConfig, val: T | null, updated_at: string): Promise<void> {
  const payload: LocalCacheResult<T> = {
    version: config.version,
    val,
    updated_at,
  }
  await set(config.key, JSON.stringify(payload))
}

export async function getPracticeWordCacheV2Local(): Promise<PracticeWordCacheStoredV2 | null> {
  return getLocal<PracticeWordCacheStoredV2>(PRACTICE_WORD_CACHE_V2)
}

export async function setPracticeWordCacheV2Local(
  cache: PracticeWordCacheStoredV2 | null,
  updated_at?: string
): Promise<void> {
  await setLocal(PRACTICE_WORD_CACHE_V2, cache, updated_at ?? new Date().toISOString())
}
