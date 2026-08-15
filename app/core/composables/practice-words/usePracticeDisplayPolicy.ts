import { computed, inject, provide, ref, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { WordPracticeType } from '@/core/types/enum.ts'
import type { PracticeViewState } from './practice-flow-types.ts'

const PRACTICE_VIEW_STATE_KEY: InjectionKey<ComputedRef<PracticeViewState>> = Symbol('practiceViewState')
const PRACTICE_DISPLAY_ACTIONS_KEY: InjectionKey<{
  toggleDictation: () => void
  toggleTranslate: () => void
}> = Symbol('practiceDisplayActions')

interface PracticeLocalReveal {
  showFullWord: boolean
  showWordResult: boolean
}

export function resolvePracticeViewDefaults(practiceType: WordPracticeType): {
  isWordMasked: boolean
  isShowTranslate: boolean
} {
  switch (practiceType) {
    case WordPracticeType.Spell:
      return { isWordMasked: true, isShowTranslate: true }
    case WordPracticeType.Listen:
      return { isWordMasked: true, isShowTranslate: false }
    case WordPracticeType.Dictation:
      return { isWordMasked: true, isShowTranslate: true }
    case WordPracticeType.Identify:
      return { isWordMasked: false, isShowTranslate: false }
    default:
      return { isWordMasked: false, isShowTranslate: true }
  }
}

export function usePracticeDisplayPolicy(
  currentPracticeType: ComputedRef<WordPracticeType>,
  phaseKey: ComputedRef<string>
) {
  const wordMaskOverride = ref<boolean | null>(null)
  const translateOverride = ref<boolean | null>(null)

  const effective = computed<PracticeViewState>(() => {
    const defaults = resolvePracticeViewDefaults(currentPracticeType.value)
    return {
      practiceType: currentPracticeType.value,
      isWordMasked: wordMaskOverride.value ?? defaults.isWordMasked,
      isShowTranslate: translateOverride.value ?? defaults.isShowTranslate,
      revealAll: false,
    }
  })

  watch(phaseKey, (_key, previousKey) => {
    if (previousKey !== undefined) {
      wordMaskOverride.value = null
      translateOverride.value = null
    }
  }, { flush: 'sync' })

  function setWordMasked(value: boolean) {
    const defaults = resolvePracticeViewDefaults(currentPracticeType.value)
    wordMaskOverride.value = value === defaults.isWordMasked ? null : value
  }

  function toggleDictation() {
    setWordMasked(!effective.value.isWordMasked)
  }

  function toggleTranslate() {
    const defaults = resolvePracticeViewDefaults(currentPracticeType.value)
    const next = !effective.value.isShowTranslate
    translateOverride.value = next === defaults.isShowTranslate ? null : next
  }

  provide(PRACTICE_VIEW_STATE_KEY, effective)
  provide(PRACTICE_DISPLAY_ACTIONS_KEY, { toggleDictation, toggleTranslate })

  return {
    effective,
    wordMaskOverride,
    translateOverride,
    setWordMasked,
    toggleDictation,
    toggleTranslate,
  }
}

export function useInjectedDisplayPolicy(localReveal?: Ref<PracticeLocalReveal>): ComputedRef<PracticeViewState> {
  const baseState = inject(PRACTICE_VIEW_STATE_KEY)!
  if (!localReveal) return baseState

  return computed(() => {
    const state = baseState.value
    if (!localReveal.value.showFullWord && !localReveal.value.showWordResult) return state
    return {
      ...state,
      isWordMasked: false,
      isShowTranslate: true,
      revealAll: true,
    }
  })
}

export function useInjectedDisplayActions() {
  return inject(PRACTICE_DISPLAY_ACTIONS_KEY)!
}
