/**
 * 流程配置的校验与解析。
 * 非法配置一律回退 system，避免带着坏 JSON 进练习页。
 *
 * Phase 2 Architecture Upgrade：校验逻辑改为适配 nodes[] 结构。
 */
import { compileFlowConfig } from './flow-compiler.ts'
import { BUILTIN_FLOWS } from './builtin-flows.ts'
import type { ActiveFlowRegistry, PracticeFlowConfig, PracticeStepTemplateId } from './registry-types.ts'

const VALID_SOURCES = new Set(['taskNew', 'taskReview', 'current', 'wrongWords'])
const VALID_TEMPLATE_IDS: PracticeStepTemplateId[] = ['followWrite', 'listen', 'dictation', 'identify']
const VALID_TEMPLATE_IDS_SET = new Set<string>(VALID_TEMPLATE_IDS)

/**
 * 校验流程配置是否可编译；失败则返回 system 默认。
 * loadPracticeFlow、Phase 3 保存用户流程前都应走这里。
 */
export function validateFlowConfig(
  config: PracticeFlowConfig | null | undefined
): PracticeFlowConfig {
  // 基础结构校验
  if (!config?.id || !Array.isArray(config.nodes) || config.nodes.length === 0) {
    return BUILTIN_FLOWS.system
  }

  // 逐 node 校验
  for (const node of config.nodes) {
    if (!node?.id || !node.source || !VALID_SOURCES.has(node.source)) {
      return BUILTIN_FLOWS.system
    }
    if (!Array.isArray(node.steps) || node.steps.length === 0) {
      return BUILTIN_FLOWS.system
    }
    for (const step of node.steps) {
      if (!step?.templateId || !VALID_TEMPLATE_IDS_SET.has(step.templateId)) {
        return BUILTIN_FLOWS.system
      }
    }
  }

  // 尝试编译（编译失败即为非法配置）
  try {
    compileFlowConfig(config)
  } catch {
    return BUILTIN_FLOWS.system
  }

  return config
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
 * 【Phase 3 usePracticeFlowStorage 会用】
 */
export function parseFlowConfigJson(json: string): PracticeFlowConfig {
  try {
    return validateFlowConfig(JSON.parse(json) as PracticeFlowConfig)
  } catch {
    return BUILTIN_FLOWS.system
  }
}
