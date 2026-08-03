import type { Question, Word } from '@typewords/core/types/types.ts'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { buildQuestion } from '@typewords/core/utils/word-test.ts'

/** v2 的 Identify 阶段合并自评、直接拼写和选择题，进入该阶段即生成选择题数据。 */
export function resolvePracticeQuestion(
  practiceType: WordPracticeType,
  word: Word | undefined,
  allWords: Word[]
): Question | null {
  return practiceType === WordPracticeType.Identify && word
    ? buildQuestion(word, allWords)
    : null
}
