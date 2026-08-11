import { getCurrentStudyWord } from '@/core/hooks/dict.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import type { TaskWords, Word } from '@/core/types/types.ts'
import { shuffle } from '@/core/utils'

export interface StudyTaskResult {
  taskWords: TaskWords
  dueReviewCount: number
  randomReviewCount: number
}

interface AddRandomReviewOptions {
  words: Word[]
  lastLearnIndex: number
  perDayStudyNumber: number
  wordReviewRatio: number
  ignoreSet: Set<string>
  enabled: boolean
}

export function addRandomReviewWhenNoDue(taskWords: TaskWords, options: AddRandomReviewOptions): StudyTaskResult {
  const dueReviewCount = taskWords.review.length
  if (!options.enabled || dueReviewCount > 0) {
    return { taskWords, dueReviewCount, randomReviewCount: 0 }
  }

  const totalNeed = Math.max(0, Math.floor(options.perDayStudyNumber * options.wordReviewRatio))
  if (!totalNeed) {
    return { taskWords, dueReviewCount, randomReviewCount: 0 }
  }

  const excludedWords = new Set([
    ...options.ignoreSet,
    ...taskWords.new.map(item => item.word),
    ...taskWords.review.map(item => item.word),
  ])
  const learnedEnd = Math.min(options.lastLearnIndex, options.words.length)
  const randomReviewWords = shuffle(
    options.words.slice(0, learnedEnd).filter(item => !excludedWords.has(item.word))
  ).slice(0, totalNeed)

  taskWords.review = taskWords.review.concat(randomReviewWords)
  return {
    taskWords,
    dueReviewCount,
    randomReviewCount: randomReviewWords.length,
  }
}

export function createStudyTask(): StudyTaskResult {
  const store = useBaseStore()
  const settingStore = useSettingStore()
  return addRandomReviewWhenNoDue(getCurrentStudyWord(), {
    words: store.sdict.words,
    lastLearnIndex: store.sdict.lastLearnIndex,
    perDayStudyNumber: store.sdict.perDayStudyNumber,
    wordReviewRatio: settingStore.wordReviewRatio,
    ignoreSet: store.getIgnoreWordsSet(),
    enabled: settingStore.autoAddRandomReviewWhenNoDue,
  })
}
