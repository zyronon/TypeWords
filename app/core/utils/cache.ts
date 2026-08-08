import type { PracticeData, TaskWords } from '../types'
import { WordPracticeMode, WordPracticeStage, WordPracticeType } from '../types/enum'
import type { PracticeState } from '../stores'
import { get, set } from 'idb-keyval'

type CacheConfig = { key: string; version: number }

export const PRACTICE_WORD_CACHE: CacheConfig = {
  key: 'PracticeSaveWord',
  version: 2,
}
export const LEGACY_PRACTICE_WORD_CACHE_VERSION = 1
export const PRACTICE_WORD_GROUP_SIZE = 7
export const PRACTICE_ARTICLE_CACHE: CacheConfig = {
  key: 'PracticeSaveArticle',
  version: 1,
}

export type PracticeWordCache = {
  taskWords: TaskWords
  practiceData?: PracticeData
  statStoreData?: PracticeState
}

export type PracticeWordTaskWordsStr = {
  new: string[]
  review: string[]
}

export type PracticeWordDataCompact = Omit<PracticeData, 'words' | 'wrongWords'> & {
  wordsStr: string[]
  wrongWordsStr: string[]
}

export type PracticeWordCacheCompact = {
  taskWordsStr: PracticeWordTaskWordsStr
  practiceData: PracticeWordDataCompact
  statStoreData: PracticeState
}

export type PracticeWordCacheStored = PracticeWordCache | PracticeWordCacheCompact

export type PracticeArticleCache = {
  practiceData: {
    sectionIndex: number
    sentenceIndex: number
    wordIndex: number
  }
  statStoreData: PracticeState
}

export type LocalCacheResult<T> = { val: T; updated_at?: string; version: number }

export type PracticeWordCacheUpgradeContext = {
  wordPracticeMode: WordPracticeMode
  wordPracticeType: WordPracticeType
}

export type PracticeWordCacheCursor = {
  nodeIndex: number
  stepIndex: number
  inWrongWordClear: boolean
  loop: null | {
    startIndex: number
    endIndex: number
    subStepIndex: number
  }
  endActionIndex: number | null
}

export type PracticeWordCacheV2Stored = {
  taskWordsStr: PracticeWordTaskWordsStr
  practiceData?: Omit<PracticeWordDataCompact, 'isTypingWrongWord' | 'question'> & {
    question: null
  }
  statStoreData?: PracticeState
  sessionSnapshot?: {
    flowId: string
    cursor: PracticeWordCacheCursor
    nodeWorkingWordKeys?: string[]
  }
}

function getPracticeFlowId(mode: WordPracticeMode): string {
  const ids: Partial<Record<WordPracticeMode, string>> = {
    [WordPracticeMode.System]: 'system',
    [WordPracticeMode.Free]: 'free',
    [WordPracticeMode.IdentifyOnly]: 'identifyOnly',
    [WordPracticeMode.DictationOnly]: 'dictationOnly',
    [WordPracticeMode.ListenOnly]: 'listenOnly',
    [WordPracticeMode.Shuffle]: 'shuffle',
    [WordPracticeMode.Review]: 'review',
  }
  return ids[mode] ?? 'system'
}

export function resolveLegacyPracticeWordCursor(
  mode: WordPracticeMode,
  stage: WordPracticeStage,
  options?: {
    isTypingWrongWord?: boolean
    practiceType?: WordPracticeType
    index?: number
    wordsLength?: number
  }
): PracticeWordCacheCursor {
  let nodeIndex = 0
  let stepIndex = 0
  const isSystem = mode === WordPracticeMode.System
  const isReview = mode === WordPracticeMode.Review

  switch (stage) {
    case WordPracticeStage.ListenNewWord:
      stepIndex = isSystem ? 1 : 0
      break
    case WordPracticeStage.DictationNewWord:
      stepIndex = isSystem ? 2 : 0
      break
    case WordPracticeStage.IdentifyReview:
      nodeIndex = [WordPracticeMode.System, WordPracticeMode.IdentifyOnly].includes(mode) ? 1 : 0
      break
    case WordPracticeStage.ListenReview:
      nodeIndex = [WordPracticeMode.System, WordPracticeMode.ListenOnly].includes(mode) ? 1 : 0
      stepIndex = isSystem || isReview ? 1 : 0
      break
    case WordPracticeStage.DictationReview:
      nodeIndex = [WordPracticeMode.System, WordPracticeMode.DictationOnly].includes(mode) ? 1 : 0
      stepIndex = isSystem || isReview ? 2 : 0
      break
  }

  const cursor: PracticeWordCacheCursor = {
    nodeIndex,
    stepIndex,
    inWrongWordClear: !!options?.isTypingWrongWord,
    loop: null,
    endActionIndex: options?.isTypingWrongWord ? 0 : null,
  }
  const wordsLength = Math.max(0, options?.wordsLength ?? 0)
  if (options?.practiceType === WordPracticeType.Spell && wordsLength > 0) {
    const index = Math.min(Math.max(options.index ?? 0, 0), wordsLength - 1)
    const startIndex = Math.floor(index / PRACTICE_WORD_GROUP_SIZE) * PRACTICE_WORD_GROUP_SIZE
    cursor.loop = {
      startIndex,
      endIndex: Math.min(startIndex + PRACTICE_WORD_GROUP_SIZE - 1, wordsLength - 1),
      subStepIndex: 0,
    }
  }
  return cursor
}

function toWordKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => typeof item === 'string' ? item : (item as { word?: unknown })?.word)
    .filter((word): word is string => typeof word === 'string' && word.length > 0)
}

function upgradePracticeWordCacheV1(value: unknown, context: PracticeWordCacheUpgradeContext): PracticeWordCacheV2Stored | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as any
  const compact = 'taskWordsStr' in raw
  const taskWordsStr = compact
    ? {
        new: toWordKeys(raw.taskWordsStr?.new),
        review: toWordKeys(raw.taskWordsStr?.review),
      }
    : {
        new: toWordKeys(raw.taskWords?.new),
        review: toWordKeys(raw.taskWords?.review),
      }
  const upgraded: PracticeWordCacheV2Stored = { taskWordsStr }
  if (!raw.practiceData || !raw.statStoreData) return upgraded

  const legacyData = raw.practiceData as PracticeData & { wordsStr?: string[]; wrongWordsStr?: string[] }
  const wordsStr = compact ? toWordKeys(legacyData.wordsStr) : toWordKeys(legacyData.words)
  const wrongWordsStr = compact ? toWordKeys(legacyData.wrongWordsStr) : toWordKeys(legacyData.wrongWords)
  const cursor = resolveLegacyPracticeWordCursor(context.wordPracticeMode, raw.statStoreData.stage, {
    isTypingWrongWord: legacyData.isTypingWrongWord,
    practiceType: context.wordPracticeType,
    index: legacyData.index,
    wordsLength: wordsStr.length,
  })
  const {
    isTypingWrongWord: _isTypingWrongWord,
    question: _question,
    words: _words,
    wrongWords: _wrongWords,
    wordsStr: _wordsStr,
    wrongWordsStr: _wrongWordsStr,
    ...practiceData
  } = legacyData

  return {
    taskWordsStr,
    practiceData: { ...practiceData, wordsStr, wrongWordsStr, question: null },
    statStoreData: raw.statStoreData,
    sessionSnapshot: {
      flowId: getPracticeFlowId(context.wordPracticeMode),
      cursor,
      nodeWorkingWordKeys: cursor.inWrongWordClear ? undefined : wordsStr,
    },
  }
}

/** 将已上线的旧版单词练习缓存升级为当前格式；当前版本直接返回，未知版本拒绝处理。 */
export function checkAndUpgradePracticeWordCache(
  data: { val: unknown; version?: number; updated_at?: string } | null | undefined,
  context: PracticeWordCacheUpgradeContext
): LocalCacheResult<PracticeWordCacheV2Stored | null> {
  const version = Number(data?.version ?? LEGACY_PRACTICE_WORD_CACHE_VERSION)
  if (version === PRACTICE_WORD_CACHE.version) {
    return { val: (data?.val ?? null) as PracticeWordCacheV2Stored | null, version, updated_at: data?.updated_at }
  }
  if (version !== LEGACY_PRACTICE_WORD_CACHE_VERSION) {
    throw new Error(`UNSUPPORTED_PRACTICE_CACHE_VERSION:${version}`)
  }
  return {
    val: upgradePracticeWordCacheV1(data?.val, context),
    version: PRACTICE_WORD_CACHE.version,
    updated_at: data?.updated_at,
  }
}

/**
 * 尝试从 localStorage 迁移老数据到 IndexedDB。
 * 如果 idb 中无数据，但 localStorage 中有，则迁移并删除 localStorage 中的 key。
 * 老数据是 JSON 字符串格式，迁移时解析为对象再存入 idb。
 */
async function migrateFromLocalStorage<T>(config: CacheConfig): Promise<LocalCacheResult<T> | null> {
  try {
    const raw = localStorage.getItem(config.key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalCacheResult<T>
    // 迁移到 idb
    await set(config.key, raw)
    // 删除 localStorage 中的老数据
    localStorage.removeItem(config.key)
    console.log(`[cache] migrated ${config.key} from localStorage to idb`)
    return parsed
  } catch {
    return null
  }
}

/** 从 idb 读取带 meta 的缓存；无数据或解析失败返回 null */
async function getLocalWithMeta<T>(config: CacheConfig): Promise<LocalCacheResult<T> | null> {
  const raw = await get(config.key)
  if (raw) {
    // 兼容旧版本写入的 JSON 字符串格式
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as LocalCacheResult<T>
      } catch {
        return null
      }
    }
    return raw as LocalCacheResult<T>
  }
  // idb 中没有数据，尝试从 localStorage 迁移（兼容老数据）
  return migrateFromLocalStorage<T>(config)
}

async function getLocal<T>(config: CacheConfig): Promise<T | null> {
  const result = await getLocalWithMeta<T>(config)
  if (result?.val) {
    if (Object.keys(result.val).length > 0) return result.val
  }
  return null
}

async function setLocal<T>(config: CacheConfig, val: T | null, updated_at: string): Promise<void> {
  // idb 原生支持对象存储，直接存对象，无需 JSON.stringify
  const payload: LocalCacheResult<T> = {
    version: config.version,
    val,
    updated_at,
  }
  await set(config.key, JSON.stringify(payload))
}

export async function getPracticeWordCacheLocal(): Promise<PracticeWordCacheStored | null> {
  return getLocal<PracticeWordCacheStored>(PRACTICE_WORD_CACHE)
}

export async function getPracticeWordCacheLocalWithMeta(): Promise<LocalCacheResult<PracticeWordCacheStored> | null> {
  return getLocalWithMeta<PracticeWordCacheStored>(PRACTICE_WORD_CACHE)
}

export async function setPracticeWordCacheLocal(
  cache: PracticeWordCacheStored | null,
  updated_at?: string
): Promise<void> {
  await setLocal(PRACTICE_WORD_CACHE, cache, updated_at)
}

export async function getPracticeArticleCacheLocal(): Promise<PracticeArticleCache | null> {
  return getLocal<PracticeArticleCache>(PRACTICE_ARTICLE_CACHE)
}

export async function getPracticeArticleCacheLocalWithMeta(): Promise<LocalCacheResult<PracticeArticleCache> | null> {
  return getLocalWithMeta<PracticeArticleCache>(PRACTICE_ARTICLE_CACHE)
}

export async function setPracticeArticleCacheLocal(
  cache: PracticeArticleCache | null,
  updated_at?: string
): Promise<void> {
  await setLocal(PRACTICE_ARTICLE_CACHE, cache, updated_at)
}
