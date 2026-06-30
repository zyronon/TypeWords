/**
 * 练习页「冷启动」：根据 flow 决定初始 stage、词表、统计字段。
 *
 * 替代 v1 initData 里对 WordPracticeModeStageMap 的大段 if-else。
 * 不再按 WordPracticeMode 分支——所有逻辑均从 flow.phases 配置推导。
 */
import type { TaskWords } from '@typewords/core/types/types.ts'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import { getFlowIdForMode } from './builtin-flows.ts'
import { resolveBlockStage, resolveBlockWordsFrom } from './phase-templates.ts'
import { getActiveRegistry, loadPracticeFlow } from './practice-phase-registry.ts'
import type { FlowStartResult, PracticeFlowConfig } from './registry-types.ts'

/**
 * 内部：找 flow 里第一个词来源为 `taskReview` 的阶段块。
 * 用于「今天没有新词、只有复习词」时跳到合适的起点。
 * 找不到则返回第一块（保证总有结果）。
 */
function findFirstReviewPhase(config: PracticeFlowConfig) {
  const registry = getActiveRegistry()
  for (const block of config.phases) {
    if (resolveBlockWordsFrom(block) === 'taskReview') {
      const stage = resolveBlockStage(block)
      return registry.phasesByStage.get(stage) ?? registry.firstPhase
    }
  }
  return registry.firstPhase
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
 * 逻辑（不再按 mode 分流，完全由 flow.phases 配置驱动）：
 * 1. flow 第一个 phase 词来源有新词 → 从 firstPhase 开始，用新词
 * 2. flow 第一个 phase 词来源有词但实际为空（如只有复习词）→ 找第一个 taskReview phase
 * 3. 任意词来源都为空 → 抛 NO_WORDS
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

  const total = taskWords.new.length + taskWords.review.length
  if (total === 0) throw new Error('NO_WORDS')

  // 尝试用第一个阶段块的词来源取词
  const firstBlock = config.phases[0]
  const firstWordsFrom = resolveBlockWordsFrom(firstBlock)
  const firstWords = resolveWordsForSource(firstWordsFrom, taskWords)

  // 第一阶段有词 → 正常从 firstPhase 开始
  if (firstWords.length > 0) {
    return {
      stage: registry.firstPhase.key.stage,
      practiceType: registry.firstPhase.key.practiceType,
      words: firstWords,
      total,
      newWordNumber: taskWords.new.length,
      reviewWordNumber: taskWords.review.length,
    }
  }

  // 第一阶段无词（如 System 模式今天只有复习词，跳过新词阶段）→ 找第一个有词的 taskReview 阶段
  const reviewPhase = findFirstReviewPhase(config)
  const reviewWords = taskWords.review
  if (!reviewWords.length) throw new Error('NO_WORDS')

  return {
    stage: reviewPhase.key.stage,
    practiceType: reviewPhase.key.practiceType,
    words: reviewWords,
    total,
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
