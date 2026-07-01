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
  Pick<PracticeDisplayPolicy, 'wordMask' | 'showWordTranslation' | 'showSentences' | 'showSentenceTranslation'>
>

export interface EffectiveDisplay {
  showSentences: boolean
  showSentenceTranslation: boolean
  showWordTranslation: boolean
  showPhrases: boolean
  showEtymology: boolean
  showRelWords: boolean
  wordMask: 'none' | 'underscore' | 'hidden'
  dictation: boolean
  translate: boolean
  showPhoneticShadow: boolean
  isDictationInput: boolean
  source: 'phase'
}

// ─── 三层模型 ──────────────────────────────────────────────────────────────────

/** Step Template 的 id — 只描述"怎么练"，不关心词源 */
export type PracticeStepTemplateId =
  | 'followWrite'
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

/** 词内推进配置 */
export type PracticeWordAdvanceConfig =
  | { type: 'increment' }
  | { type: 'wordLoop'; groupSize?: number }

/** Flow 中的一个 Step（可序列化） */
export interface PracticeFlowStep {
  templateId: PracticeStepTemplateId
  label?: string
  displayOverride?: Partial<PracticeDisplayPolicy>
  wordAdvance?: PracticeWordAdvanceConfig
  requireWrongWordClear?: boolean
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
  /** 跟写分组内的 Spell 子步骤 */
  spellSubStep: boolean
  /** 当前正在错词复习 */
  wrongRetry: boolean
}

/** cursor 序列化 key，用于 phasesByCursor Map */
export function cursorKey(nodeIndex: number, stepIndex: number): string {
  return `${nodeIndex}:${stepIndex}`
}

// ─── 阶段定义（cursor-native，不含 stage 字段） ──────────────────────────────────

export interface WordAdvanceRule {
  type: 'increment' | 'wordLoop'
  groupSize?: number
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
  requireWrongWordClear: boolean
}

// ─── 运行时注册表 ────────────────────────────────────────────────────────────────

export interface ActiveFlowRegistry {
  config: PracticeFlowConfig
  /** cursor key → 已编译阶段定义 */
  phasesByCursor: Map<string, PracticePhaseDefinition>
  /**
   * 跟写阶段「7 词一组」内的 Spell 子相位定义。
   * 含 wordLoop step 时由 compile 派生；无 wordLoop 时为 null。
   */
  spellInGroup: PracticePhaseDefinition | null
  firstPhase: PracticePhaseDefinition
  initialCursor: PracticeFlowCursor
  /** 所有静态 cursor 坐标（不含 spell/wrongRetry），供 Footer 进度条用 */
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
