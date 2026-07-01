/**
 * Step Template 库：只描述「怎么练」（展示策略 + 练习类型），不关心词源和阶段流转。
 *
 * 4 个纯动作模板：followWrite / listen / dictation / identify
 * 不含 stage / wordsFrom / wordLoop / shuffle 等——这些全部在 flow step 配置中声明。
 */
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import type {
  PracticeDisplayPolicy,
  PracticePhaseDefinition,
  PracticeStepTemplate,
  PracticeStepTemplateId,
  StepAdvanceRule,
} from './registry-types.ts'

/** 跟写分组大小，与 v1 groupSize 一致，不可用户编排 */
export const GROUP_SIZE = 7

/** 内部：拼一条默认显隐策略 */
function phaseDisplay(overrides: Partial<PracticeDisplayPolicy>): PracticeDisplayPolicy {
  return {
    source: 'phase',
    wordMask: 'none',
    showPhonetic: true,
    showWordTranslation: true,
    showSentences: true,
    showSentenceTranslation: true,
    showPhrases: true,
    showEtymology: true,
    showRelWords: true,
    inputMode: 'typing',
    allowWordTip: true,
    autoNextWord: true,
    ...overrides,
  }
}

export const DISPLAY_FOLLOW_WRITE = phaseDisplay({
  wordMask: 'none',
  showSentences: true,
  inputMode: 'typing',
})

export const DISPLAY_SPELL = phaseDisplay({
  wordMask: 'underscore',
  showPhonetic: 'shadow',
  showSentences: true,
  inputMode: 'typing',
})

export const DISPLAY_LISTEN = phaseDisplay({
  wordMask: 'underscore',
  showPhonetic: 'shadow',
  showWordTranslation: false,
  showSentences: false,
  showSentenceTranslation: false,
  showPhrases: false,
  showEtymology: false,
  showRelWords: false,
  inputMode: 'listen',
})

export const DISPLAY_DICTATION = phaseDisplay({
  wordMask: 'hidden',
  showPhonetic: 'shadow',
  showSentences: false,
  showSentenceTranslation: false,
  showPhrases: false,
  showEtymology: false,
  showRelWords: false,
  inputMode: 'dictation',
})

export const DISPLAY_IDENTIFY = phaseDisplay({
  wordMask: 'none',
  showPhonetic: false,
  showWordTranslation: false,
  showSentences: false,
  showSentenceTranslation: false,
  showPhrases: false,
  showEtymology: false,
  showRelWords: false,
  inputMode: 'identify-self',
})

/** 4 个纯动作模板 */
export const STEP_TEMPLATE_META: Record<PracticeStepTemplateId, PracticeStepTemplate> = {
  followWrite: {
    id: 'followWrite',
    label: '跟写',
    practiceType: WordPracticeType.FollowWrite,
    display: DISPLAY_FOLLOW_WRITE,
  },
  listen: {
    id: 'listen',
    label: '听写',
    practiceType: WordPracticeType.Listen,
    display: DISPLAY_LISTEN,
  },
  dictation: {
    id: 'dictation',
    label: '默写',
    practiceType: WordPracticeType.Dictation,
    display: DISPLAY_DICTATION,
  },
  identify: {
    id: 'identify',
    label: '自测',
    practiceType: WordPracticeType.Identify,
    display: DISPLAY_IDENTIFY,
  },
}

/** 占位 stepAdvance（compiler 会覆盖，这里只供 buildSpellInGroupPhase 继承） */
const PLACEHOLDER_STEP_ADVANCE: StepAdvanceRule = { nextSource: 'current', complete: false }

/**
 * 从「跟写主相位」派生 Spell 子相位。
 * 显隐改为 DISPLAY_SPELL；practiceType 改为 Spell；其余继承主相位。
 */
export function buildSpellInGroupPhase(parent: PracticePhaseDefinition): PracticePhaseDefinition {
  return {
    practiceType: WordPracticeType.Spell,
    display: DISPLAY_SPELL,
    wordAdvance: parent.wordAdvance,
    stepAdvance: parent.stepAdvance,
    requireWrongWordClear: parent.requireWrongWordClear,
  }
}

/**
 * 由「当前阶段主相位」派生错词复习相位。
 * practiceType 改为 FollowWrite；显隐/推进继承主相位。
 */
export function buildWrongWordReviewFromParent(parent: PracticePhaseDefinition): PracticePhaseDefinition {
  return {
    ...parent,
    practiceType: WordPracticeType.FollowWrite,
  }
}
