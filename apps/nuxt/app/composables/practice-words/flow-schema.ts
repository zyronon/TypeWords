/**
 * 流程配置的校验与解析。
 * 非法配置一律回退 system，避免带着坏 JSON 进练习页。
 */
import { WordPracticeStage } from '@typewords/core/types/enum.ts'
import { compileFlowConfig } from './flow-compiler.ts'
import { BUILTIN_FLOWS } from './builtin-flows.ts'
import type { ActiveFlowRegistry, PracticeFlowConfig } from './registry-types.ts'

const VALID_WORDS_FROM = new Set(['taskNew', 'taskReview', 'wrongWords', 'current'])

/**
 * 校验流程配置是否可编译；失败则返回 system 默认。
 * loadPracticeFlow、Phase 2.5 保存用户流程前都应走这里。
 */
export function validateFlowConfig(
  config: PracticeFlowConfig | null | undefined
): PracticeFlowConfig {
  if (!config?.id || !Array.isArray(config.phases) || config.phases.length === 0) {
    return BUILTIN_FLOWS.system
  }

  for (const block of config.phases) {
    if (!block?.templateId) return BUILTIN_FLOWS.system
    if (block.wordsFrom && !VALID_WORDS_FROM.has(block.wordsFrom)) return BUILTIN_FLOWS.system
    if (block.advanceWordsFrom && !VALID_WORDS_FROM.has(block.advanceWordsFrom)) {
      return BUILTIN_FLOWS.system
    }
  }

  try {
    compileFlowConfig(config)
  } catch {
    return BUILTIN_FLOWS.system
  }

  return config
}

/**
 * 判断阶段序列是否以 Complete 结尾。
 * 【Phase 2.5 编排页保存时用】当前 v2 练习页运行时未调用。
 */
export function isValidStageSequence(stages: WordPracticeStage[]): boolean {
  if (!stages.length) return false
  return stages[stages.length - 1] === WordPracticeStage.Complete || stages.includes(WordPracticeStage.Complete)
}

/**
 * 校验 + 编译一条龙。
 * 【薄封装】= validateFlowConfig + compileFlowConfig，保留是为了 loadPracticeFlow 语义清晰。
 */
export function buildRegistryFromConfig(config: PracticeFlowConfig): ActiveFlowRegistry {
  return compileFlowConfig(validateFlowConfig(config))
}

/**
 * 从 localStorage / 编辑器读出的 JSON 字符串解析为安全可用的流程配置。
 * 【Phase 2.5 usePracticeFlowStorage 会用】
 */
export function parseFlowConfigJson(json: string): PracticeFlowConfig {
  try {
    return validateFlowConfig(JSON.parse(json) as PracticeFlowConfig)
  } catch {
    return BUILTIN_FLOWS.system
  }
}
