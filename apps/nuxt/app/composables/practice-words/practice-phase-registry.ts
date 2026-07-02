/**
 * 练习流程「运行时注册表」入口。
 *
 * 职责：把已编译的 ActiveFlowRegistry 挂在模块级变量上，供 Navigator 查询。
 * 完全 cursor-native：无 resolvePhase(ctx)、无 stage、无 stageSequence。
 */
import { getFlowConfig, getFlowIdForMode } from './builtin-flows.ts'
import { buildWrongWordReviewFromParent } from './phase-templates.ts'
import { buildRegistryFromConfig, validateFlowConfig } from './flow-schema.ts'
import type {
  ActiveFlowRegistry,
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticePhaseDefinition,
} from './registry-types.ts'
import { cursorKey } from './registry-types.ts'

/** 当前练习页正在使用的、已编译流程 */
let activeRegistry: ActiveFlowRegistry | null = null

/**
 * 加载练习流程（内置 id 或用户 JSON 对象均可）。
 * 校验 → 编译。必须在 resolvePhaseByCtxCursor / resolveFlowStart / 恢复缓存之前调用。
 */
export function loadPracticeFlow(flowIdOrConfig: string | PracticeFlowConfig) {
  const config =
    typeof flowIdOrConfig === 'string'
      ? validateFlowConfig(getFlowConfig(flowIdOrConfig))
      : validateFlowConfig(flowIdOrConfig)
  activeRegistry = buildRegistryFromConfig(config)
}

/** 当前 flow 的 id，存入 sessionSnapshot.flowId */
export function getActiveFlowId(): string {
  return activeRegistry?.config.id ?? 'system'
}

/** 取当前已编译注册表；若尚未 load 则默认加载 system */
export function getActiveRegistry(): ActiveFlowRegistry {
  if (!activeRegistry) loadPracticeFlow('system')
  return activeRegistry!
}

/**
 * 根据 cursor 查阶段定义（唯一查询接口）。
 *
 * 优先级：
 * 1. wrongRetry → 派生自对应主相位的错词复习相位
 * 2. spellSubStep → spellInGroup 子相位
 * 3. phasesByCursor 查表
 * 4. 兜底 firstPhase
 */
export function resolvePhaseByCtxCursor(cursor: PracticeFlowCursor): PracticePhaseDefinition {
  const registry = getActiveRegistry()

  if (cursor.wrongRetry) {
    const parent =
      registry.phasesByCursor.get(cursorKey(cursor.nodeIndex, cursor.stepIndex)) ??
      registry.firstPhase
    return buildWrongWordReviewFromParent(parent)
  }

  if (cursor.spellSubStep && registry.spellInGroup) {
    return registry.spellInGroup
  }

  return registry.phasesByCursor.get(cursorKey(cursor.nodeIndex, cursor.stepIndex)) ?? registry.firstPhase
}

/**
 * cursor 推进：下一个 step / node / complete。
 * - wrongRetry / spellSubStep 结束 → 回当前 (nodeIndex, stepIndex) 主相位
 * - 否则按 nodes 数组线性前进
 */
export function advanceCursor(
  cursor: PracticeFlowCursor
): { cursor: PracticeFlowCursor; complete: boolean } {
  const { nodeIndex, stepIndex } = cursor

  if (cursor.wrongRetry || cursor.spellSubStep) {
    return {
      cursor: { nodeIndex, stepIndex, spellSubStep: false, wrongRetry: false },
      complete: false,
    }
  }

  const nodes = getActiveRegistry().config.nodes
  const currentNode = nodes[nodeIndex]
  const isLastStep = stepIndex >= currentNode.steps.length - 1
  const isLastNode = nodeIndex >= nodes.length - 1

  if (!isLastStep) {
    return { cursor: { nodeIndex, stepIndex: stepIndex + 1, spellSubStep: false, wrongRetry: false }, complete: false }
  }
  if (!isLastNode) {
    return { cursor: { nodeIndex: nodeIndex + 1, stepIndex: 0, spellSubStep: false, wrongRetry: false }, complete: false }
  }
  return { cursor, complete: true }
}
