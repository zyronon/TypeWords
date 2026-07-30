import { describe, expect, it } from 'vitest'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { WordPlayTrigger } from '@typewords/core/composables/useWordPracticeAudio.ts'
import { resolvePracticeViewDefaults } from '../../app/composables/practice-words/usePracticeDisplayPolicy.ts'
import { shouldAutoPlayFirstSentence } from '../../app/composables/practice-words/usePracticeWordAudioV2.ts'

describe('practiceType view defaults', () => {
  it.each([
    [WordPracticeType.FollowWrite, false, true],
    [WordPracticeType.Spell, true, true],
    [WordPracticeType.Listen, true, false],
    [WordPracticeType.Dictation, true, true],
    [WordPracticeType.Identify, false, false],
  ] as const)('derives type %s without Flow display config', (practiceType, isWordMasked, isShowTranslate) => {
    expect(resolvePracticeViewDefaults(practiceType)).toEqual({ isWordMasked, isShowTranslate })
  })
})

describe('v2 first sentence autoplay', () => {
  const base = {
    enabled: true,
    practiceType: WordPracticeType.FollowWrite,
    isWordMasked: false,
    hasSentence: true,
  }

  it('only chains the first sentence when entering a new word', () => {
    expect(shouldAutoPlayFirstSentence({ ...base, trigger: WordPlayTrigger.NewWord })).toBe(true)
  })

  it.each([
    WordPlayTrigger.RepeatWord,
    WordPlayTrigger.ResetSameWord,
    WordPlayTrigger.RevealUnknown,
    WordPlayTrigger.Manual,
    WordPlayTrigger.Shortcut,
    WordPlayTrigger.Typo,
    WordPlayTrigger.DelRetry,
  ])('does not chain non-new-word trigger %s', trigger => {
    expect(shouldAutoPlayFirstSentence({ ...base, trigger })).toBe(false)
  })

  it('requires an unmasked FollowWrite view, enabled setting and a sentence', () => {
    expect(shouldAutoPlayFirstSentence({ ...base, isWordMasked: true, trigger: WordPlayTrigger.NewWord })).toBe(false)
    expect(shouldAutoPlayFirstSentence({ ...base, practiceType: WordPracticeType.Listen, trigger: WordPlayTrigger.NewWord })).toBe(false)
    expect(shouldAutoPlayFirstSentence({ ...base, enabled: false, trigger: WordPlayTrigger.NewWord })).toBe(false)
    expect(shouldAutoPlayFirstSentence({ ...base, hasSentence: false, trigger: WordPlayTrigger.NewWord })).toBe(false)
  })
})
