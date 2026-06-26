import type { PracticeData, TaskWords } from '@typewords/core/types/types.ts'
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
  source: 'phase' | 'settingStore'
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
  source: 'phase' | 'settingStore'
}

export type PracticeFlowConfig = {
  id: string
  version: number
  mode: WordPracticeMode
  label: string
}

export type PracticeWordCacheV2WithSnapshot = {
  taskWords: TaskWords
  practiceData?: PracticeData
  statStoreData?: PracticeState
  sessionSnapshot?: PracticeSessionSnapshot
}
