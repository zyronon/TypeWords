import { get, set } from 'idb-keyval'
import type { SentencePracticeItem, SentencePracticeMode } from './types.ts'

type CacheConfig = { key: string; version: number }

export const PRACTICE_SENTENCE_CACHE: CacheConfig = {
  key: 'PracticeSaveSentence',
  version: 1,
}

export interface PracticeSentenceCache {
  dictId: string
  dictName?: string
  items: SentencePracticeItem[]
  index: number
  wrongIds: string[]
  completedIds: string[]
  mode: SentencePracticeMode
}

type LocalCacheResult<T> = { val: T; updated_at?: string; version: number }

async function getLocalWithMeta<T>(config: CacheConfig): Promise<LocalCacheResult<T> | null> {
  const raw = await get(config.key)
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as LocalCacheResult<T>
    } catch {
      return null
    }
  }
  return raw as LocalCacheResult<T>
}

async function getLocal<T>(config: CacheConfig): Promise<T | null> {
  const result = await getLocalWithMeta<T>(config)
  if (!result?.val || result.version !== config.version) return null
  if (typeof result.val === 'object' && Object.keys(result.val as object).length === 0) return null
  return result.val
}

async function setLocal<T>(config: CacheConfig, val: T | null, updated_at: string): Promise<void> {
  const payload: LocalCacheResult<T | null> = {
    version: config.version,
    val,
    updated_at,
  }
  await set(config.key, JSON.stringify(payload))
}

export async function getPracticeSentenceCacheLocal(): Promise<PracticeSentenceCache | null> {
  return getLocal<PracticeSentenceCache>(PRACTICE_SENTENCE_CACHE)
}

export async function setPracticeSentenceCacheLocal(
  cache: PracticeSentenceCache | null,
  updated_at?: string
): Promise<void> {
  await setLocal(PRACTICE_SENTENCE_CACHE, cache, updated_at ?? new Date().toISOString())
}
