/**
 * 练习流程「运行时注册表」入口。
 *
 * 职责：把已编译的 ActiveFlowRegistry 挂在模块级变量上，供 Navigator 查询。
 *
 * Phase 2.6 升级：
 * - resolvePhaseByCtxCursor 优先级重构：inWrongWordClear → loop → phasesByCursor → firstPhase
 * - advanceCursor 支持 loop.subStepIndex++ 和 endActionIndex++ 推进
 * - 移除对 spellInGroup / wrongRetry / spellSubStep 的引用
 */
import { getFlowConfig } from './builtin-flows.ts'
import { STEP_TEMPLATE_META, GROUP_SIZE } from './phase-templates.ts'
import { buildRegistryFromConfig, validateFlowConfig } from './flow-schema.ts'
import type {
  ActiveFlowRegistry,
  PracticeEndAction,
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
    // 从 onEnd 中找到第一个 wrongWordClear action（endActionIndex 指向它）
    const endActionIdx = cursor.endActionIndex ?? 0
    const action = mainPhase.onEnd[endActionIdx]
    if (action?.type === 'wrongWordClear') {
      return deriveWrongWordClearPhase(action, mainPhase)
    }
    // 兜底：直接用主相位
    return mainPhase
  }

  if (cursor.loop !== null) {
    const subPhase = deriveLoopSubStepPhase(cursor, mainPhase)
    if (subPhase) return subPhase
  }

  return mainPhase
}

/**
 * cursor 推进：下一个 subStep / loop结束回主步骤 / onEnd action / step / node / complete。
 *
 * 调用者（Navigator）根据 complete 决定是否触发结算。
 * inWrongWordClear / loop 结束后不立刻进入 stepAdvance，而是继续 endActionIndex 队列。
 */
export function advanceCursor(
  cursor: PracticeFlowCursor
): { cursor: PracticeFlowCursor; complete: boolean } {
  const registry = getActiveRegistry()
  const { nodeIndex, stepIndex } = cursor
  const mainPhase =
    registry.phasesByCursor.get(cursorKey(nodeIndex, stepIndex)) ?? registry.firstPhase

  // ── 情形 1：处于 inWrongWordClear（错词清空结束） ──
  if (cursor.inWrongWordClear) {
    // 错词清空完毕，继续推进 endActionIndex 到下一个 action
    const nextEndIdx = (cursor.endActionIndex ?? 0) + 1
    return advanceEndActions(cursor, mainPhase, nextEndIdx)
  }

  // ── 情形 2：处于 loop 子步骤 ──
  if (cursor.loop !== null) {
    const { startIndex, endIndex, subStepIndex } = cursor.loop
    const subSteps = mainPhase.wordAdvance.subSteps ?? []
    const isLastSubStep = subStepIndex >= subSteps.length - 1

    if (!isLastSubStep) {
      // 还有更多子步骤
      return {
        cursor: {
          ...cursor,
          loop: { startIndex, endIndex, subStepIndex: subStepIndex + 1 },
        },
        complete: false,
      }
    }

    // 所有子步骤完成，退出 loop，回到主步骤继续下一组
    return {
      cursor: {
        ...cursor,
        loop: null,
      },
      complete: false,
    }
  }

  // ── 情形 3：普通主步骤，词表练完 → 进入 onEnd 队列 ──
  if (mainPhase.onEnd.length > 0) {
    return advanceEndActions(cursor, mainPhase, 0)
  }

  // onEnd 为空，直接进 stepAdvance
  return advanceToNextStep(cursor, mainPhase)
}

/**
 * 推进 onEnd action 队列。
 * 遇到 wrongWordClear → 进入 inWrongWordClear 状态（需外部处理交互）。
 * 遇到即时型 action（collectWrongWords / generateReport）→ Navigator 执行后继续调用 advanceCursor。
 * 遇到 navigate / 队列结束 → 进入 stepAdvance。
 */
function advanceEndActions(
  cursor: PracticeFlowCursor,
  mainPhase: PracticePhaseDefinition,
  actionIndex: number
): { cursor: PracticeFlowCursor; complete: boolean } {
  const onEnd = mainPhase.onEnd

  // 队列耗尽，进入 stepAdvance
  if (actionIndex >= onEnd.length) {
    return advanceToNextStep(cursor, mainPhase)
  }

  const action = onEnd[actionIndex]

  if (action.type === 'wrongWordClear') {
    // 交互型：挂起队列，进入错词清空状态
    return {
      cursor: {
        ...cursor,
        inWrongWordClear: true,
        endActionIndex: actionIndex,
        loop: null,
      },
      complete: false,
    }
  }

  if (action.type === 'navigate') {
    if (action.target === 'complete') {
      return { cursor, complete: true }
    }
    // nextStep 或其他：进入 stepAdvance
    return advanceToNextStep(cursor, mainPhase)
  }

  // collectWrongWords / generateReport：即时型，Navigator 执行后继续下一个
  return {
    cursor: { ...cursor, endActionIndex: actionIndex },
    complete: false,
  }
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
