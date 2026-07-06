import { computed, type Ref, ref, watch } from 'vue'
import type { Word } from '@typewords/core/types/types.ts'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import type { SentencePracticeMode } from '~/composables/practice-sentences/types.ts'
import { createWordSentencePracticeItems } from '~/composables/practice-sentences/usePracticeSentenceInit.ts'

export function mapWordPracticeTypeToSentenceMode(type: WordPracticeType): SentencePracticeMode {
  if (type === WordPracticeType.Dictation) return 'dictation'
  if (type === WordPracticeType.Listen) return 'listen'
  return 'followWrite'
}

export function usePracticeWordSentencePractice(word: Ref<Word>) {
  const settingStore = useSettingStore()
  const active = ref(false)
  const index = ref(0)

  const items = computed(() => createWordSentencePracticeItems(word.value))
  const currentItem = computed(() => items.value[index.value] ?? null)
  const mode = computed(() => mapWordPracticeTypeToSentenceMode(settingStore.wordPracticeType))
  const total = computed(() => items.value.length)

  function start() {
    if (!settingStore.practiceSentence || !items.value.length) return false
    active.value = true
    index.value = 0
    return true
  }

  function completeCurrent() {
    if (!active.value) return true
    if (index.value < items.value.length - 1) {
      index.value++
      return false
    }
    active.value = false
    index.value = 0
    return true
  }

  function reset() {
    active.value = false
    index.value = 0
  }

  watch(
    () => word.value?.word,
    () => reset()
  )

  return {
    active,
    index,
    total,
    items,
    currentItem,
    mode,
    start,
    completeCurrent,
    reset,
  }
}
