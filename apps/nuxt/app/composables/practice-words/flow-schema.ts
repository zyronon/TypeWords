/**
 * 流程配置校验。
 * 非法配置一律回退 system，避免带着坏 JSON 进练习页。
 *
 * Phase 2.6 升级：
 * - VALID_TEMPLATE_IDS 新增 'spell'
 * - 校验逻辑适配 subSteps[] 和 onEnd[]
 */
import { BUILTIN_FLOWS } from './builtin-flows.ts'
import type { PracticeFlowConfig, PracticeStepTemplateId } from './registry-types.ts'

const VALID_SOURCES = new Set(['taskNew', 'taskReview', 'current', 'wrongWords'])
const VALID_TEMPLATE_IDS: PracticeStepTemplateId[] = ['followWrite', 'spell', 'listen', 'dictation', 'identify']
const VALID_TEMPLATE_IDS_SET = new Set<string>(VALID_TEMPLATE_IDS)
const VALID_END_ACTION_TYPES = new Set(['wrongWordClear', 'collectWrongWords', 'generateReport', 'navigate'])

/**
 * 校验流程配置是否可执行；失败则返回 system 默认。
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
      // 校验 wordAdvance.subSteps（若存在）
      if (step.wordAdvance?.type === 'wordLoop' && 'subSteps' in step.wordAdvance) {
        const subSteps = (step.wordAdvance as any).subSteps
        if (!Array.isArray(subSteps)) return BUILTIN_FLOWS.system
        for (const sub of subSteps) {
          if (!sub?.templateId || !VALID_TEMPLATE_IDS_SET.has(sub.templateId)) {
            return BUILTIN_FLOWS.system
          }
        }
      }
      // 校验 onEnd（若存在）
      if (step.onEnd !== undefined) {
        if (!Array.isArray(step.onEnd)) return BUILTIN_FLOWS.system
        for (const action of step.onEnd) {
          if (!action?.type || !VALID_END_ACTION_TYPES.has(action.type)) {
            return BUILTIN_FLOWS.system
          }
          // wrongWordClear action 的 templateId 必须合法
          if (action.type === 'wrongWordClear') {
            if (!VALID_TEMPLATE_IDS_SET.has((action as any).templateId ?? '')) {
              return BUILTIN_FLOWS.system
            }
          }
        }
      }
    }
  }

  return config
}
