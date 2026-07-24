/**
 * 练习页「冷启动」：根据 flow 决定初始 cursor、词表、统计字段。
 *
 * 完全 cursor-native：
 * - 所有逻辑均从 flow.nodes 配置推导
 * - 返回 cursor 作为起始定位
 * - 词表来源由 node.source 决定
 */
import type { TaskWords, Word } from '@typewords/core/types/types.ts'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import { getFlowIdForMode } from './builtin-flows.ts'
import { getActiveRegistry, loadPracticeFlow } from './practice-phase-registry.ts'
import type { FlowStartResult, PracticeFlowConfig, PracticeFlowCursor, PracticeWordsSource } from './registry-types.ts'

/** 把 PracticeWordsSource 枚举映射到 taskWords 里的具体数组 */
function resolveWordsForSource(source: PracticeWordsSource, taskWords: TaskWords): Word[] {
  switch (source) {
    case 'taskNew':
      return taskWords.new
    case 'taskReview':
      return taskWords.review
    case 'current':
      return [...taskWords.new, ...taskWords.review]
    case 'wrongWords':
      return [] // 练习开始时无错词
  }
}

/**
 * 找到 flow.nodes 中第一个有实际词表的 node，返回其 cursor + 词表。
 */
function findFirstNodeWithWords(
  config: PracticeFlowConfig,
  taskWords: TaskWords
): { nodeIndex: number; words: Word[] } | null {
  for (let ni = 0; ni < config.nodes.length; ni++) {
    const node = config.nodes[ni]
    const words = resolveWordsForSource(node.source, taskWords)
    if (words.length > 0) {
      return { nodeIndex: ni, words }
    }
  }
  return null
}

/**
 * 练习开始前调用：加载 flow 并算出初始 cursor / words / 计数。
 *
 * 逻辑（完全由 flow.nodes 配置驱动）：
 * 1. 第一个 node 词表有词 → 从 cursor {0,0} 开始
 * 2. 第一个 node 为空（如 System 只有复习词）→ 找第一个有词的 node
 * 3. 所有 node 均为空 → 抛 NO_WORDS
 *
 * @throws 'NO_WORDS' 无词可练时，页面应 toast 并跳回词书列表
 */
export function resolveFlowStart(mode: WordPracticeMode, taskWords: TaskWords, flowId?: string): FlowStartResult {
  const total = taskWords.new.length + taskWords.review.length
  if (total === 0) throw new Error('NO_WORDS')

  loadPracticeFlow(flowId ?? getFlowIdForMode(mode))
  const registry = getActiveRegistry()
  const config = registry.config
  const firstNode = config.nodes[0]
  const firstWords = resolveWordsForSource(firstNode.source, taskWords)

  let startNodeIndex = 0
  let startWords = firstWords

  if (firstWords.length === 0) {
    const found = findFirstNodeWithWords(config, taskWords)
    if (!found || found.words.length === 0) throw new Error('NO_WORDS')
    startNodeIndex = found.nodeIndex
    startWords = found.words
  }

  const startCursor: PracticeFlowCursor = {
    nodeIndex: startNodeIndex,
    stepIndex: 0,
    inWrongWordClear: false,
    loop: null,
    endActionIndex: null,
  }

  return {
    words: startWords,
    total,
    newWordNumber: taskWords.new.length,
    reviewWordNumber: taskWords.review.length,
    cursor: startCursor,
  }
}
