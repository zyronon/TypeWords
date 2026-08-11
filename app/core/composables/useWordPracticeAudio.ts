import { ref, unref, type ComputedRef, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { Toast } from '@/base'
import type { Word } from '../types'
import { getBrowserKey, cancelWordPracticeAudio, usePlayWordAudio, useTTsPlayAudio } from '../hooks/sound'
import { useSettingStore } from '../stores/setting'
import { WordPlayTrigger } from '../types/enum'

export { WordPlayTrigger } from '../types/enum'

const CHAIN_FIRST_SENTENCE_TRIGGERS = new Set([
  WordPlayTrigger.NewWord,
  WordPlayTrigger.RepeatWord,
  WordPlayTrigger.ResetSameWord,
  WordPlayTrigger.RevealUnknown,
  WordPlayTrigger.DictationReveal,
  WordPlayTrigger.IdentifyWrongKey,
])

export interface WordPracticeAudioOptions {
  word: Ref<Word>
  volumeIconRef: Ref<{ animateOnly?: (reset?: boolean) => void } | undefined> | ComputedRef<{ animateOnly?: (reset?: boolean) => void } | undefined>
  canSeeSentences?: () => boolean
}

export function useWordPracticeAudio({ word, volumeIconRef, canSeeSentences }: WordPracticeAudioOptions) {
  const settingStore = useSettingStore()
  const router = useRouter()
  const playWordAudio = usePlayWordAudio()
  const ttsPlayAudio = useTTsPlayAudio()

  const highlightedSentenceIndex = ref(-1)
  let ttsVoiceHintShown = false

  function shouldChainFirstSentence(trigger: WordPlayTrigger) {
    return (
      settingStore.autoPlayFirstSentence &&
      CHAIN_FIRST_SENTENCE_TRIGGERS.has(trigger) &&
      canSeeSentences?.() !== false &&
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

  function playWord(
    trigger: WordPlayTrigger,
    options?: { resetIcon?: boolean; volumeRef?: { animateOnly?: (reset?: boolean) => void } }
  ) {
    // if (!settingStore.wordSound) return

    // 打断进行中的单词/例句播放，避免 NewWord 未播完时后续 playWord 被 isPlaying 静默跳过
    cancelWordPracticeAudio()

    const handle =
      trigger === WordPlayTrigger.RepeatWord ||
      trigger === WordPlayTrigger.Manual ||
      trigger === WordPlayTrigger.Shortcut
    const chain = shouldChainFirstSentence(trigger)
    const chainWord = chain ? word.value.word : undefined
    const onEnd = chainWord
      ? () => {
        // 如果单词变化了，则不播放例句，防止快速切换单词时播放例句不正确
          if (word.value.word !== chainWord) return
          playSentence(0, { highlight: true })
        }
      : undefined

    playWordAudio(word.value.word, handle, onEnd)

    const iconRef = options?.volumeRef ?? unref(volumeIconRef)
    iconRef?.animateOnly?.(options?.resetIcon ?? false)
  }

  return {
    highlightedSentenceIndex,
    playWord,
    playSentence,
    playTtsWithGuide,
    WordPlayTrigger,
  }
}
