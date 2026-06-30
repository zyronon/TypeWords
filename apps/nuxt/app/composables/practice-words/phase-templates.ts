/**
 * 阶段块「模板库」：每种 templateId 的默认 stage、练习类型、显隐、词表来源。
 *
 * 编排器 / builtin-flows 只引用 templateId + 少量覆盖项；
 * 具体 DISPLAY_* 和 WordPracticeStage 写在这里，避免 JSON 里塞大对象。
 */
import {
  WordPracticeMode,
  WordPracticeStage,
  WordPracticeType,
} from '@typewords/core/types/enum.ts'
import type {
  PhaseTemplateId,
  PracticeDisplayPolicy,
  PracticeFlowPhaseBlock,
  PracticePhaseDefinition,
} from './registry-types.ts'

/** 跟写分组大小，与 v1 groupSize 一致，不可用户编排 */
export const GROUP_SIZE = 7

/** 内部：拼一条结构化模式的默认显隐策略 */
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

export interface PhaseTemplateMeta {
  stage: WordPracticeStage
  practiceType: WordPracticeType
  display: PracticeDisplayPolicy
  practiceWordsFrom: 'taskNew' | 'taskReview' | 'current'
  wordLoop?: boolean
  shuffleOnAdvance?: boolean
  advanceToast?: string
  /** 本阶段结束是否要求错词清零后再进下一阶段；内置模板默认 true */
  requireWrongWordClear?: boolean
}

/** 阶段块模板库 — Phase 2.5 拖拽编排从此选块 */
export const PHASE_TEMPLATE_META: Record<PhaseTemplateId, PhaseTemplateMeta> = {
  followWriteNew: {
    stage: WordPracticeStage.FollowWriteNewWord,
    practiceType: WordPracticeType.FollowWrite,
    display: DISPLAY_FOLLOW_WRITE,
    practiceWordsFrom: 'taskNew',
    wordLoop: true,
    shuffleOnAdvance: true,
    advanceToast: '开始听写新词',
  },
  listenNew: {
    stage: WordPracticeStage.ListenNewWord,
    practiceType: WordPracticeType.Listen,
    display: DISPLAY_LISTEN,
    practiceWordsFrom: 'taskNew',
    shuffleOnAdvance: true,
    advanceToast: '开始默写新词',
  },
  dictationNew: {
    stage: WordPracticeStage.DictationNewWord,
    practiceType: WordPracticeType.Dictation,
    display: DISPLAY_DICTATION,
    practiceWordsFrom: 'taskNew',
    advanceToast: '开始自测旧词',
  },
  identifyNew: {
    stage: WordPracticeStage.IdentifyNewWord,
    practiceType: WordPracticeType.Identify,
    display: DISPLAY_IDENTIFY,
    practiceWordsFrom: 'taskNew',
    advanceToast: '开始自测旧词',
  },
  identifyReview: {
    stage: WordPracticeStage.IdentifyReview,
    practiceType: WordPracticeType.Identify,
    display: DISPLAY_IDENTIFY,
    practiceWordsFrom: 'taskReview',
    shuffleOnAdvance: true,
    advanceToast: '开始听写旧词',
  },
  listenReview: {
    stage: WordPracticeStage.ListenReview,
    practiceType: WordPracticeType.Listen,
    display: DISPLAY_LISTEN,
    practiceWordsFrom: 'taskReview',
    shuffleOnAdvance: true,
    advanceToast: '开始默写旧词',
  },
  dictationReview: {
    stage: WordPracticeStage.DictationReview,
    practiceType: WordPracticeType.Dictation,
    display: DISPLAY_DICTATION,
    practiceWordsFrom: 'taskReview',
  },
  shuffle: {
    stage: WordPracticeStage.Shuffle,
    practiceType: WordPracticeType.Dictation,
    display: DISPLAY_DICTATION,
    // Shuffle 模式洗牌复习的是旧词（taskReview），与 System/Review 等 taskReview 阶段一致
    practiceWordsFrom: 'taskReview',
  },
  freePractice: {
    stage: WordPracticeStage.FollowWriteNewWord,
    practiceType: WordPracticeType.FollowWrite,
    display: DISPLAY_FOLLOW_WRITE,
    practiceWordsFrom: 'current',
  },
}

/** 内部：构造带 isTypingWrongWord 标记的阶段定义 */
/**
 * 从「跟写主相位」派生 Spell 子相位
 */
export function buildSpellInGroupPhase(parent: PracticePhaseDefinition): PracticePhaseDefinition {
  return {
    key: { ...parent.key, practiceType: WordPracticeType.Spell },
    display: DISPLAY_SPELL,
    wordAdvance: parent.wordAdvance,
    stageAdvance: parent.stageAdvance,
    requireWrongWordClear: parent.requireWrongWordClear,
  }
}

/**
 * 由「当前阶段主相位」派生错词复习相位（isTypingWrongWord=true）。
 * 仍在同一 stage，显隐与 wordAdvance 继承主相位；练完错词列表后回到主相位再 stageAdvance。
 */
export function buildWrongWordReviewFromParent(parent: PracticePhaseDefinition): PracticePhaseDefinition {
  return {
    ...parent,
    key: {
      ...parent.key,
      practiceType: WordPracticeType.FollowWrite,
      isTypingWrongWord: true,
    },
  }
}

/**
 * 取阶段块的模板元数据。
 * 【薄封装】block.templateId 索引 PHASE_TEMPLATE_META；compile 时用。
 */
export function resolveBlockMeta(block: PracticeFlowPhaseBlock): PhaseTemplateMeta {
  return PHASE_TEMPLATE_META[block.templateId]
}

/**
 * 解析阶段块对应的 WordPracticeStage（block.stage 可覆盖模板默认）。
 */
export function resolveBlockStage(block: PracticeFlowPhaseBlock): WordPracticeStage {
  return block.stage ?? PHASE_TEMPLATE_META[block.templateId].stage
}

/**
 * 解析「本阶段练习哪份词表」（block.wordsFrom 可覆盖模板默认）。
 * init 首阶段、compile 阶段推进时都会用。
 */
export function resolveBlockWordsFrom(
  block: PracticeFlowPhaseBlock
): 'taskNew' | 'taskReview' | 'current' {
  return block.wordsFrom ?? PHASE_TEMPLATE_META[block.templateId].practiceWordsFrom
}
