import { ref } from 'vue'
import { WordPlayTrigger, WordPracticeType } from '../../types/enum.ts'
import type { Word } from '../../types/types.ts'
import { shouldChainPracticeFirstSentence } from './practice-audio.ts'

export interface PracticeTypeWordControllerOptions {
  getWord: () => Word
  getPracticeType: () => WordPracticeType
  getPhaseKey: () => string
  getIsWordMasked: () => boolean
  getAutoPlayFirstSentence: () => boolean
  getAllowWordTip?: () => boolean
  onWrong: (source?: 'identifyTyping') => void
  playWordAudio: (word: string, manual: boolean, onEnd?: () => void) => void
  playFirstSentence: () => void
}

/** 共享 TypeWord 外壳中与具体组件库、DOM 无关的显示及音频控制。 */
export function usePracticeTypeWordController(options: PracticeTypeWordControllerOptions) {
  const showFullWord = ref(false)
  const showWordResult = ref(false)
  const showAllCandidates = ref(false)
  const isPlayedFirstSentence = ref(false)
  let revealPhaseKey = ''
  let revealWords = new Set<string>()

  function reset() {
    showFullWord.value = false
    showWordResult.value = false
    showAllCandidates.value = false
    isPlayedFirstSentence.value = false
    const phaseKey = options.getPhaseKey()
    if (phaseKey !== revealPhaseKey) {
      revealPhaseKey = phaseKey
      revealWords = new Set()
    }
  }

  function showWord() {
    if (options.getAllowWordTip && !options.getAllowWordTip()) return false
    const word = options.getWord().word
    if (
      (options.getPracticeType() !== WordPracticeType.FollowWrite || options.getIsWordMasked()) &&
      !showWordResult.value &&
      !revealWords.has(word)
    ) {
      revealWords.add(word)
      options.onWrong()
    }
    showFullWord.value = true
    return true
  }

  function hideWord() {
    showFullWord.value = false
    showAllCandidates.value = false
  }

  function playWord(trigger: WordPlayTrigger) {
    const word = options.getWord()
    const shouldChain = shouldChainPracticeFirstSentence({
      trigger,
      practiceType: options.getPracticeType(),
      autoPlayFirstSentence: options.getAutoPlayFirstSentence(),
      isWordMasked: options.getIsWordMasked(),
      hasFirstSentence: !!word.sentences?.[0]?.c,
      hasPlayedFirstSentence: isPlayedFirstSentence.value,
    })
    const wordKey = word.word
    options.playWordAudio(word.word, trigger === WordPlayTrigger.Manual, shouldChain
      ? () => {
          if (options.getWord().word !== wordKey) return
          isPlayedFirstSentence.value = true
          options.playFirstSentence()
        }
      : undefined)
  }

  function checkMaskedRevealWrong(isWordRight: boolean) {
    if (options.getIsWordMasked() && !showWordResult.value && !isWordRight) options.onWrong()
  }

  return {
    showFullWord,
    showWordResult,
    showAllCandidates,
    isPlayedFirstSentence,
    reset,
    showWord,
    hideWord,
    playWord,
    checkMaskedRevealWrong,
  }
}
