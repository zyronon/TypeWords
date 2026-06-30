/**
 * 练习流程「运行时注册表」入口。
 *
 * 职责：把已编译的 ActiveFlowRegistry 挂在模块级变量上，供 resolvePhase / Navigator 查询。
 * 调用方：页面 init、缓存恢复、Navigator 推进阶段时。
 */
import { WordPracticeMode, WordPracticeStage, WordPracticeType } from '@typewords/core/types/enum.ts'
import { getFlowConfig, getFlowIdForMode } from './builtin-flows.ts'
import { buildWrongWordReviewFromParent } from './phase-templates.ts'
import { buildRegistryFromConfig, validateFlowConfig } from './flow-schema.ts'
import type { ActiveFlowRegistry, PracticeFlowConfig, PracticePhaseDefinition, SessionContext } from './registry-types.ts'

/** 当前练习页正在使用的、已编译流程；刷新前由 loadPracticeFlow 写入 */
let activeRegistry: ActiveFlowRegistry | null = null

/**
 * 加载练习流程（内置 id 或用户 JSON 对象均可）。
 * 会校验 → 编译为 phasesByStage / stageSequence 等运行时结构。
 * 必须在 resolvePhase、resolveFlowStart、恢复缓存之前调用。
 */
export function loadPracticeFlow(flowIdOrConfig: string | PracticeFlowConfig) {
  const config =
    typeof flowIdOrConfig === 'string'
      ? validateFlowConfig(getFlowConfig(flowIdOrConfig))
      : validateFlowConfig(flowIdOrConfig)
  activeRegistry = buildRegistryFromConfig(config)
}

/** 当前 flow 的 id，写入 sessionSnapshot.flowId，刷新后用来重新 loadPracticeFlow */
export function getActiveFlowId(): string {
  return activeRegistry?.config.id ?? 'system'
}

/**
 * 取当前已编译注册表；若尚未 load 则默认加载 system。
 * 【薄封装】仅做 null 兜底，可考虑与 loadPracticeFlow 合并。
 */
export function getActiveRegistry(): ActiveFlowRegistry {
  if (!activeRegistry) {
    loadPracticeFlow('system')
  }
  return activeRegistry!
}

/** 当前 flow 的阶段顺序数组，用于「是否已开始练习」判断、Footer 进度（后续可接） */
export function getActiveStageSequence(): WordPracticeStage[] {
  return getActiveRegistry().stageSequence
}

/**
 * 查当前 flow 里某 stage 的下一阶段。
 * 【目前几乎未用】statStore.nextStage 仍走 core 的 WordPracticeModeStageMap；
 * Phase 2.5 自定义流程接 Footer 时才会真正用到。
 */
export function getNextStageInFlow(current: WordPracticeStage): WordPracticeStage | undefined {
  const seq = getActiveStageSequence()
  const idx = seq.indexOf(current)
  return idx >= 0 ? seq[idx + 1] : undefined
}

/**
 * 把 store 里的分散字段打包成 resolvePhase 的入参。
 * 【纯数据组装，无逻辑】存在只是为了 resolvePhase 签名稳定、少传 6 个参数。
 */
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

/**
 * 核心查询：根据「当前会话状态」返回本时刻应生效的阶段定义（显隐 + 词内/阶段推进规则）。
 *
 * 优先级：
 * 1. 错词复习中 → 由当前 stage 的主相位派生（buildWrongWordReviewFromParent）
 * 2. 跟写组内的 Spell 子相位 → spellInGroup
 *    （判断依据：当前 stage 对应的主相位是 wordLoop 类型，且 practiceType 是 Spell）
 * 3. 按 statStore.stage 查 phasesByStage
 * 4. 兜底 firstPhase
 *
 * Navigator 的 next() 和 syncPhase() 都依赖此函数，不是摆设。
 */
export function resolvePhase(ctx: SessionContext): PracticePhaseDefinition {
  const registry = getActiveRegistry()

  if (ctx.practiceData.isTypingWrongWord) {
    const parent = registry.phasesByStage.get(ctx.stage) ?? registry.firstPhase
    return buildWrongWordReviewFromParent(parent)
  }

  // 不硬编码 stage 名：只要当前 stage 对应的主相位是 wordLoop 类型，
  // 且 practiceType 切换到了 Spell，就进入 spellInGroup 子相位。
  if (registry.spellInGroup && ctx.practiceType === WordPracticeType.Spell) {
    const currentPhase = registry.phasesByStage.get(ctx.stage)
    if (currentPhase?.wordAdvance.type === 'wordLoop') {
      return registry.spellInGroup
    }
  }

  const phase = registry.phasesByStage.get(ctx.stage)
  if (phase) return phase

  return registry.firstPhase
}

/**
 * 无 flowId 的旧缓存恢复：先按 mode 猜内置 flow，再 resolvePhase。
 * 【仅 restoreSessionFromLegacy 用一次】
 */
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
