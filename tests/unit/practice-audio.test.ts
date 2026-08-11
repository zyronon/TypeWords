import { describe, expect, it } from 'vitest'
import { shouldChainPracticeFirstSentence } from '@/core/composables/practice-words/practice-audio.ts'
import { WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'

const validContext = {
  trigger: WordPlayTrigger.NewWord,
  practiceType: WordPracticeType.FollowWrite,
  autoPlayFirstSentence: true,
  isWordMasked: false,
  hasFirstSentence: true,
  hasPlayedFirstSentence: false,
}

describe('v2 first sentence chaining', () => {
  it('chains only for a visible new FollowWrite word', () => {
    expect(shouldChainPracticeFirstSentence(validContext)).toBe(true)
  })

  it.each([
    { trigger: WordPlayTrigger.Manual },
    { trigger: WordPlayTrigger.ResetSameWord },
    { practiceType: WordPracticeType.Spell },
    { isWordMasked: true },
    { hasFirstSentence: false },
    { hasPlayedFirstSentence: true },
    { autoPlayFirstSentence: false },
  ])('does not chain for %o', override => {
    expect(shouldChainPracticeFirstSentence({ ...validContext, ...override })).toBe(false)
  })
})
