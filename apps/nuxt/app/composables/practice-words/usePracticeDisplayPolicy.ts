/**
 * 练习页显隐策略：TypeWordV2 / FooterV2 的唯一数据源。
 *
 * v2 统一走 sessionDisplay（Registry 按阶段写入）+ displayOverride（用户 Footer 临时 Toggle）。
 * 不再读 settingStore.dictation / translate（该二字段仍保留在 core 供 v1 使用）。
 */
import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type {
  EffectiveDisplay,
  PracticeDisplayOverride,
  PracticeDisplayPolicy,
  PracticePhaseDefinition,
} from './registry-types.ts'
import { phaseDisplay } from './phase-templates.ts'

const PRACTICE_DISPLAY_POLICY_KEY: InjectionKey<ComputedRef<EffectiveDisplay>> = Symbol('practiceDisplayPolicy')
const PRACTICE_DISPLAY_ACTIONS_KEY: InjectionKey<{
  toggleDictation: () => void
  toggleTranslate: () => void
}> = Symbol('practiceDisplayActions')

interface PracticeLocalReveal {
  showFullWord: boolean
  showWordResult: boolean
}

/** Registry applyPhase 写入的「本阶段系统显隐」 */
export const sessionDisplay = ref<PracticeDisplayPolicy | null>(null)

/** 用户 Footer 临时 Toggle 的覆盖层（仅当前相位有效，进下一阶段由 applyPhase 清空） */
export const displayOverride = ref<PracticeDisplayOverride | null>(null)

/** 上一次 applyPhase 的 phase key，用于判断 phase 是否真正变化 */
let lastPhaseKey: string | null = null

/** 合并 sessionDisplay 与用户临时 override */
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

function patchDisplayOverride(override: PracticeDisplayOverride) {
  displayOverride.value = {
    ...displayOverride.value,
    ...override,
  }
}

/**
 * 阶段变化时调用（Navigator.syncPhase 内）：写入 phase.display。
 * 仅当 phase key 与上次不同时才清空 displayOverride，避免同阶段内每词推进都重置用户覆盖。
 */
export function applyPhaseDefinition(phase: PracticePhaseDefinition, cursorKey?: string) {
  sessionDisplay.value = { ...phase.display }
  // 用 cursorKey + practiceType 标识唯一相位（跨阶段切换时清空用户 override）
  const key = cursorKey ? `${cursorKey}_${String(phase.practiceType)}` : String(phase.practiceType)
  if (key !== lastPhaseKey) {
    displayOverride.value = null
    lastPhaseKey = key
  }
}

/** 构造页面级 effective，不包含 TypeWordV2 的局部揭示状态。 */
function createEffectiveDisplay(): ComputedRef<EffectiveDisplay> {
  return computed(() => {
    const base = sessionDisplay.value
      ? mergeDisplay(sessionDisplay.value, displayOverride.value)
      : mergeDisplay(phaseDisplay(), displayOverride.value)
    return toEffective(base)
  })
}

/** 页面级 composable：provide effective + Footer Toggle 方法 */
export function usePracticeDisplayPolicy() {
  const effective = createEffectiveDisplay()

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

  return { effective, toggleDictation, toggleTranslate, patchDisplayOverride }
}

export function useInjectedDisplayPolicy(localReveal?: Ref<PracticeLocalReveal>): ComputedRef<EffectiveDisplay> {
  const baseDisplay = inject(PRACTICE_DISPLAY_POLICY_KEY)!
  if (!localReveal) return baseDisplay

  return computed(() => applyLocalReveal(baseDisplay.value, localReveal.value))
}

export function useInjectedDisplayActions() {
  return inject(PRACTICE_DISPLAY_ACTIONS_KEY)!
}
