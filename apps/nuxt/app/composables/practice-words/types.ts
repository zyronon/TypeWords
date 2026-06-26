import type { PracticeData } from '@typewords/core/types/types.ts'

export type {
  PracticeWordCacheV2,
  PracticeWordCacheCompactV2,
  PracticeWordCacheStoredV2,
} from './practice-word-cache-v2.ts'

export { PRACTICE_WORD_CACHE_V2 } from './practice-word-cache-v2.ts'

export function getDefaultPracticeData(
  origin?: Partial<PracticeData>,
  val?: Partial<PracticeData>
): PracticeData {
  return Object.assign(origin, {
    index: 0,
    words: [],
    wrongWords: [],
    excludeWords: [],
    allWrongWords: [],
    wrongTimesMap: {},
    ratingMap: {},
    wrongTimes: 0,
    isTypingWrongWord: false,
    question: null,
    ...val,
  })
}
