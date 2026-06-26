/**
 * 练习页「冷启动」：根据 flow 决定初始 stage、词表、统计字段。
 *
 * 替代 v1 initData 里对 WordPracticeModeStageMap 的大段 if-else。
 */
import type { TaskWords } from '@typewords/core/types/types.ts'
import { WordPracticeMode, WordPracticeType } from '@typewords/core/types/enum.ts'
import { getFlowIdForMode } from './builtin-flows.ts'
import { resolveBlockStage, resolveBlockWordsFrom } from './phase-templates.ts'
import { getActiveRegistry, loadPracticeFlow } from './practice-phase-registry.ts'
import type { FlowStartResult, PracticeFlowConfig } from './registry-types.ts'

/**
 * 当「今天没有新词、只有复习词」时，应从 flow 里哪个 stage 开始。
 * 规则：找第一个 practiceWordsFrom === taskReview 的块；找不到则用第一块。
 * （例如 System → IdentifyReview，Free → FollowWriteNewWord）
 */
function findReviewOnlyStartStage(config: PracticeFlowConfig) {
  for (const block of config.phases) {
    const wordsFrom = resolveBlockWordsFrom(block)
    if (wordsFrom === 'taskReview') {
      return resolveBlockStage(block)
    }
  }
  return resolveBlockStage(config.phases[0])
}

/** 内部：把 wordsFrom 枚举映射到 taskWords 里的具体数组 */
function resolveWordsForSource(
  source: 'taskNew' | 'taskReview' | 'current',
  taskWords: TaskWords
) {
  switch (source) {
    case 'taskNew':
      return taskWords.new
    case 'taskReview':
      return taskWords.review
    case 'current':
      return [...taskWords.new, ...taskWords.review]
  }
}

/**
 * 练习开始前调用：加载 flow 并算出初始 stage / words / 计数。
 *
 * @throws 'NO_WORDS' 无词可练时，页面应 toast 并跳回词书列表
 *
 * 调用方：practice-words-v2/[id].vue 的 initData（非缓存恢复分支）
 */
export function resolveFlowStart(
  mode: WordPracticeMode,
  taskWords: TaskWords,
  flowId?: string
): FlowStartResult {
  loadPracticeFlow(flowId ?? getFlowIdForMode(mode))
  const registry = getActiveRegistry()
  const config = registry.config

  if (config.mode === WordPracticeMode.Shuffle) {
    if (!taskWords.review.length) throw new Error('NO_WORDS')
    return {
      stage: registry.firstPhase.key.stage,
      practiceType: WordPracticeType.Dictation,
      words: taskWords.review,
      total: taskWords.review.length,
      newWordNumber: 0,
      reviewWordNumber: 0,
    }
  }

  if (config.mode === WordPracticeMode.Review) {
    if (!taskWords.review.length) throw new Error('NO_WORDS')
    const reviewPhase = registry.phasesByStage.get(findReviewOnlyStartStage(config)) ?? registry.firstPhase
    return {
      stage: reviewPhase.key.stage,
      practiceType: reviewPhase.key.practiceType,
      words: taskWords.review,
      total: taskWords.review.length,
      newWordNumber: 0,
      reviewWordNumber: taskWords.review.length,
    }
  }

  if (taskWords.new.length === 0) {
    if (!taskWords.review.length) {
      throw new Error('NO_WORDS')
    }
    const stage = findReviewOnlyStartStage(config)
    const phase = registry.phasesByStage.get(stage) ?? registry.firstPhase
    return {
      stage: phase.key.stage,
      practiceType: phase.key.practiceType,
      words: taskWords.review,
      total: taskWords.review.length + taskWords.new.length,
      newWordNumber: taskWords.new.length,
      reviewWordNumber: taskWords.review.length,
    }
  }

  const firstBlock = config.phases[0]
  const wordsFrom = resolveBlockWordsFrom(firstBlock)
  const phase = registry.firstPhase

  return {
    stage: phase.key.stage,
    practiceType: phase.key.practiceType,
    words: resolveWordsForSource(wordsFrom, taskWords),
    total: taskWords.review.length + taskWords.new.length,
    newWordNumber: taskWords.new.length,
    reviewWordNumber: taskWords.review.length,
  }
}

/**
 * 只取某 mode 下 flow 的第一个 stage。
 * 【目前无调用方，可删】当初预留给 savePracticeData 判断，已被 getActiveStageSequence 取代。
 */
export function getFlowFirstStage(mode: WordPracticeMode): ReturnType<typeof resolveFlowStart>['stage'] {
  return resolveFlowStart(mode, { new: [], review: [] }).stage
}
