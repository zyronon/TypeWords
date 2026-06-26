import type { PracticeData, TaskWords, Word } from '@typewords/core/types/types.ts'
import type { PracticeState } from '@typewords/core/stores/practice.ts'
import {
  IdentifyMethod,
  WordPracticeMode,
  WordPracticeStage,
  WordPracticeType,
} from '@typewords/core/types/enum.ts'

export interface PracticePhaseKey {
  mode: WordPracticeMode
  stage: WordPracticeStage
  practiceType: WordPracticeType
  isTypingWrongWord?: boolean
}

export interface PracticeDisplayPolicy {
  /** 显隐数据源：v2 统一走 sessionDisplay + override，不再读 settingStore */
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

export interface WordAdvanceRule {
  type: 'increment' | 'wordLoop' | 'identify-complete'
  groupSize?: number
}

export interface StageAdvanceRule {
  nextStage?: WordPracticeStage
  complete?: boolean
  wordsFrom: 'taskNew' | 'taskReview' | 'wrongWords' | 'current'
  shuffle?: boolean
  toast?: string
  forcePracticeType?: WordPracticeType
  forceWrongWordMode?: boolean
}

export interface PracticePhaseDefinition {
  key: PracticePhaseKey
  display: PracticeDisplayPolicy
  wordAdvance: WordAdvanceRule
  stageAdvance: StageAdvanceRule
  /**
   * 本阶段列表练完后：若仍有错词，必须先练到 0 才能进入下一阶段。
   * 与 wordLoop 类似，由流程块配置；错词复习中的显隐/推进继承本阶段主相位。
   */
  requireWrongWordClear: boolean
}

export interface SessionContext {
  mode: WordPracticeMode
  stage: WordPracticeStage
  practiceType: WordPracticeType
  identifyMethod: IdentifyMethod
  practiceData: PracticeData
  taskWords: TaskWords
}

export interface PracticeSessionSnapshot {
  wordPracticeType: WordPracticeType
  identifyMethod: IdentifyMethod
  isTypingWrongWord: boolean
  wordPracticeMode: WordPracticeMode
  flowId: string
  flowVersion?: number
  customFlowHash?: string
  sessionDisplay?: PracticeDisplayPolicy
  displayOverride?: PracticeDisplayOverride | null
}

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
  /** 显隐数据源：v2 统一走 sessionDisplay + override，不再读 settingStore */
  source: 'phase'
}

/** 阶段块模板 id — 可序列化，供 builtin-flows 与用户 JSON 引用 */
export type PhaseTemplateId =
  | 'followWriteNew'
  | 'listenNew'
  | 'dictationNew'
  | 'identifyNew'
  | 'identifyReview'
  | 'listenReview'
  | 'dictationReview'
  | 'shuffle'
  | 'freePractice'

/** 流程中的一个阶段块（可序列化配置） */
export interface PracticeFlowPhaseBlock {
  templateId: PhaseTemplateId
  /** 覆盖模板默认 stage（一般不需要） */
  stage?: WordPracticeStage
  /** 本阶段练习词表来源；默认由模板决定 */
  wordsFrom?: 'taskNew' | 'taskReview' | 'current'
  /** 阶段结束时加载下一阶段的词表来源；默认取下一阶段的 wordsFrom */
  advanceWordsFrom?: 'taskNew' | 'taskReview' | 'wrongWords' | 'current'
  /** 进入下一阶段时是否 shuffle */
  shuffle?: boolean
  /** 跟写阶段：7 词一组 + Spell 子相位 */
  wordLoop?: boolean
  groupSize?: number
  /**
   * 本阶段结束时：若还有错词，必须先练到 0 再进下一阶段（与 v1 每阶段末尾检查错词一致）。
   * 默认 true；设为 false 则本阶段结束直接 stageAdvance，错词可带到后续阶段。
   */
  requireWrongWordClear?: boolean
  toast?: string
}

/** 完整练习流程配置（可 JSON 序列化，Phase 2.5 用户编排存此结构） */
export interface PracticeFlowConfig {
  id: string
  version: number
  mode: WordPracticeMode
  label: string
  phases: PracticeFlowPhaseBlock[]
}

export interface ActiveFlowRegistry {
  config: PracticeFlowConfig
  phasesByStage: Map<WordPracticeStage, PracticePhaseDefinition>
  /** 阶段顺序，供进度条、保存判断等使用 */
  stageSequence: WordPracticeStage[]
  /**
   * 跟写阶段「7 词一组」内的 Spell 子相位定义。
   * 当 flow 含 wordLoop 块（如 followWriteNew）时由 compile 派生；
   * 用户练完一组跟写、进入组内拼写时 resolvePhase 返回此对象（practiceType=Spell、DISPLAY_SPELL）。
   * 无 wordLoop 的流程（如自由/听写单阶段）为 null。
   */
  spellInGroup: PracticePhaseDefinition | null
  firstPhase: PracticePhaseDefinition
}

export interface FlowStartResult {
  stage: WordPracticeStage
  practiceType: WordPracticeType
  words: Word[]
  total: number
  newWordNumber: number
  reviewWordNumber: number
}

export type PracticeWordCacheV2WithSnapshot = {
  taskWords: TaskWords
  practiceData?: PracticeData
  statStoreData?: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}
