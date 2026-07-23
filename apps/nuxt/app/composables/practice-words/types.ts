import type { PracticeData } from '@typewords/core/types/types.ts'
import type { PracticeDataV2 } from './practice-word-cache-v2.ts'

export type {
  PracticeWordCacheV2,
  PracticeWordCacheCompactV2,
  PracticeWordCacheStoredV2,
} from './practice-word-cache-v2.ts'

export { PRACTICE_WORD_CACHE_V2 } from './practice-word-cache-v2.ts'

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

export type { PracticeDataV2 } from './practice-word-cache-v2.ts'
