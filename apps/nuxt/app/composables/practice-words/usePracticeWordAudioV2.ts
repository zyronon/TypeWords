import { ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { Toast } from '@typewords/base'
import type { Word } from '@typewords/core/types/types.ts'
import { cancelWordPracticeAudio, getBrowserKey, usePlayWordAudio, useTTsPlayAudio } from '@typewords/core/hooks/sound.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { WordPlayTrigger } from '@typewords/core/composables/useWordPracticeAudio.ts'

const CHAIN_FIRST_SENTENCE_TRIGGERS = new Set([
  WordPlayTrigger.NewWord,
  WordPlayTrigger.RepeatWord,
  WordPlayTrigger.ResetSameWord,
  WordPlayTrigger.RevealUnknown,
  WordPlayTrigger.DictationReveal,
  WordPlayTrigger.IdentifyWrongKey,
])

export interface PracticeWordAudioV2Options {
  word: Ref<Word>
  shouldShowSentences: () => boolean
}

export function usePracticeWordAudioV2({ word, shouldShowSentences }: PracticeWordAudioV2Options) {
  const settingStore = useSettingStore()
  const router = useRouter()
  const playWordAudio = usePlayWordAudio()
  const ttsPlayAudio = useTTsPlayAudio()

  const highlightedSentenceIndex = ref(-1)
  let ttsVoiceHintShown = false

  function shouldAutoPlaySentence(trigger: WordPlayTrigger) {
    return (
      settingStore.autoPlayFirstSentence &&
      CHAIN_FIRST_SENTENCE_TRIGGERS.has(trigger) &&
      shouldShowSentences() &&
      !!word.value.sentences?.[0]?.c
    )
  }

  function playTtsWithGuide(text: string, onEnd?: () => void) {
    if (!ttsVoiceHintShown) {
      const browserKey = getBrowserKey()
      const hasVoice = settingStore.ttsVoiceMap?.some(v => v.key === browserKey && v.voice)
      if (!hasVoice) {
        ttsVoiceHintShown = true
        const ins = Toast.warning(
          '例句默认使用浏览器内置 TTS 发音，若无声请前往「设置 → 音效设置 → TTS 声色」选择可用声色',
          {
            duration: 15000000,
            action: {
              text: '设置',
              onClick: () => {
                router.push('/setting?index=4')
                ins.close()
              },
            },
          }
        )
      }
    }
    ttsPlayAudio(text, {
      onEnd,
      volume: settingStore.sentenceSoundVolume / 100,
      rate: settingStore.sentenceSoundSpeed,
    })
  }

  function playSentence(index: number, options?: { highlight?: boolean }) {
    const text = word.value.sentences?.[index]?.c
    if (!text) return
    const highlight = options?.highlight ?? false
    if (highlight) highlightedSentenceIndex.value = index
    playTtsWithGuide(text, () => {
      if (highlight && highlightedSentenceIndex.value === index) {
        highlightedSentenceIndex.value = -1
      }
    })
  }

  function playWord(trigger: WordPlayTrigger) {
    cancelWordPracticeAudio()

    const handle =
      trigger === WordPlayTrigger.RepeatWord ||
      trigger === WordPlayTrigger.Manual ||
      trigger === WordPlayTrigger.Shortcut
    const chain = shouldAutoPlaySentence(trigger)
    const chainWord = chain ? word.value.word : undefined
    const onEnd = chainWord
      ? () => {
          if (word.value.word !== chainWord) return
          playSentence(0, { highlight: true })
        }
      : undefined

    playWordAudio(word.value.word, handle, onEnd)
  }

  return { highlightedSentenceIndex, playWord, playSentence, playTtsWithGuide }
}

export { WordPlayTrigger }
