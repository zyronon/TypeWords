import type { PracticeData, TaskWords, Word } from '@typewords/core/types/types.ts'
import type { PracticeState } from '@typewords/core/stores/practice.ts'
import {
  IdentifyMethod,
  WordPracticeMode,
  WordPracticeType,
} from '@typewords/core/types/enum.ts'

// ─── 显隐策略 ──────────────────────────────────────────────────────────────────

export interface PracticeDisplayPolicy {
  source: 'phase'
  wordMask: 'none' | 'underscore' | 'hidden'
  showPhonetic: boolean | 'shadow'
  showWordTranslation: boolean
  showSentences: boolean
  showSentenceTranslation: boolean
  showPhrases: boolean
  showEtymology: boolean
  showRelWords: boolean
  inputMode: 'typing' | 'dictation' | 'listen' | 'identify-self' | 'identify-test' | 'identify-quick'
  allowWordTip: boolean
  autoNextWord: boolean
}

export type PracticeDisplayOverride = Partial<
  Pick<PracticeDisplayPolicy, 'wordMask' | 'showWordTranslation' | 'showSentenceTranslation'>
>

export interface EffectiveDisplay {
  showSentences: boolean
  showSentenceTranslation: boolean
  showWordTranslation: boolean
  showPhrases: boolean
  showEtymology: boolean
  showRelWords: boolean
  wordMask: 'none' | 'underscore' | 'hidden'
  showWordMask: boolean
  translate: boolean
  showPhoneticShadow: boolean
  isDictationInput: boolean
  source: 'phase'
}

// ─── 三层模型 ──────────────────────────────────────────────────────────────────

/** Step Template 的 id — 只描述"怎么练"，不关心词源 */
export type PracticeStepTemplateId =
  | 'followWrite'
  | 'spell'
  | 'listen'
  | 'dictation'
  | 'identify'

/** Step Template — 纯动作描述（展示策略 + 练习类型） */
export interface PracticeStepTemplate {
  id: PracticeStepTemplateId
  label: string
  practiceType: WordPracticeType
  display: PracticeDisplayPolicy
}

/** 词表来源 */
export type PracticeWordsSource = 'taskNew' | 'taskReview' | 'current' | 'wrongWords'

// ─── wordLoop 子步骤 ────────────────────────────────────────────────────────────

/** wordLoop 每组完成后的子练习步骤 */
export interface PracticeLoopSubStep {
  templateId: PracticeStepTemplateId
  label?: string
  displayOverride?: Partial<PracticeDisplayPolicy>
}

/** 词内推进配置 */
export type PracticeWordAdvanceConfig =
  | { type: 'increment' }
  | {
      type: 'wordLoop'
      groupSize?: number
      /** 每组练完后依次执行的子步骤；全部完成后回主步骤继续下一组 */
      subSteps: PracticeLoopSubStep[]
    }

// ─── onEnd 串行动作系统 ─────────────────────────────────────────────────────────

/** 错词清空动作：交互型，暂停队列直到错词为 0 */
export interface PracticeWrongWordClearAction {
  type: 'wrongWordClear'
  templateId: PracticeStepTemplateId
  displayOverride?: Partial<PracticeDisplayPolicy>
  wordAdvance?: PracticeWordAdvanceConfig
}

/** 收藏错词动作：即时型 */
export interface PracticeCollectWrongWordsAction {
  type: 'collectWrongWords'
  target: 'favorite' | 'wrongBook'
}

/** 生成报告动作：即时型 */
export interface PracticeGenerateReportAction {
  type: 'generateReport'
  reportType: 'stepSummary' | 'sessionSummary'
}

/** 跳转动作：指令型 */
export interface PracticeNavigateAction {
  type: 'navigate'
  target: 'nextStep' | 'complete' | string
}

export type PracticeEndAction =
  | PracticeWrongWordClearAction
  | PracticeCollectWrongWordsAction
  | PracticeGenerateReportAction
  | PracticeNavigateAction

/** Flow 中的一个 Step（可序列化） */
export interface PracticeFlowStep {
  templateId: PracticeStepTemplateId
  label?: string
  displayOverride?: Partial<PracticeDisplayPolicy>
  wordAdvance?: PracticeWordAdvanceConfig
  /** 词表练完后按顺序执行的动作队列（替代旧 requireWrongWordClear） */
  onEnd?: PracticeEndAction[]
  shuffleOnEnter?: boolean
}

/** Flow 中的一个 Node（一批词 + 多个步骤） */
export interface PracticeFlowNode {
  id: string
  label: string
  source: PracticeWordsSource
  steps: PracticeFlowStep[]
}

/** 完整练习流程配置（可 JSON 序列化） */
export interface PracticeFlowConfig {
  id: string
  version: number
  mode: WordPracticeMode
  label: string
  nodes: PracticeFlowNode[]
}

// ─── Cursor 模型 ───────────────────────────────────────────────────────────────

/** 练习流程 Cursor — 唯一定位当前位置的指针 */
export interface PracticeFlowCursor {
  nodeIndex: number
  stepIndex: number
  /** 当前是否处于错词清空阶段；替代旧 wrongRetry */
  inWrongWordClear: boolean
  /**
   * 当前是否处于 wordLoop 子步骤。
   * null 表示不在 loop 中；
   * 非 null 时 startIndex/endIndex 指向当前组词的范围，subStepIndex 指向当前子步骤索引
   */
  loop: null | {
    startIndex: number
    endIndex: number
    subStepIndex: number
  }
  /** 当前正在执行的 onEnd action 索引；null 表示尚未进入 onEnd */
  endActionIndex: number | null
}

/** cursor 序列化 key，用于 phasesByCursor Map */
export function cursorKey(nodeIndex: number, stepIndex: number): string {
  return `${nodeIndex}:${stepIndex}`
}

// ─── 阶段定义（cursor-native，不含 stage 字段） ──────────────────────────────────

export interface WordAdvanceRule {
  type: 'increment' | 'wordLoop'
  groupSize?: number
  subSteps?: PracticeLoopSubStep[]
}

/** 词表练完后的推进规则（纯 cursor 语义，nextCursor 由 advanceCursor() 计算，无需存 nextStage） */
export interface StepAdvanceRule {
  /** 进入下一 step/node 时是否打乱词表 */
  shuffle?: boolean
  /** toast 提示文字 */
  toast?: string
  /** 最后一步 → 结束 */
  complete?: boolean
  /** 下一步词表来源（compiler 填入，Navigator 读取） */
  nextSource: PracticeWordsSource
}

export interface PracticePhaseDefinition {
  /** 练习类型（FollowWrite / Listen / Dictation / Identify / Spell） */
  practiceType: WordPracticeType
  display: PracticeDisplayPolicy
  wordAdvance: WordAdvanceRule
  stepAdvance: StepAdvanceRule
  /** 词表练完后执行的动作队列（替代 requireWrongWordClear） */
  onEnd: PracticeEndAction[]
}

// ─── 运行时注册表 ────────────────────────────────────────────────────────────────

export interface ActiveFlowRegistry {
  config: PracticeFlowConfig
  /** cursor key → 已编译阶段定义 */
  phasesByCursor: Map<string, PracticePhaseDefinition>
  firstPhase: PracticePhaseDefinition
  initialCursor: PracticeFlowCursor
  /** 所有静态 cursor 坐标（不含 loop/inWrongWordClear），供 Footer 进度条用 */
  cursorSteps: Array<{ nodeIndex: number; stepIndex: number }>
}

// ─── 流程启动结果 ────────────────────────────────────────────────────────────────

export interface FlowStartResult {
  practiceType: WordPracticeType
  words: Word[]
  total: number
  newWordNumber: number
  reviewWordNumber: number
  cursor: PracticeFlowCursor
}

// ─── 持久化快照 ─────────────────────────────────────────────────────────────────

export interface PracticeSessionSnapshot {
  wordPracticeType: WordPracticeType
  identifyMethod: IdentifyMethod
  isTypingWrongWord: boolean
  wordPracticeMode: WordPracticeMode
  flowId: string
  flowVersion?: number
  cursor?: PracticeFlowCursor
  sessionDisplay?: PracticeDisplayPolicy
  displayOverride?: PracticeDisplayOverride | null
}

// ─── cache 类型（供 practice-word-cache-v2.ts 引用） ─────────────────────────────

export type PracticeWordCacheV2WithSnapshot = {
  taskWords: TaskWords
  practiceData?: PracticeData
  statStoreData?: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}
