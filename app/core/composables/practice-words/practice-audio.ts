import { WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'

export interface PracticeFirstSentenceContext {
  trigger: WordPlayTrigger
  practiceType: WordPracticeType
  autoPlayFirstSentence: boolean
  isWordMasked: boolean
  hasFirstSentence: boolean
  hasPlayedFirstSentence: boolean
}

/** v2 正式练习的首句串播规则；宿主组件只负责实际播放。 */
export function shouldChainPracticeFirstSentence(context: PracticeFirstSentenceContext): boolean {
  return (
    context.autoPlayFirstSentence &&
    context.trigger === WordPlayTrigger.NewWord &&
    context.practiceType === WordPracticeType.FollowWrite &&
    !context.isWordMasked &&
    context.hasFirstSentence &&
    !context.hasPlayedFirstSentence
  )
}
