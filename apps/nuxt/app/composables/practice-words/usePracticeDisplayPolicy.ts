/**
 * 练习页显隐策略：TypeWordV2 / FooterV2 的唯一数据源。
 *
 * v2 统一走 currentPhase.display + displayOverride（用户 Footer 临时 Toggle）。
 * 不再读 settingStore.dictation / translate（该二字段仍保留在 core 供 v1 使用）。
 */
import { computed, inject, provide, ref, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type {
  EffectiveDisplay,
  PracticeDisplayOverride,
  PracticeDisplayPolicy,
  PracticePhaseDefinition,
} from './practice-flow-types.ts'

const PRACTICE_DISPLAY_POLICY_KEY: InjectionKey<ComputedRef<EffectiveDisplay>> = Symbol('practiceDisplayPolicy')
const PRACTICE_DISPLAY_ACTIONS_KEY: InjectionKey<{
  toggleDictation: () => void
  toggleTranslate: () => void
}> = Symbol('practiceDisplayActions')

interface PracticeLocalReveal {
  showFullWord: boolean
  showWordResult: boolean
}

/** 合并当前 Phase 显隐与用户临时 override。 */
function mergeDisplay(base: PracticeDisplayPolicy, override: PracticeDisplayOverride | null): PracticeDisplayPolicy {
  if (!override) return base
  return { ...base, ...override }
}

/** Policy → 模板使用的基础 EffectiveDisplay。 */
function toEffective(policy: PracticeDisplayPolicy): EffectiveDisplay {
  return {
    ...policy,
    showWordMask: policy.wordMask !== 'none',
    translate: policy.showWordTranslation,
    showPhoneticShadow: policy.showPhonetic === 'shadow' || policy.wordMask !== 'none',
    isDictationInput: policy.inputMode === 'dictation',
  }
}

/** TypeWordV2 的临时揭示层，只影响当前单词，不影响 Footer / WordList。 */
function applyLocalReveal(display: EffectiveDisplay, localReveal: PracticeLocalReveal): EffectiveDisplay {
  if (!localReveal.showFullWord && !localReveal.showWordResult) return display

  return {
    ...display,
    wordMask: 'none',
    showWordMask: false,
    showPhonetic: true,
    showPhoneticShadow: false,
    showWordTranslation: true,
    showSentences: true,
    showSentenceTranslation: true,
    showPhrases: true,
    showSynos: true,
    showEtymology: true,
    showRelWords: true,
    translate: true,
  }
}

/** 构造页面级 effective，不包含 TypeWordV2 的局部揭示状态。 */
function createEffectiveDisplay(
  currentPhase: ComputedRef<PracticePhaseDefinition>,
  displayOverride: Ref<PracticeDisplayOverride | null>
): ComputedRef<EffectiveDisplay> {
  return computed(() => {
    const base = mergeDisplay(currentPhase.value.display, displayOverride.value)
    return toEffective(base)
  })
}

/** 页面级 composable：provide effective + Footer Toggle 方法 */
export function usePracticeDisplayPolicy(
  currentPhase: ComputedRef<PracticePhaseDefinition>,
  phaseKey: ComputedRef<string>
) {
  const displayOverride = ref<PracticeDisplayOverride | null>(null)
  const effective = createEffectiveDisplay(currentPhase, displayOverride)

  watch(
    phaseKey,
    (key, previousKey) => {
      if (previousKey !== undefined && key !== previousKey) displayOverride.value = null
    },
    { flush: 'sync' }
  )

  function patchDisplayOverride(override: PracticeDisplayOverride) {
    displayOverride.value = {
      ...displayOverride.value,
      ...override,
    }
  }

  function restoreDisplayOverride(override?: PracticeDisplayOverride | null) {
    displayOverride.value = override ? { ...override } : null
  }

  /** 切换默写显隐：只写 displayOverride，不写 settingStore */
  function toggleDictation() {
    const current = effective.value
    const nextMask = current.wordMask === 'none' ? 'underscore' : 'none'
    patchDisplayOverride({
      wordMask: nextMask,
    })
  }

  /** 切换翻译显隐 */
  function toggleTranslate() {
    const current = effective.value
    const next = !current.translate
    patchDisplayOverride({
      showWordTranslation: next,
      showSentenceTranslation: next,
    })
  }

  provide(PRACTICE_DISPLAY_POLICY_KEY, effective)
  provide(PRACTICE_DISPLAY_ACTIONS_KEY, { toggleDictation, toggleTranslate })

  return {
    effective,
    displayOverride,
    toggleDictation,
    toggleTranslate,
    patchDisplayOverride,
    restoreDisplayOverride,
  }
}

export function useInjectedDisplayPolicy(localReveal?: Ref<PracticeLocalReveal>): ComputedRef<EffectiveDisplay> {
  const baseDisplay = inject(PRACTICE_DISPLAY_POLICY_KEY)!
  if (!localReveal) return baseDisplay

  return computed(() => applyLocalReveal(baseDisplay.value, localReveal.value))
}

export function useInjectedDisplayActions() {
  return inject(PRACTICE_DISPLAY_ACTIONS_KEY)!
}
