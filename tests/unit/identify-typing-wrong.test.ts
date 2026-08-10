import { describe, expect, it } from 'vitest'
import { getDefaultWord } from '../../app/core/types/func.ts'
import {
  captureIdentifyTypingWrong,
  restoreIdentifyTypingWrong,
} from '../../app/composables/practice-words/identify-typing-wrong.ts'

const makeWord = (value: string) => getDefaultWord({ word: value })

describe('Identify typing wrong rollback', () => {
  it('removes records added by the provisional typing attempt', () => {
    const word = makeWord('Alpha')
    const state = {
      wrongTimes: 2,
      allWrongWords: [] as string[],
      wrongWords: [] as ReturnType<typeof makeWord>[],
      storedWrongWords: [] as ReturnType<typeof makeWord>[],
    }
    const snapshot = captureIdentifyTypingWrong(word, state)

    state.wrongTimes = 5
    state.allWrongWords.push('Alpha')
    state.wrongWords.push(word)
    state.storedWrongWords.push(word)
    restoreIdentifyTypingWrong(snapshot, state)

    expect(state).toMatchObject({ wrongTimes: 2, allWrongWords: [], wrongWords: [], storedWrongWords: [] })
  })

  it('preserves records that existed before the typing attempt', () => {
    const word = makeWord('Alpha')
    const state = {
      wrongTimes: 1,
      allWrongWords: ['alpha'],
      wrongWords: [word],
      storedWrongWords: [word],
    }
    const snapshot = captureIdentifyTypingWrong(word, state)
    state.wrongTimes = 3

    restoreIdentifyTypingWrong(snapshot, state)

    expect(state.wrongTimes).toBe(1)
    expect(state.allWrongWords).toEqual(['alpha'])
    expect(state.wrongWords).toEqual([word])
    expect(state.storedWrongWords).toEqual([word])
  })
})
