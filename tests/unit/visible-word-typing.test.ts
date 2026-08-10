import { describe, expect, it } from 'vitest'
import {
  getFirstWrongCharacterIndex,
  getPracticeInputCharacterStates,
  getWholeInputAfterWrongBackspace,
  isWholePracticeInputComplete,
  isWholePracticeInputCorrect,
  normalizePracticeInputCharacter,
} from '../../app/composables/practice-words/visible-word-typing.ts'

describe('visible word whole-input rules', () => {
  it('reports every character independently', () => {
    expect(getPracticeInputCharacterStates('AAC', 'ABC', false)).toEqual([
      { character: 'A', isCorrect: true },
      { character: 'A', isCorrect: false },
      { character: 'C', isCorrect: true },
    ])
  })

  it('distinguishes incomplete, complete-wrong and complete-correct input', () => {
    expect(isWholePracticeInputComplete('AB', 'ABC')).toBe(false)
    expect(isWholePracticeInputCorrect('AAC', 'ABC', false)).toBe(false)
    expect(isWholePracticeInputCorrect('abc', 'ABC', true)).toBe(true)
    expect(isWholePracticeInputCorrect('abc', 'ABC', false)).toBe(false)
  })

  it('finds the first wrong position and rolls back to the longest correct prefix', () => {
    expect(getFirstWrongCharacterIndex('AXCY', 'ABCD', false)).toBe(1)
    expect(getWholeInputAfterWrongBackspace('AXCY', 'ABCD', false)).toBe('A')
    expect(getWholeInputAfterWrongBackspace('ABCD', 'ABCD', false)).toBe('ABC')
  })

  it('handles spaces and multiple wrong positions', () => {
    expect(getFirstWrongCharacterIndex('A XZ', 'A BC', false)).toBe(2)
    expect(getPracticeInputCharacterStates('A C', 'A B', false).map(item => item.isCorrect)).toEqual([
      true,
      true,
      false,
    ])
  })

  it('normalizes supported full-width punctuation', () => {
    expect(normalizePracticeInputCharacter({ key: '!', code: 'Digit1', shiftKey: true }, '！')).toBe('！')
    expect(normalizePracticeInputCharacter({ key: '.', code: 'Period', shiftKey: false }, '。')).toBe('。')
    expect(normalizePracticeInputCharacter({ key: 'x', code: 'KeyX', shiftKey: false }, 'y')).toBe('x')
  })
})
