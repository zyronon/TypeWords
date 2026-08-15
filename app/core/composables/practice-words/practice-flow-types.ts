import type { Word } from '@/core/types/types.ts'
import { WordPracticeMode, WordPracticeType } from '@/core/types/enum.ts'

export type PracticeNotificationLevel = 'success' | 'info' | 'warning' | 'error'

export type PracticeNotifier = (level: PracticeNotificationLevel, message: string) => void

// ─── 显隐策略 ──────────────────────────────────────────────────────────────────

export interface PracticeViewState {
  practiceType: WordPracticeType
  /** 只描述当前画面是否遮罩单词，不参与选择键入算法。 */
  isWordMasked: boolean
  isShowTranslate: boolean
  revealAll: boolean
}

// ─── 流程模型 ──────────────────────────────────────────────────────────────────

/** Step Template 的 id — 只描述"怎么练"，不关心词源 */
export type PracticeStepTemplateId = 'followWrite' | 'spell' | 'listen' | 'dictation' | 'identify'

/** Step Template 的名称和练习类型元数据。 */
export interface PracticeStepTemplate {
  id: PracticeStepTemplateId
  label: string
  practiceType: WordPracticeType
}

/** 词表来源 */
export type PracticeWordsSource = 'taskNew' | 'taskReview' | 'current' | 'wrongWords'

// ─── wordLoop 子步骤 ────────────────────────────────────────────────────────────

/** wordLoop 每组完成后的子练习步骤 */
export interface PracticeLoopSubStep {
  templateId: PracticeStepTemplateId
  label?: string
}

/** 词内推进配置 */
export type PracticeWordAdvanceConfig =
  | { type: 'increment' }
  | {
      type: 'wordLoop'
      groupSize: number
      /** 每组练完后依次执行的子步骤；全部完成后回主步骤继续下一组 */
      subSteps: PracticeLoopSubStep[]
    }

// ─── onEnd 串行动作系统 ─────────────────────────────────────────────────────────

/** 错词清空动作：交互型，暂停队列直到错词为 0 */
export interface PracticeWrongWordClearAction {
  type: 'wrongWordClear'
  templateId: PracticeStepTemplateId
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
  target: 'nextStep' | 'complete'
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
  /** 当前是否处于错词清空阶段 */
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

// ─── 阶段定义（cursor-native，不含 stage 字段） ──────────────────────────────────

export interface WordAdvanceRule {
  type: 'increment' | 'wordLoop'
  groupSize?: number
  subSteps?: PracticeLoopSubStep[]
}

export interface PracticePhaseDefinition {
  /** 练习类型（FollowWrite / Listen / Dictation / Identify / Spell） */
  practiceType: WordPracticeType
  wordAdvance: WordAdvanceRule
  /** 词表练完后执行的动作队列（替代 requireWrongWordClear） */
  onEnd: PracticeEndAction[]
}

// ─── 流程启动结果 ────────────────────────────────────────────────────────────────

export interface FlowStartResult {
  words: Word[]
  total: number
  newWordNumber: number
  reviewWordNumber: number
  cursor: PracticeFlowCursor
}

// ─── 持久化快照 ─────────────────────────────────────────────────────────────────

export interface PracticeSessionSnapshot {
  flowId: string
  cursor: PracticeFlowCursor
  /** 当前 Node 经前序 Step 处理后的工作词表；下一 Step 以它为输入。 */
  nodeWorkingWordKeys?: string[]
}
