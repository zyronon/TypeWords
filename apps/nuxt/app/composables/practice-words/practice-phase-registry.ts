import {
  WordPracticeMode,
  WordPracticeStage,
  WordPracticeType,
} from '@typewords/core/types/enum.ts'
import { getFlowIdForMode } from './builtin-flows.ts'
import {
  createStagePhase,
  DISPLAY_DICTATION,
  DISPLAY_FOLLOW_WRITE,
  DISPLAY_FREE,
  DISPLAY_IDENTIFY,
  DISPLAY_LISTEN,
  FREE_NORMAL,
  FREE_WRONG_REVIEW,
  GROUP_SIZE,
  SPELL_IN_GROUP,
  STRUCTURED_WRONG_REVIEW,
} from './phase-templates.ts'
import type { PracticePhaseDefinition, SessionContext } from './registry-types.ts'

let activeFlowId = 'system'

export function loadPracticeFlow(flowId: string) {
  activeFlowId = flowId
}

export function getActiveFlowId() {
  return activeFlowId
}

function incrementAdvance(
  wordsFrom: PracticePhaseDefinition['stageAdvance']['wordsFrom'],
  options: Partial<PracticePhaseDefinition['stageAdvance']> = {}
): PracticePhaseDefinition['stageAdvance'] {
  return { wordsFrom, ...options }
}

const SYSTEM_PHASES: Partial<Record<WordPracticeStage, PracticePhaseDefinition>> = {
  [WordPracticeStage.FollowWriteNewWord]: createStagePhase(
    WordPracticeMode.System,
    WordPracticeStage.FollowWriteNewWord,
    WordPracticeType.FollowWrite,
    DISPLAY_FOLLOW_WRITE,
    { type: 'wordLoop', groupSize: GROUP_SIZE },
    incrementAdvance('taskNew', { shuffle: true, nextStage: WordPracticeStage.ListenNewWord })
  ),
  [WordPracticeStage.ListenNewWord]: createStagePhase(
    WordPracticeMode.System,
    WordPracticeStage.ListenNewWord,
    WordPracticeType.Listen,
    DISPLAY_LISTEN,
    { type: 'increment' },
    incrementAdvance('taskNew', { shuffle: true, nextStage: WordPracticeStage.DictationNewWord })
  ),
  [WordPracticeStage.DictationNewWord]: createStagePhase(
    WordPracticeMode.System,
    WordPracticeStage.DictationNewWord,
    WordPracticeType.Dictation,
    DISPLAY_DICTATION,
    { type: 'increment' },
    incrementAdvance('taskReview', { nextStage: WordPracticeStage.IdentifyReview })
  ),
  [WordPracticeStage.IdentifyReview]: createStagePhase(
    WordPracticeMode.System,
    WordPracticeStage.IdentifyReview,
    WordPracticeType.Identify,
    DISPLAY_IDENTIFY,
    { type: 'increment' },
    incrementAdvance('taskReview', { shuffle: true, nextStage: WordPracticeStage.ListenReview })
  ),
  [WordPracticeStage.ListenReview]: createStagePhase(
    WordPracticeMode.System,
    WordPracticeStage.ListenReview,
    WordPracticeType.Listen,
    DISPLAY_LISTEN,
    { type: 'increment' },
    incrementAdvance('taskReview', { shuffle: true, nextStage: WordPracticeStage.DictationReview })
  ),
  [WordPracticeStage.DictationReview]: createStagePhase(
    WordPracticeMode.System,
    WordPracticeStage.DictationReview,
    WordPracticeType.Dictation,
    DISPLAY_DICTATION,
    { type: 'increment' },
    incrementAdvance('current', { complete: true })
  ),
}

const REVIEW_PHASES: Partial<Record<WordPracticeStage, PracticePhaseDefinition>> = {
  [WordPracticeStage.IdentifyReview]: createStagePhase(
    WordPracticeMode.Review,
    WordPracticeStage.IdentifyReview,
    WordPracticeType.Identify,
    DISPLAY_IDENTIFY,
    { type: 'increment' },
    incrementAdvance('taskReview', { shuffle: true, nextStage: WordPracticeStage.ListenReview })
  ),
  [WordPracticeStage.ListenReview]: createStagePhase(
    WordPracticeMode.Review,
    WordPracticeStage.ListenReview,
    WordPracticeType.Listen,
    DISPLAY_LISTEN,
    { type: 'increment' },
    incrementAdvance('taskReview', { shuffle: true, nextStage: WordPracticeStage.DictationReview })
  ),
  [WordPracticeStage.DictationReview]: createStagePhase(
    WordPracticeMode.Review,
    WordPracticeStage.DictationReview,
    WordPracticeType.Dictation,
    DISPLAY_DICTATION,
    { type: 'increment' },
    incrementAdvance('current', { complete: true })
  ),
}

const IDENTIFY_ONLY_PHASES: Partial<Record<WordPracticeStage, PracticePhaseDefinition>> = {
  [WordPracticeStage.IdentifyNewWord]: createStagePhase(
    WordPracticeMode.IdentifyOnly,
    WordPracticeStage.IdentifyNewWord,
    WordPracticeType.Identify,
    DISPLAY_IDENTIFY,
    { type: 'increment' },
    incrementAdvance('taskReview', { nextStage: WordPracticeStage.IdentifyReview })
  ),
  [WordPracticeStage.IdentifyReview]: createStagePhase(
    WordPracticeMode.IdentifyOnly,
    WordPracticeStage.IdentifyReview,
    WordPracticeType.Identify,
    DISPLAY_IDENTIFY,
    { type: 'increment' },
    incrementAdvance('current', { complete: true })
  ),
}

const DICTATION_ONLY_PHASES: Partial<Record<WordPracticeStage, PracticePhaseDefinition>> = {
  [WordPracticeStage.DictationNewWord]: createStagePhase(
    WordPracticeMode.DictationOnly,
    WordPracticeStage.DictationNewWord,
    WordPracticeType.Dictation,
    DISPLAY_DICTATION,
    { type: 'increment' },
    incrementAdvance('taskReview', { nextStage: WordPracticeStage.DictationReview })
  ),
  [WordPracticeStage.DictationReview]: createStagePhase(
    WordPracticeMode.DictationOnly,
    WordPracticeStage.DictationReview,
    WordPracticeType.Dictation,
    DISPLAY_DICTATION,
    { type: 'increment' },
    incrementAdvance('current', { complete: true })
  ),
}

const LISTEN_ONLY_PHASES: Partial<Record<WordPracticeStage, PracticePhaseDefinition>> = {
  [WordPracticeStage.ListenNewWord]: createStagePhase(
    WordPracticeMode.ListenOnly,
    WordPracticeStage.ListenNewWord,
    WordPracticeType.Listen,
    DISPLAY_LISTEN,
    { type: 'increment' },
    incrementAdvance('taskReview', { nextStage: WordPracticeStage.ListenReview })
  ),
  [WordPracticeStage.ListenReview]: createStagePhase(
    WordPracticeMode.ListenOnly,
    WordPracticeStage.ListenReview,
    WordPracticeType.Listen,
    DISPLAY_LISTEN,
    { type: 'increment' },
    incrementAdvance('current', { complete: true })
  ),
}

const SHUFFLE_PHASES: Partial<Record<WordPracticeStage, PracticePhaseDefinition>> = {
  [WordPracticeStage.Shuffle]: createStagePhase(
    WordPracticeMode.Shuffle,
    WordPracticeStage.Shuffle,
    WordPracticeType.Dictation,
    DISPLAY_DICTATION,
    { type: 'increment' },
    incrementAdvance('current', { complete: true })
  ),
}

const MODE_STAGE_MAP: Partial<
  Record<WordPracticeMode, Partial<Record<WordPracticeStage, PracticePhaseDefinition>>>
> = {
  [WordPracticeMode.System]: SYSTEM_PHASES,
  [WordPracticeMode.Free]: {
    [WordPracticeStage.FollowWriteNewWord]: FREE_NORMAL,
  },
  [WordPracticeMode.Review]: REVIEW_PHASES,
  [WordPracticeMode.IdentifyOnly]: IDENTIFY_ONLY_PHASES,
  [WordPracticeMode.DictationOnly]: DICTATION_ONLY_PHASES,
  [WordPracticeMode.ListenOnly]: LISTEN_ONLY_PHASES,
  [WordPracticeMode.Shuffle]: SHUFFLE_PHASES,
}

export function buildSessionContext(
  mode: WordPracticeMode,
  stage: WordPracticeStage,
  practiceType: WordPracticeType,
  identifyMethod: SessionContext['identifyMethod'],
  practiceData: SessionContext['practiceData'],
  taskWords: SessionContext['taskWords']
): SessionContext {
  return { mode, stage, practiceType, identifyMethod, practiceData, taskWords }
}

export function resolvePhase(ctx: SessionContext): PracticePhaseDefinition {
  if (ctx.practiceData.isTypingWrongWord) {
    return ctx.mode === WordPracticeMode.Free ? FREE_WRONG_REVIEW : STRUCTURED_WRONG_REVIEW
  }

  if (
    ctx.mode !== WordPracticeMode.Free &&
    ctx.stage === WordPracticeStage.FollowWriteNewWord &&
    ctx.practiceType === WordPracticeType.Spell
  ) {
    return SPELL_IN_GROUP
  }

  const phase = MODE_STAGE_MAP[ctx.mode]?.[ctx.stage]
  if (phase) return phase

  return createStagePhase(
    ctx.mode,
    ctx.stage,
    ctx.practiceType,
    DISPLAY_FREE,
    { type: 'increment' },
    { wordsFrom: 'current', complete: true }
  )
}

export function resolvePhaseFromLegacy(
  mode: WordPracticeMode,
  stage: WordPracticeStage,
  practiceType: WordPracticeType,
  identifyMethod: SessionContext['identifyMethod'],
  practiceData: SessionContext['practiceData'],
  taskWords: SessionContext['taskWords']
): PracticePhaseDefinition {
  loadPracticeFlow(getFlowIdForMode(mode))
  return resolvePhase(buildSessionContext(mode, stage, practiceType, identifyMethod, practiceData, taskWords))
}
