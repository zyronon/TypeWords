import type { Question, Word } from '@/core/types/types.ts'
import { WordPracticeType } from '@/core/types/enum.ts'
import { buildQuestion } from '@/core/utils/word-test.ts'

/** Identify 阶段合并自评、直接拼写和选择题，进入该阶段即生成选择题数据。 */
export function resolvePracticeQuestion(
  practiceType: WordPracticeType,
  word: Word | undefined,
  allWords: Word[]
): Question | null {
  return practiceType === WordPracticeType.Identify && word
    ? buildQuestion(word, allWords)
    : null
}
