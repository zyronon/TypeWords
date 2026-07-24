/**
 * 当前练习流程的运行时入口。
 *
 * Flow 配置本身已经足以描述静态 Step。这里不再预编译 phasesByCursor，
 * 而是根据 config + cursor 即时解析当前 Phase，避免维护第二套流程拓扑。
 */
import { getFlowConfig } from './builtin-flows.ts'
import { materializeStepTemplate, materializeWordAdvance } from './phase-templates.ts'
import { validateFlowConfig } from './flow-schema.ts'
import { getUserFlow, loadCustomFlow } from './usePracticeFlowStorage.ts'
import type {
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticeFlowStep,
  PracticePhaseDefinition,
  PracticeWrongWordClearAction,
} from './registry-types.ts'

let activeFlowConfig: PracticeFlowConfig | null = null

/** 加载并校验内置或用户流程。 */
export function loadPracticeFlow(flowIdOrConfig: string | PracticeFlowConfig) {
  const rawConfig =
    typeof flowIdOrConfig === 'string'
      ? flowIdOrConfig === 'custom'
        ? loadCustomFlow()
        : (getUserFlow(flowIdOrConfig) ?? getFlowConfig(flowIdOrConfig))
      : flowIdOrConfig
  activeFlowConfig = validateFlowConfig(rawConfig ?? getFlowConfig('system'))
}

export function getActiveFlowId(): string {
  return getActiveFlowConfig().id
}

export function getActiveFlowConfig(): PracticeFlowConfig {
  if (!activeFlowConfig) loadPracticeFlow('system')
  return activeFlowConfig!
}

function getStep(cursor: PracticeFlowCursor): PracticeFlowStep {
  const config = getActiveFlowConfig()
  return config.nodes[cursor.nodeIndex]?.steps[cursor.stepIndex] ?? config.nodes[0].steps[0]
}

function materializeStep(step: PracticeFlowStep): PracticePhaseDefinition {
  return {
    ...materializeStepTemplate(step.templateId, step.displayOverride),
    wordAdvance: materializeWordAdvance(step.wordAdvance),
    onEnd: step.onEnd ?? [],
  }
}

function materializeWrongWordClear(action: PracticeWrongWordClearAction): PracticePhaseDefinition {
  return {
    ...materializeStepTemplate(action.templateId, action.displayOverride),
    wordAdvance: materializeWordAdvance(action.wordAdvance),
    onEnd: [],
  }
}

/** 根据 Cursor 即时解析主 Step、错词清空或 wordLoop 子步骤。 */
export function resolvePhaseByCtxCursor(cursor: PracticeFlowCursor): PracticePhaseDefinition {
  const mainPhase = materializeStep(getStep(cursor))
  let phase = mainPhase

  if (cursor.inWrongWordClear) {
    const action = mainPhase.onEnd[cursor.endActionIndex ?? 0]
    if (action?.type === 'wrongWordClear') phase = materializeWrongWordClear(action)
  }

  if (cursor.loop !== null) {
    const subStep = phase.wordAdvance.subSteps?.[cursor.loop.subStepIndex]
    if (subStep) {
      return {
        ...materializeStepTemplate(subStep.templateId, subStep.displayOverride),
        wordAdvance: phase.wordAdvance,
        onEnd: [],
      }
    }
  }

  return phase
}

/** 只推进静态 node/step；动态错词和 wordLoop 状态由 Navigator 处理。 */
export function advanceStepCursor(
  cursor: PracticeFlowCursor
): { cursor: PracticeFlowCursor; complete: boolean } {
  const nodes = getActiveFlowConfig().nodes
  const currentNode = nodes[cursor.nodeIndex]
  const isLastStep = cursor.stepIndex >= currentNode.steps.length - 1
  const isLastNode = cursor.nodeIndex >= nodes.length - 1

  if (isLastStep && isLastNode) return { cursor, complete: true }

  return {
    cursor: {
      nodeIndex: isLastStep ? cursor.nodeIndex + 1 : cursor.nodeIndex,
      stepIndex: isLastStep ? 0 : cursor.stepIndex + 1,
      inWrongWordClear: false,
      loop: null,
      endActionIndex: null,
    },
    complete: false,
  }
}

export function getInitialCursor(): PracticeFlowCursor {
  return {
    nodeIndex: 0,
    stepIndex: 0,
    inWrongWordClear: false,
    loop: null,
    endActionIndex: null,
  }
}
