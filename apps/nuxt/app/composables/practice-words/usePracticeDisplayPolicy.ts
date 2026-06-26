import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import type {
  EffectiveDisplay,
  PracticeDisplayOverride,
  PracticeDisplayPolicy,
  PracticePhaseDefinition,
} from './registry-types.ts'

export const PRACTICE_DISPLAY_POLICY_KEY: InjectionKey<ComputedRef<EffectiveDisplay>> = Symbol('practiceDisplayPolicy')
export const PRACTICE_DISPLAY_ACTIONS_KEY: InjectionKey<{
  toggleDictation: () => void
  toggleTranslate: () => void
}> = Symbol('practiceDisplayActions')

export const sessionDisplay = ref<PracticeDisplayPolicy | null>(null)
export const displayOverride = ref<PracticeDisplayOverride | null>(null)

function mergeDisplay(
  base: PracticeDisplayPolicy,
  override: PracticeDisplayOverride | null
): PracticeDisplayPolicy {
  if (!override) return base
  return { ...base, ...override }
}

function deriveFromSettingStore(dictation: boolean, translate: boolean): PracticeDisplayPolicy {
  return {
    source: 'settingStore',
    wordMask: dictation ? 'underscore' : 'none',
    showPhonetic: dictation ? 'shadow' : true,
    showWordTranslation: translate,
    showSentences: !dictation,
    showSentenceTranslation: translate,
    showPhrases: !dictation,
    showEtymology: translate && !dictation,
    showRelWords: translate && !dictation,
    inputMode: 'typing',
    allowWordTip: true,
    autoNextWord: true,
  }
}

function toEffective(
  policy: PracticeDisplayPolicy,
  localReveal?: { showFullWord?: boolean; showWordResult?: boolean }
): EffectiveDisplay {
  const showFullWord = localReveal?.showFullWord ?? false
  const showWordResult = localReveal?.showWordResult ?? false
  const reveal = showFullWord || showWordResult

  return {
    source: policy.source,
    showSentences: policy.showSentences || reveal,
    showSentenceTranslation: policy.showSentenceTranslation || reveal,
    showWordTranslation: policy.showWordTranslation || reveal,
    showPhrases: policy.showPhrases || reveal,
    showEtymology: policy.showEtymology || reveal,
    showRelWords: policy.showRelWords || reveal,
    wordMask: showWordResult ? 'none' : policy.wordMask,
    dictation: policy.wordMask !== 'none',
    translate: policy.showWordTranslation || reveal,
    showPhoneticShadow: policy.showPhonetic === 'shadow' || policy.wordMask !== 'none',
    isDictationInput: policy.inputMode === 'dictation',
  }
}

export function applyPhaseDefinition(phase: PracticePhaseDefinition) {
  if (phase.display.source === 'settingStore') {
    sessionDisplay.value = null
    displayOverride.value = null
    return
  }
  sessionDisplay.value = { ...phase.display }
  displayOverride.value = null
}

export function createEffectiveDisplay(
  settingStore = useSettingStore(),
  localReveal?: Ref<{ showFullWord: boolean; showWordResult: boolean }>
): ComputedRef<EffectiveDisplay> {
  return computed(() => {
    const reveal = localReveal?.value
    const base =
      sessionDisplay.value?.source === 'phase'
        ? mergeDisplay(sessionDisplay.value, displayOverride.value)
        : deriveFromSettingStore(settingStore.dictation, settingStore.translate)
    return toEffective(base, reveal)
  })
}

export function usePracticeDisplayPolicy(
  localReveal?: Ref<{ showFullWord: boolean; showWordResult: boolean }>
) {
  const settingStore = useSettingStore()
  const effective = createEffectiveDisplay(settingStore, localReveal)

  function toggleDictation() {
    if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
      settingStore.dictation = !settingStore.dictation
      return
    }
    const current = effective.value
    const nextMask = current.wordMask === 'none' ? 'underscore' : 'none'
    displayOverride.value = {
      ...displayOverride.value,
      wordMask: nextMask,
      showSentences: nextMask === 'none',
      showPhrases: nextMask === 'none',
      showEtymology: nextMask === 'none' && current.translate,
      showRelWords: nextMask === 'none' && current.translate,
    }
  }

  function toggleTranslate() {
    if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
      settingStore.translate = !settingStore.translate
      return
    }
    const current = effective.value
    const next = !current.translate
    displayOverride.value = {
      ...displayOverride.value,
      showWordTranslation: next,
      showSentenceTranslation: next,
    }
  }

  provide(PRACTICE_DISPLAY_POLICY_KEY, effective)
  provide(PRACTICE_DISPLAY_ACTIONS_KEY, { toggleDictation, toggleTranslate })

  return { effective, toggleDictation, toggleTranslate, sessionDisplay, displayOverride }
}

export function useInjectedDisplayPolicy() {
  return inject(PRACTICE_DISPLAY_POLICY_KEY)!
}

export function useInjectedDisplayActions() {
  return inject(PRACTICE_DISPLAY_ACTIONS_KEY)!
}

export { deriveFromSettingStore, mergeDisplay, toEffective }
