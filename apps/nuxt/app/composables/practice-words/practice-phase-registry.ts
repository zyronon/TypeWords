/**
 * 练习流程「运行时注册表」入口。
 *
 * 职责：把已编译的 ActiveFlowRegistry 挂在模块级变量上，供 Navigator 查询。
 *
 * Phase 2.6 升级：
 * - resolvePhaseByCtxCursor 优先级重构：inWrongWordClear(含loop) → loop → phasesByCursor → firstPhase
 * - advanceCursor 纯 cursor 状态推进（onEnd 入口由 Navigator.processNextEndAction 负责，不重复处理）
 * - 移除对 spellInGroup / wrongRetry / spellSubStep / advanceEndActions 的引用
 */
import { getFlowConfig } from './builtin-flows.ts'
import { STEP_TEMPLATE_META, GROUP_SIZE } from './phase-templates.ts'
import { buildRegistryFromConfig, validateFlowConfig } from './flow-schema.ts'
import { loadCustomFlow } from './usePracticeFlowStorage.ts'
import type {
  ActiveFlowRegistry,
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticePhaseDefinition,
  PracticeWrongWordClearAction,
  WordAdvanceRule,
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
      ? validateFlowConfig(
          flowIdOrConfig === 'custom' ? loadCustomFlow() : getFlowConfig(flowIdOrConfig)
        )
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
 * 从 wrongWordClear action 配置动态派生错词清空相位定义。
 */
function deriveWrongWordClearPhase(
  action: PracticeWrongWordClearAction,
  fallbackPhase: PracticePhaseDefinition
): PracticePhaseDefinition {
  const templateId = action.templateId
  const template = STEP_TEMPLATE_META[templateId]

  const wordAdvanceCfg = action.wordAdvance
  const wordAdvance: WordAdvanceRule =
    wordAdvanceCfg?.type === 'wordLoop'
      ? {
          type: 'wordLoop',
          groupSize: wordAdvanceCfg.groupSize ?? GROUP_SIZE,
          subSteps: wordAdvanceCfg.subSteps ?? [],
        }
      : { type: 'increment' }

  const display = action.displayOverride
    ? { ...template.display, ...action.displayOverride }
    : template.display

  return {
    practiceType: template.practiceType,
    display,
    wordAdvance,
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
  const template = STEP_TEMPLATE_META[subStep.templateId]

  const display = subStep.displayOverride
    ? { ...template.display, ...subStep.displayOverride }
    : template.display

  return {
    practiceType: template.practiceType,
    display,
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
    const endActionIdx = cursor.endActionIndex ?? 0
    const action = mainPhase.onEnd[endActionIdx]
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
 * cursor 推进：下一个 subStep / loop结束回主步骤 / onEnd action 索引 / step / node / complete。
 *
 * 注意：onEnd 队列的实际执行（wrongWordClear 挂起、即时型动作执行）由 Navigator.processNextEndAction 负责，
 * 此处仅做 cursor 状态推进，不重复处理 onEnd 动作内容。
 *
 * 调用者（Navigator.runStepAdvance）根据 complete 决定是否触发结算。
 */
export function advanceCursor(
  cursor: PracticeFlowCursor
): { cursor: PracticeFlowCursor; complete: boolean } {
  const registry = getActiveRegistry()
  const { nodeIndex, stepIndex } = cursor
  const mainPhase =
    registry.phasesByCursor.get(cursorKey(nodeIndex, stepIndex)) ?? registry.firstPhase

  // ── 情形 1：错词清空完毕 → 推进 onEnd action 索引 ──
  if (cursor.inWrongWordClear) {
    const nextEndIdx = (cursor.endActionIndex ?? 0) + 1
    if (nextEndIdx >= mainPhase.onEnd.length) {
      // onEnd 队列耗尽 → 进入 stepAdvance
      return advanceToNextStep(cursor, mainPhase)
    }
    return {
      cursor: { ...cursor, inWrongWordClear: false, endActionIndex: nextEndIdx },
      complete: false,
    }
  }

  // ── 情形 2：loop 子步骤推进 → 下一个 subStep 或退出 loop ──
  if (cursor.loop !== null) {
    const { startIndex, endIndex, subStepIndex } = cursor.loop
    const subSteps = mainPhase.wordAdvance.subSteps ?? []
    const isLastSubStep = subStepIndex >= subSteps.length - 1

    if (!isLastSubStep) {
      return {
        cursor: {
          ...cursor,
          loop: { startIndex, endIndex, subStepIndex: subStepIndex + 1 },
        },
        complete: false,
      }
    }
    return {
      cursor: { ...cursor, loop: null },
      complete: false,
    }
  }

  // ── 情形 3：普通状态 → step/node 推进（onEnd 入口由 Navigator 处理，不在此处重复） ──
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
