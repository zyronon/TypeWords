import type { Ref } from 'vue'
import type { Word } from '@typewords/core/types/types.ts'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { cancelWordPracticeAudio, usePlayWordAudio } from '@typewords/core/hooks/sound.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { WordPlayTrigger } from '@typewords/core/composables/useWordPracticeAudio.ts'

export function shouldAutoPlayFirstSentence(options: {
  enabled: boolean
  practiceType: WordPracticeType
  isWordMasked: boolean
  trigger: WordPlayTrigger
  hasSentence: boolean
}) {
  return (
    options.enabled &&
    options.practiceType === WordPracticeType.FollowWrite &&
    !options.isWordMasked &&
    options.trigger === WordPlayTrigger.NewWord &&
    options.hasSentence
  )
}

export interface PracticeWordAudioV2Options {
  word: Ref<Word>
  practiceType: () => WordPracticeType
  isWordMasked: () => boolean
  playFirstSentence: () => void
}

export function usePracticeWordAudioV2({
  word,
  practiceType,
  isWordMasked,
  playFirstSentence,
}: PracticeWordAudioV2Options) {
  const settingStore = useSettingStore()
  const playWordAudio = usePlayWordAudio()

  function shouldPlayFirstSentence(trigger: WordPlayTrigger) {
    return shouldAutoPlayFirstSentence({
      enabled: settingStore.autoPlayFirstSentence,
      practiceType: practiceType(),
      isWordMasked: isWordMasked(),
      trigger,
      hasSentence: !!word.value.sentences?.[0]?.c,
    })
  }

  function playWord(trigger: WordPlayTrigger, _options?: { volumeRef?: unknown; resetIcon?: boolean }) {
    cancelWordPracticeAudio()

    const handle = [WordPlayTrigger.RepeatWord, WordPlayTrigger.Manual, WordPlayTrigger.Shortcut].includes(trigger)
    const chainWord = shouldPlayFirstSentence(trigger) ? word.value.word : ''
    const onEnd = chainWord
      ? () => {
          if (word.value.word === chainWord) playFirstSentence()
        }
      : undefined

    playWordAudio(word.value.word, handle, onEnd)
  }

  return { playWord }
}

export { WordPlayTrigger }
