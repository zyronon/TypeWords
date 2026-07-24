/**
 * 练习流程「运行时注册表」入口。
 *
 * 职责：把已编译的 ActiveFlowRegistry 挂在模块级变量上，供 Navigator 查询。
 *
 * Phase 2.6 升级：
 * - resolvePhaseByCtxCursor 优先级重构：inWrongWordClear(含loop) → loop → phasesByCursor → firstPhase
 * - advanceStepCursor 只负责静态 step/node 推进，loop/onEnd 由 Navigator 负责
 * - 移除对 spellInGroup / wrongRetry / spellSubStep / advanceEndActions 的引用
 */
import { getFlowConfig } from './builtin-flows.ts'
import { compileWordAdvance, materializeStepTemplate } from './phase-templates.ts'
import { buildRegistryFromConfig } from './flow-schema.ts'
import { getUserFlow, loadCustomFlow } from './usePracticeFlowStorage.ts'
import type {
  ActiveFlowRegistry,
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticePhaseDefinition,
  PracticeWrongWordClearAction,
} from './registry-types.ts'
import { cursorKey } from './registry-types.ts'

/** 当前练习页正在使用的、已编译流程 */
let activeRegistry: ActiveFlowRegistry | null = null

/**
 * 加载练习流程（内置 id 或用户 JSON 对象均可）。
 * 校验 → 编译。必须在 resolvePhaseByCtxCursor / resolveFlowStart / 恢复缓存之前调用。
 */
export function loadPracticeFlow(flowIdOrConfig: string | PracticeFlowConfig) {
  const rawConfig =
    typeof flowIdOrConfig === 'string'
      ? flowIdOrConfig === 'custom'
        ? loadCustomFlow()
        : (getUserFlow(flowIdOrConfig) ?? getFlowConfig(flowIdOrConfig))
      : flowIdOrConfig
  activeRegistry = buildRegistryFromConfig(rawConfig ?? getFlowConfig('system'))
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
 * 从 wrongWordClear action 配置动态派生错词清空相位定义。
 */
function deriveWrongWordClearPhase(
  action: PracticeWrongWordClearAction,
  fallbackPhase: PracticePhaseDefinition
): PracticePhaseDefinition {
  return {
    ...materializeStepTemplate(action.templateId, action.displayOverride),
    wordAdvance: compileWordAdvance(action.wordAdvance),
    stepAdvance: fallbackPhase.stepAdvance,
    onEnd: [],
  }
}

/**
 * 从 wordLoop subStep 配置动态派生子步骤相位定义。
 */
function deriveLoopSubStepPhase(
  cursor: PracticeFlowCursor,
  mainPhase: PracticePhaseDefinition
): PracticePhaseDefinition | null {
  if (!cursor.loop) return null
  const { subStepIndex } = cursor.loop
  const subSteps = mainPhase.wordAdvance.subSteps
  if (!subSteps || subStepIndex >= subSteps.length) return null

  const subStep = subSteps[subStepIndex]
  return {
    ...materializeStepTemplate(subStep.templateId, subStep.displayOverride),
    wordAdvance: mainPhase.wordAdvance,
    stepAdvance: mainPhase.stepAdvance,
    onEnd: [],
  }
}

/**
 * 根据 cursor 查阶段定义（唯一查询接口）。
 *
 * 优先级（Phase 2.6）：
 * 1. cursor.inWrongWordClear → 从当前 step 的 onEnd[wrongWordClearActionIndex] 派生错词清空相位
 * 2. cursor.loop !== null → 从当前 step 的 wordAdvance.subSteps[loop.subStepIndex] 派生子步骤相位
 * 3. phasesByCursor 查表
 * 4. 兜底 firstPhase
 */
export function resolvePhaseByCtxCursor(cursor: PracticeFlowCursor): PracticePhaseDefinition {
  const registry = getActiveRegistry()
  const mainPhase =
    registry.phasesByCursor.get(cursorKey(cursor.nodeIndex, cursor.stepIndex)) ?? registry.firstPhase
  if (cursor.inWrongWordClear) {
    // 从 onEnd 中找到 wrongWordClear action（endActionIndex 指向它）
    const action = mainPhase.onEnd[cursor.endActionIndex ?? 0]
    // 错词清空主相位：由 wrongWordClear action 配置派生
    const wcPhase = action?.type === 'wrongWordClear'
      ? deriveWrongWordClearPhase(action, mainPhase)
      : mainPhase

    // 错词清空期间也可能处于 wordLoop 子步骤（如 FollowWrite → Spell 循环）
    if (cursor.loop !== null) {
      const subPhase = deriveLoopSubStepPhase(cursor, wcPhase)
      if (subPhase) return subPhase
    }
    return wcPhase
  }

  if (cursor.loop !== null) {
    const subPhase = deriveLoopSubStepPhase(cursor, mainPhase)
    if (subPhase) return subPhase
  }

  return mainPhase
}

/**
 * 推进到下一个静态 step/node。loop 与 onEnd 状态由 Navigator 统一处理。
 */
export function advanceStepCursor(
  cursor: PracticeFlowCursor
): { cursor: PracticeFlowCursor; complete: boolean } {
  const registry = getActiveRegistry()
  const { nodeIndex, stepIndex } = cursor
  const mainPhase =
    registry.phasesByCursor.get(cursorKey(nodeIndex, stepIndex)) ?? registry.firstPhase

  return advanceToNextStep(cursor, mainPhase)
}

/** 按 stepAdvance 推进到下一 step / node，或结束 */
function advanceToNextStep(
  cursor: PracticeFlowCursor,
  mainPhase: PracticePhaseDefinition
): { cursor: PracticeFlowCursor; complete: boolean } {
  const nodes = getActiveRegistry().config.nodes
  const { nodeIndex, stepIndex } = cursor

  if (mainPhase.stepAdvance.complete) {
    return { cursor, complete: true }
  }

  const currentNode = nodes[nodeIndex]
  const isLastStep = stepIndex >= currentNode.steps.length - 1
  const isLastNode = nodeIndex >= nodes.length - 1

  const nextCursor: PracticeFlowCursor = {
    nodeIndex: isLastStep ? (isLastNode ? nodeIndex : nodeIndex + 1) : nodeIndex,
    stepIndex: isLastStep ? 0 : stepIndex + 1,
    inWrongWordClear: false,
    loop: null,
    endActionIndex: null,
  }

  if (isLastStep && isLastNode) {
    return { cursor: nextCursor, complete: true }
  }

  return { cursor: nextCursor, complete: false }
}

/**
 * 获取初始 cursor（注册表加载后调用）。
 */
export function getInitialCursor(): PracticeFlowCursor {
  return { ...getActiveRegistry().initialCursor }
}
