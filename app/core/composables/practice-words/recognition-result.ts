import { Rating } from 'ts-fsrs'
import type { Word } from '@/core/types/types.ts'
import type { PracticeData } from './practice-word-session.ts'

/** 巩固答对后仍保留本组首次答错的评分，避免把刚看过答案当作已记住。 */
export function recordRecognitionResult(data: PracticeData, word: Word, correct: boolean) {
  if (correct) {
    data.ratingMap[word.word] ??= Rating.Good
    return
  }
  data.ratingMap[word.word] = Rating.Again
  data.wrongTimes++
  if (!data.allWrongWords.includes(word.word)) data.allWrongWords.push(word.word)
  if (!data.wrongWords.some(item => item.word === word.word)) data.wrongWords.push(word)
}
