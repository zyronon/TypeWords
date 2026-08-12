import { computed, ref } from 'vue'
import { WordPlayTrigger, WordPracticeType } from '../../types/enum.ts'
import type { Word } from '../../types/types.ts'
import { normalizeWord } from '../../utils/index.ts'
import {
  getPracticeInputCharacterStates,
  isPracticeCharacterCorrect,
  isWholePracticeInputComplete,
  isWholePracticeInputCorrect,
  normalizePracticeInputCharacter,
  type PracticeKeyboardInput,
} from './visible-word-typing.ts'

export interface PracticeTypingSettings {
  ignoreCase: boolean
  repeatCount: number
  repeatCustomCount?: number | null
  waitTimeForChangeWord: number
  spaceCooldownTime: number
  autoNextWord: boolean
  inputWrongClear: boolean
}

export interface PracticeTypingNotice {
  type: 'delete-reinput' | 'space-continue'
}

export interface PracticeWordTypingOptions {
  getWord: () => Word
  getPracticeType: () => WordPracticeType
  getIsWordMasked: () => boolean
  getShowWordResult: () => boolean
  getSettings: () => PracticeTypingSettings
  setShowWordResult: (value: boolean) => void
  onComplete: () => void
  onWrong: () => void
  onPlay: (trigger: WordPlayTrigger) => void
  onNotice?: (notice: PracticeTypingNotice) => void
  playBeep: () => void
  playCorrect: () => void
  playKeyboardAudio: () => void
  resetWordPlayCount?: (word: string) => void
  now?: () => number
  setTimer?: typeof setTimeout
  clearTimer?: typeof clearTimeout
}

export type PracticeTypingInput = Partial<Omit<PracticeKeyboardInput, 'key'>> & Pick<PracticeKeyboardInput, 'key'>

/** 跨平台单词键入状态机；DOM/小程序 input 事件必须先适配成这里的动作。 */
export function usePracticeWordTyping(options: PracticeWordTypingOptions) {
  const input = ref('')
  const wrong = ref('')
  const wholeInputAttempt = ref<boolean | null>(null)
  const inputLock = ref(false)
  const wordRepeatCount = ref(0)
  const wordCompletedTime = ref(0)
  let jumpTimer: ReturnType<typeof setTimeout> | null = null
  let repeatTimer: ReturnType<typeof setTimeout> | null = null
  let wrongClearTimer: ReturnType<typeof setTimeout> | null = null
  let pressNumber = 0

  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout
  const now = options.now ?? Date.now

  const inputCharacterStates = computed(() => {
    const settings = options.getSettings()
    return getPracticeInputCharacterStates(input.value, options.getWord().word, settings.ignoreCase)
  })

  const isWordCorrect = computed(() => {
    const settings = options.getSettings()
    let actual = input.value
    let target = options.getWord().word
    if (options.getPracticeType() === WordPracticeType.Dictation) {
      actual = normalizeWord(actual)
      target = normalizeWord(target)
    }
    return isWholePracticeInputCorrect(actual, target, settings.ignoreCase)
  })

  function clearJumpTimer() {
    if (!jumpTimer) return
    clearTimer(jumpTimer)
    jumpTimer = null
  }

  function clearDeferredTimers() {
    clearJumpTimer()
    if (repeatTimer) clearTimer(repeatTimer)
    if (wrongClearTimer) clearTimer(wrongClearTimer)
    repeatTimer = null
    wrongClearTimer = null
  }

  function typo(needPlay = true) {
    options.onWrong()
    if (needPlay) options.onPlay(WordPlayTrigger.Typo)
  }

  function shouldRepeat() {
    if (options.getPracticeType() !== WordPracticeType.FollowWrite) return false
    const settings = options.getSettings()
    const repeatCount = settings.repeatCount === 100 ? Number(settings.repeatCustomCount ?? 0) : settings.repeatCount
    return repeatCount > wordRepeatCount.value + 1
  }

  function repeat() {
    if (repeatTimer) clearTimer(repeatTimer)
    const wordKey = options.getWord().word
    repeatTimer = setTimer(() => {
      repeatTimer = null
      if (options.getWord().word !== wordKey) return
      wrong.value = input.value = ''
      wholeInputAttempt.value = null
      wordRepeatCount.value++
      inputLock.value = false
      options.onPlay(WordPlayTrigger.RepeatWord)
    }, options.getSettings().waitTimeForChangeWord)
  }

  function completeTypeWord(delay: boolean) {
    if (shouldRepeat()) return repeat()
    if (!delay) return options.onComplete()
    clearJumpTimer()
    const wordKey = options.getWord().word
    jumpTimer = setTimer(() => {
      jumpTimer = null
      if (options.getWord().word === wordKey) options.onComplete()
    }, options.getSettings().waitTimeForChangeWord)
  }

  function completeCurrentInput() {
    wordCompletedTime.value = now()
    options.playCorrect()
    if (options.getPracticeType() === WordPracticeType.Listen && !options.getShowWordResult()) {
      options.setShowWordResult(true)
    }
    if (
      [WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(options.getPracticeType()) &&
      options.getSettings().autoNextWord
    ) {
      completeTypeWord(true)
    }
  }

  function isSpace(event: PracticeTypingInput) {
    return event.code === 'Space' || event.key === ' '
  }

  function typeCharacter(event: PracticeTypingInput) {
    if (event.code === 'Backspace') return backspace()
    const target = options.getWord().word
    const settings = options.getSettings()

    if (inputLock.value) {
      if (wholeInputAttempt.value && !isWordCorrect.value) {
        options.onNotice?.({ type: 'delete-reinput' })
        return
      }
      if (isSpace(event)) {
        if (isWordCorrect.value) {
          if (
            [WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(options.getPracticeType()) &&
            options.getSettings().autoNextWord
          ) {
            return
          }
          clearJumpTimer()
          if (wordCompletedTime.value && now() - wordCompletedTime.value < settings.spaceCooldownTime) return
          completeTypeWord(false)
          inputLock.value = false
        } else if (options.getShowWordResult()) {
          pressNumber++
          if (pressNumber >= 3) {
            options.onNotice?.({ type: 'delete-reinput' })
            pressNumber = 0
          }
        }
      } else if (isWordCorrect.value) {
        pressNumber++
        if (pressNumber >= 3) {
          options.onNotice?.({ type: 'space-continue' })
          pressNumber = 0
        }
      } else {
        options.setShowWordResult(false)
        inputLock.value = false
        input.value = wrong.value = ''
        typeCharacter(event)
      }
      return
    }

    inputLock.value = true
    if (options.getPracticeType() === WordPracticeType.Dictation) {
      if (isSpace(event) && input.value && (input.value.length >= target.length || !target.includes(' '))) {
        if (isWordCorrect.value) {
          if (options.getShowWordResult()) return options.onComplete()
          options.setShowWordResult(true)
          options.playCorrect()
          options.onPlay(WordPlayTrigger.DictationReveal)
        } else {
          options.playBeep()
          options.setShowWordResult(true)
          typo()
        }
        return
      }
      input.value += event.key
      wrong.value = ''
      options.playKeyboardAudio()
      inputLock.value = false
      return
    }

    if (options.getPracticeType() === WordPracticeType.Identify && !options.getShowWordResult()) {
      options.setShowWordResult(true)
      typo(false)
    }

    if (wholeInputAttempt.value === null) wholeInputAttempt.value = !options.getIsWordMasked()
    const targetCharacter = target[input.value.length]
    const letter = normalizePracticeInputCharacter(
      { key: event.key, code: event.code ?? '', shiftKey: event.shiftKey ?? false },
      targetCharacter
    )

    if (wholeInputAttempt.value) {
      input.value += letter
      wrong.value = ''
      options.playKeyboardAudio()
      if (isWholePracticeInputComplete(input.value, target)) {
        if (isWholePracticeInputCorrect(input.value, target, settings.ignoreCase)) completeCurrentInput()
        else {
          options.playBeep()
          options.onPlay(WordPlayTrigger.Typo)
        }
      } else {
        inputLock.value = false
      }
      return
    }

    if (isPracticeCharacterCorrect(letter, targetCharacter, settings.ignoreCase)) {
      input.value += letter
      wrong.value = ''
      options.playKeyboardAudio()
    } else {
      options.playBeep()
      typo()
      wrong.value = letter
      if (wrongClearTimer) clearTimer(wrongClearTimer)
      const wordKey = options.getWord().word
      wrongClearTimer = setTimer(() => {
        wrongClearTimer = null
        if (options.getWord().word !== wordKey) return
        if (options.getSettings().inputWrongClear) input.value = ''
        wrong.value = ''
        if (!input.value) wholeInputAttempt.value = null
      }, 500)
    }

    if (isWordCorrect.value) completeCurrentInput()
    else inputLock.value = false
  }

  function confirm() {
    typeCharacter({ key: ' ', code: 'Space', shiftKey: false })
  }

  function backspace(nextValue?: string) {
    options.playKeyboardAudio()
    inputLock.value = false
    if (options.getPracticeType() === WordPracticeType.Dictation && options.getShowWordResult()) {
      input.value = wrong.value = ''
    } else if (wrong.value) {
      wrong.value = ''
    } else {
      input.value = nextValue ?? input.value.slice(0, -1)
    }
    if (!input.value) {
      options.setShowWordResult(false)
      wholeInputAttempt.value = null
    }
  }

  function reset(trigger: WordPlayTrigger) {
    clearDeferredTimers()
    wrong.value = input.value = ''
    wholeInputAttempt.value = null
    wordRepeatCount.value = 0
    inputLock.value = false
    wordCompletedTime.value = 0
    pressNumber = 0
    options.resetWordPlayCount?.(options.getWord().word)
    if (options.getPracticeType() !== WordPracticeType.Dictation) options.onPlay(trigger)
  }

  function setWordTestResult(correct: boolean, word: string) {
    if (correct) {
      inputLock.value = true
      input.value = word
      options.playCorrect()
    } else {
      wrong.value = word
      options.playBeep()
    }
  }

  return {
    input,
    wrong,
    wholeInputAttempt,
    inputLock,
    wordCompletedTime,
    inputCharacterStates,
    isWordCorrect,
    typeCharacter,
    confirm,
    backspace,
    reset,
    setWordTestResult,
    clearDeferredTimers,
  }
}
