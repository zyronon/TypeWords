import type { Ref } from 'vue'
import type { Word } from '@/core/types/types.ts'
import { WordPracticeType } from '@/core/types/enum.ts'
import { cancelWordPracticeAudio, usePlayWordAudio } from '@/core/hooks/sound.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { WordPlayTrigger } from '@/core/composables/useWordPracticeAudio.ts'
import { VolumeIcon } from '@/base'

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
      // 仅在确实要播放新音频时取消旧播放；默写切到下一词不会调用此函数。
      cancelWordPracticeAudio()
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
