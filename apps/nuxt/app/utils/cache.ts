import type { PracticeData, TaskWords } from '@/types/types.ts'
import type { PracticeState } from '@/stores/practice.ts'
import { IS_DEV, AppEnv } from '@/config/env'
import { syncPracticeWordCache, syncPracticeArticleCache } from '@/apis'

export const PRACTICE_WORD_CACHE = {
  key: 'PracticeSaveWord',
  version: 1,
}
export const PRACTICE_ARTICLE_CACHE = {
  key: 'PracticeSaveArticle',
  version: 1,
}

export type PracticeWordCache = {
  taskWords: TaskWords
  practiceData: PracticeData
  statStoreData: PracticeState
}

export type PracticeArticleCache = {
  practiceData: {
    sectionIndex: number
    sentenceIndex: number
    wordIndex: number
  }
  statStoreData: PracticeState
}

export function getPracticeWordCache(): PracticeWordCache | null {
  let d = localStorage.getItem(PRACTICE_WORD_CACHE.key)
  if (d) {
    try {
      //todo 记得删除
      if (IS_DEV) {
        // throw new Error('开发环境，抛出错误跳过缓存')
      }
      let obj = JSON.parse(d)
      if (obj.version !== PRACTICE_WORD_CACHE.version) {
        throw new Error()
      }
      return obj.val
    } catch (e) {
      localStorage.removeItem(PRACTICE_WORD_CACHE.key)
    }
  }
  return null
}

export function getPracticeArticleCache(): PracticeArticleCache | null {
  let d = localStorage.getItem(PRACTICE_ARTICLE_CACHE.key)
  if (d) {
    try {
      let obj = JSON.parse(d)
      if (obj.version !== PRACTICE_ARTICLE_CACHE.version) {
        throw new Error()
      }
      return obj.val
    } catch (e) {
      localStorage.removeItem(PRACTICE_ARTICLE_CACHE.key)
    }
  }
  return null
}

export function setPracticeWordCache(cache: PracticeWordCache | null) {
  const payload = cache
    ? JSON.stringify({ version: PRACTICE_WORD_CACHE.version, val: cache })
    : null
  if (payload) {
    localStorage.setItem(PRACTICE_WORD_CACHE.key, payload)
  } else {
    localStorage.removeItem(PRACTICE_WORD_CACHE.key)
  }
  // 持久化到本地服务器（不受浏览器缓存影响）
  fetch(`/api/storage/${PRACTICE_WORD_CACHE.key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  }).catch(() => {})
  // 同步到外部服务器（登录后）
  if (AppEnv.CAN_REQUEST) {
    syncPracticeWordCache(cache)
  }
}

export function setPracticeArticleCache(cache: PracticeArticleCache | null) {
  const payload = cache
    ? JSON.stringify({ version: PRACTICE_ARTICLE_CACHE.version, val: cache })
    : null
  if (payload) {
    localStorage.setItem(PRACTICE_ARTICLE_CACHE.key, payload)
  } else {
    localStorage.removeItem(PRACTICE_ARTICLE_CACHE.key)
  }
  // 持久化到本地服务器（不受浏览器缓存影响）
  fetch(`/api/storage/${PRACTICE_ARTICLE_CACHE.key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  }).catch(() => {})
  // 同步到外部服务器（登录后）
  if (AppEnv.CAN_REQUEST) {
    syncPracticeArticleCache(cache)
  }
}
