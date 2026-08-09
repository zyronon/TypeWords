import { describe, expect, it } from 'vitest'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import { resolvePracticeQuestion } from '../../apps/nuxt/app/composables/practice-words/practice-question.ts'

const makeWord = (word: string, cn: string) => getDefaultWord({
  word,
  trans: [{ pos: 'n.', cn }],
})

describe('v2 merged Identify question', () => {
  const words = [
    makeWord('alpha', '甲'),
    makeWord('bravo', '乙'),
    makeWord('charlie', '丙'),
    makeWord('delta', '丁'),
  ]

  it('builds four candidates whenever the current phase is Identify', () => {
    const question = resolvePracticeQuestion(WordPracticeType.Identify, words[0], words)

    expect(question).not.toBeNull()
    expect(question!.candidates).toHaveLength(4)
    expect(question!.candidates[question!.correctIndex].word).toBe(words[0])
  })

  it('rebuilds for the current word and clears outside Identify', () => {
    const nextQuestion = resolvePracticeQuestion(WordPracticeType.Identify, words[1], words)

    expect(nextQuestion).not.toBeNull()
    expect(nextQuestion!.candidates[nextQuestion!.correctIndex].word).toBe(words[1])
    expect(resolvePracticeQuestion(WordPracticeType.Listen, words[1], words)).toBeNull()
    expect(resolvePracticeQuestion(WordPracticeType.Identify, undefined, words)).toBeNull()
  })
})
