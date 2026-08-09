/**
 * @deprecated 此 composable 存在响应式链断裂问题，已被 SentencePractice 组件的内置状态方案替代。
 * 请勿在新代码中使用。直接使用 SentencePractice.vue（接收 text: string prop）即可。
 */
import { computed, onUnmounted, reactive, watch, type Ref } from 'vue'
import { PracticeArticleWordType } from '@/core/types/enum.ts'
import type { ArticleWord } from '@/core/types/types.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { usePlayBeep, usePlayCorrect, usePlayKeyboardAudio } from '@/core/hooks/sound.ts'
import type { SentencePracticeItem, SentencePracticeMode, SentenceTypingState } from './types.ts'

export interface SentenceTypingFlowOptions {
  getItem: () => SentencePracticeItem | null
  mode: Readonly<Ref<SentencePracticeMode>>
  onWrong?: () => void
  onComplete?: () => void
  onChange?: () => void
}

const SKIP_WORD_TYPES = new Set([PracticeArticleWordType.Symbol, PracticeArticleWordType.Number])

function getEventLetter(e: KeyboardEvent, targetChar = '') {
  if (e.code === 'Space') return ' '
  if (targetChar === '—' && e.code === 'Minus') return '—'
  if (targetChar === '…' && e.code === 'Digit6') return '…'
  return e.key
}

export function useSentenceTypingFlow(options: SentenceTypingFlowOptions) {
  const settingStore = useSettingStore()
  const playBeep = usePlayBeep()
  const playCorrect = usePlayCorrect()
  const playKeyboardAudio = usePlayKeyboardAudio()

  const state = reactive<SentenceTypingState>({
    wordIndex: 0,
    stringIndex: 0,
    input: '',
    wrong: '',
    isSpace: false,
    isEnd: false,
    showResult: false,
  })

  let isTyping = false
  let wrongReported = false

  const item = computed(() => options.getItem())
  const words = computed(() => item.value?.sentence.words ?? [])
  const currentWord = computed(() => words.value[state.wordIndex] ?? null)

  function compareText(input: string, target: string) {
    return settingStore.ignoreCase ? input.toLowerCase() === target.toLowerCase() : input === target
  }

  function isSkippableWord(word?: ArticleWord | null) {
    return !!word && settingStore.ignoreSymbol && SKIP_WORD_TYPES.has(word.type)
  }

  function emitChange() {
    options.onChange?.()
  }

  function resetWordInputs(targetItem = item.value) {
    targetItem?.sentence.words.forEach(word => {
      word.input = ''
    })
  }

  function reportWrong(word?: ArticleWord | null) {
    if (word?.type !== PracticeArticleWordType.Word) return
    if (wrongReported) return
    wrongReported = true
    options.onWrong?.()
  }

  function fillPreviousInputs(endIndex: number) {
    words.value.slice(0, endIndex).forEach(word => {
      word.input = (word.input ?? '') + word.word.slice(word.input?.length ?? 0)
    })
  }

  function finishSentence() {
    if (state.isEnd) return
    words.value.forEach(word => {
      word.input = (word.input ?? '') + word.word.slice(word.input?.length ?? 0)
    })
    state.input = ''
    state.wrong = ''
    state.stringIndex = 0
    state.wordIndex = words.value.length
    state.isSpace = false
    state.isEnd = true
    state.showResult = true
    if (right.value) playCorrect()
    options.onComplete?.()
    emitChange()
  }

  function moveToNextWord() {
    state.isSpace = false
    state.input = ''
    state.wrong = ''
    state.stringIndex = 0

    const list = words.value
    if (state.wordIndex + 1 < list.length) {
      state.wordIndex++
      fillPreviousInputs(state.wordIndex)
      const word = list[state.wordIndex]
      if (isSkippableWord(word)) {
        moveToNextWord()
      }
    } else {
      finishSentence()
    }
    emitChange()
  }

  function reset() {
    resetWordInputs()
    wrongReported = false
    Object.assign(state, {
      wordIndex: 0,
      stringIndex: 0,
      input: '',
      wrong: '',
      isSpace: false,
      isEnd: false,
      showResult: false,
    })

    if (isSkippableWord(currentWord.value)) {
      moveToNextWord()
    }
    emitChange()
  }

  function onTyping(e: KeyboardEvent) {
    if (!item.value || !words.value.length) return
    if (isTyping || state.isEnd) return
    isTyping = true

    try {
      const word = currentWord.value
      if (!word) {
        finishSentence()
        return
      }

      state.wrong = ''

      if (state.isSpace) {
        if (e.code === 'Space') {
          moveToNextWord()
        } else {
          moveToNextWord()
          isTyping = false
          onTyping(e)
          return
        }
      } else {
        const targetChar = word.word[state.stringIndex] ?? ''
        const letter = getEventLetter(e, targetChar)
        if (!letter || letter.length > 1) return

        const isRight = compareText(letter, targetChar)
        if (!isRight) {
          state.wrong = letter
          reportWrong(word)
          playBeep()
        }

        state.input += letter
        word.input = state.input
        state.stringIndex++

        if (!word.word[state.stringIndex]) {
          state.input = ''
          if (word.nextSpace) {
            state.isSpace = true
          } else {
            moveToNextWord()
          }
        }
      }

      playKeyboardAudio()
      emitChange()
      e.preventDefault()
    } finally {
      isTyping = false
    }
  }

  function findPrevTypeableIndex(fromIndex: number) {
    for (let i = fromIndex; i >= 0; i--) {
      if (!isSkippableWord(words.value[i])) return i
    }
    return -1
  }

  function del() {
    if (!item.value || !words.value.length) return
    playKeyboardAudio()

    if (state.wrong) {
      state.wrong = ''
      emitChange()
      return
    }

    if (state.isEnd) {
      state.isEnd = false
      state.showResult = false
      const prevIndex = findPrevTypeableIndex(words.value.length - 1)
      if (prevIndex < 0) return
      const prevWord = words.value[prevIndex]
      state.wordIndex = prevIndex
      state.isSpace = false
      state.stringIndex = Math.max(prevWord.word.length - 1, 0)
      prevWord.input = prevWord.input.slice(0, state.stringIndex)
      state.input = prevWord.input
      emitChange()
      return
    }

    if (state.isSpace) {
      state.isSpace = false
    }

    let word = currentWord.value
    if (!word) return

    if (state.stringIndex === 0) {
      const prevIndex = findPrevTypeableIndex(state.wordIndex - 1)
      if (prevIndex < 0) return
      state.wordIndex = prevIndex
      word = words.value[prevIndex]
      if (word.nextSpace) {
        state.isSpace = true
        state.stringIndex = word.word.length
      } else {
        state.stringIndex = Math.max(word.word.length - 1, 0)
      }
    } else {
      state.stringIndex--
    }

    word.input = word.input.slice(0, state.stringIndex)
    state.input = word.input
    emitChange()
  }

  const right = computed(() => {
    if (!words.value.length) return false
    return words.value.every(word => isSkippableWord(word) || compareText(word.input ?? '', word.word))
  })

  const typedText = computed(() => {
    let text = ''
    words.value.forEach(word => {
      text += word.input ?? ''
      if (word.input && word.input === word.word && word.nextSpace) {
        text += ' '
      }
    })
    return text.trimEnd()
  })

  watch(
    () => [item.value?.id, options.mode.value],
    () => reset(),
    { immediate: true }
  )

  onUnmounted(() => {
    isTyping = false
  })

  return {
    state,
    words,
    currentWord,
    right,
    typedText,
    reset,
    onTyping,
    del,
    complete: finishSentence,
    compareText,
  }
}
