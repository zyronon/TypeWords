import {
  WordPracticeMode,
  WordPracticeStage,
  WordPracticeType,
} from '@typewords/core/types/enum.ts'
import type { PracticeDisplayPolicy, PracticePhaseDefinition } from './registry-types.ts'

export const GROUP_SIZE = 7

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

export const DISPLAY_FREE = phaseDisplay({
  source: 'settingStore',
})

function def(
  mode: WordPracticeMode,
  stage: WordPracticeStage,
  practiceType: WordPracticeType,
  display: PracticeDisplayPolicy,
  wordAdvance: PracticePhaseDefinition['wordAdvance'],
  stageAdvance: PracticePhaseDefinition['stageAdvance'],
  isTypingWrongWord = false
): PracticePhaseDefinition {
  return {
    key: { mode, stage, practiceType, isTypingWrongWord },
    display,
    wordAdvance,
    stageAdvance,
  }
}

export const SPELL_IN_GROUP = def(
  WordPracticeMode.System,
  WordPracticeStage.FollowWriteNewWord,
  WordPracticeType.Spell,
  DISPLAY_SPELL,
  { type: 'wordLoop', groupSize: GROUP_SIZE },
  { wordsFrom: 'taskNew', shuffle: true, nextStage: WordPracticeStage.ListenNewWord }
)

export const FREE_NORMAL = def(
  WordPracticeMode.Free,
  WordPracticeStage.FollowWriteNewWord,
  WordPracticeType.FollowWrite,
  DISPLAY_FREE,
  { type: 'increment' },
  { wordsFrom: 'current', complete: true }
)

export const FREE_WRONG_REVIEW = def(
  WordPracticeMode.Free,
  WordPracticeStage.FollowWriteNewWord,
  WordPracticeType.FollowWrite,
  DISPLAY_FREE,
  { type: 'increment' },
  { wordsFrom: 'wrongWords', shuffle: true, complete: true, forceWrongWordMode: true },
  true
)

export const STRUCTURED_WRONG_REVIEW = def(
  WordPracticeMode.System,
  WordPracticeStage.FollowWriteNewWord,
  WordPracticeType.FollowWrite,
  DISPLAY_FOLLOW_WRITE,
  { type: 'wordLoop', groupSize: GROUP_SIZE },
  { wordsFrom: 'wrongWords', shuffle: true, forceWrongWordMode: true, forcePracticeType: WordPracticeType.FollowWrite },
  true
)

export function createStagePhase(
  mode: WordPracticeMode,
  stage: WordPracticeStage,
  practiceType: WordPracticeType,
  display: PracticeDisplayPolicy,
  wordAdvance: PracticePhaseDefinition['wordAdvance'],
  stageAdvance: PracticePhaseDefinition['stageAdvance']
): PracticePhaseDefinition {
  return def(mode, stage, practiceType, display, wordAdvance, stageAdvance)
}
