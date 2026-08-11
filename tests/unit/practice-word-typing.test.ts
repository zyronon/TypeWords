import { describe, expect, it, vi } from 'vitest'
import { usePracticeWordTyping } from '../../app/core/composables/practice-words/usePracticeWordTyping.ts'
import { WordPlayTrigger, WordPracticeType } from '../../app/core/types/enum.ts'
import { getDefaultWord } from '../../app/core/types/func.ts'

function createTyping(masked = false, practiceType = WordPracticeType.FollowWrite) {
  const events = {
    complete: vi.fn(),
    wrong: vi.fn(),
    play: vi.fn(),
    beep: vi.fn(),
    correct: vi.fn(),
  }
  let showWordResult = false
  let currentTime = 1_000
  const typing = usePracticeWordTyping({
    getWord: () => getDefaultWord({ word: 'ABC' }),
    getPracticeType: () => practiceType,
    getIsWordMasked: () => masked,
    getShowWordResult: () => showWordResult,
    getSettings: () => ({
      ignoreCase: true,
      repeatCount: 1,
      waitTimeForChangeWord: 300,
      spaceCooldownTime: 300,
      autoNextWord: false,
      inputWrongClear: false,
    }),
    setShowWordResult: value => (showWordResult = value),
    onComplete: events.complete,
    onWrong: events.wrong,
    onPlay: events.play,
    playBeep: events.beep,
    playCorrect: events.correct,
    playKeyboardAudio: vi.fn(),
    now: () => (currentTime += 500),
  })
  return { typing, events, getShowWordResult: () => showWordResult }
}

describe('cross-platform practice word typing', () => {
  it('keeps visible input uninterrupted and does not count character errors', () => {
    const { typing, events } = createTyping(false)
    for (const key of ['A', 'X', 'C']) typing.typeCharacter({ key })
    expect(typing.input.value).toBe('AXC')
    expect(typing.inputCharacterStates.value.map(item => item.isCorrect)).toEqual([true, false, true])
    expect(events.wrong).not.toHaveBeenCalled()
    expect(events.play).toHaveBeenCalledWith(WordPlayTrigger.Typo)
  })

  it('completes a visible whole-word input after all characters arrive', () => {
    const { typing, events } = createTyping(false)
    for (const key of ['a', 'b', 'c']) typing.typeCharacter({ key })
    expect(typing.isWordCorrect.value).toBe(true)
    expect(events.correct).toHaveBeenCalledOnce()
    typing.confirm()
    expect(events.complete).toHaveBeenCalledOnce()
  })

  it('keeps masked input on per-character typo counting', () => {
    const { typing, events } = createTyping(true)
    typing.typeCharacter({ key: 'X' })
    expect(typing.input.value).toBe('')
    expect(typing.wrong.value).toBe('X')
    expect(events.wrong).toHaveBeenCalledOnce()
  })

  it('keeps dictation free until confirmation', () => {
    const { typing, events, getShowWordResult } = createTyping(true, WordPracticeType.Dictation)
    for (const key of ['A', 'B', 'C']) typing.typeCharacter({ key })
    expect(events.wrong).not.toHaveBeenCalled()
    typing.confirm()
    expect(getShowWordResult()).toBe(true)
    expect(events.correct).toHaveBeenCalledOnce()
  })
})
