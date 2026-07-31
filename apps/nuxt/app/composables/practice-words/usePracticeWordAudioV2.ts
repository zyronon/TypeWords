import type { Ref } from 'vue'
import type { Word } from '@typewords/core/types/types.ts'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { cancelWordPracticeAudio, usePlayWordAudio } from '@typewords/core/hooks/sound.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { WordPlayTrigger } from '@typewords/core/composables/useWordPracticeAudio.ts'
import { VolumeIcon } from '@typewords/base'

export interface PracticeWordAudioV2Options {
  word: Ref<Word>
  practiceType: () => WordPracticeType
  playFirstSentence: () => void
  volumeIconRef: VolumeIcon
}

export function usePracticeWordAudioV2({
  word,
  practiceType,
  playFirstSentence,
  volumeIconRef,
}: PracticeWordAudioV2Options) {
  const settingStore = useSettingStore()
  const playWordAudio = usePlayWordAudio()

  function shouldPlayFirstSentence() {
    return (
      settingStore.autoPlayFirstSentence &&
      [WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(practiceType()) &&
      !!word.value.sentences?.[0]?.c
    )
  }

  function playWord(trigger: WordPlayTrigger, _options?: { volumeRef?: unknown; resetIcon?: boolean }) {
    const handle = trigger === WordPlayTrigger.Manual
    if (handle || settingStore.wordSound) {
      if (handle) cancelWordPracticeAudio()
      const chainWord = shouldPlayFirstSentence() ? word.value.word : ''
      const onEnd = chainWord
        ? () => {
            if (word.value.word === chainWord) playFirstSentence()
          }
        : undefined
      playWordAudio(word.value.word, handle, onEnd, () => {
        volumeIconRef?.animate(true)
      })
    }
  }

  return { playWord }
}

export { WordPlayTrigger }
