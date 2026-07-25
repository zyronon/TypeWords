/**
 * 当前练习流程的运行时入口。
 *
 * Flow 配置本身已经足以描述静态 Step。这里不再预编译 phasesByCursor，
 * 而是根据 config + cursor 即时解析当前 Phase，避免维护第二套流程拓扑。
 */
import type { TaskWords, Word } from '@typewords/core/types/types.ts'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import {
  BUILTIN_FLOWS,
  getFlowConfig,
  getFlowIdForMode,
  materializeStepTemplate,
  materializeWordAdvance,
} from './practice-flow-config.ts'
import { getUserFlow, loadCustomFlow } from './practice-flow-storage.ts'
import type {
  FlowStartResult,
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticeFlowStep,
  PracticePhaseDefinition,
  PracticeStepTemplateId,
  PracticeWordsSource,
  PracticeWrongWordClearAction,
} from './practice-flow-types.ts'

const VALID_SOURCES = new Set(['taskNew', 'taskReview', 'current', 'wrongWords'])
const VALID_TEMPLATE_IDS: PracticeStepTemplateId[] = ['followWrite', 'spell', 'listen', 'dictation', 'identify']
const VALID_TEMPLATE_IDS_SET = new Set<string>(VALID_TEMPLATE_IDS)
const VALID_END_ACTION_TYPES = new Set(['wrongWordClear', 'collectWrongWords', 'generateReport', 'navigate'])

/** 非法配置统一回退 System，避免坏 JSON 进入练习页。 */
export function validateFlowConfig(config: PracticeFlowConfig | null | undefined): PracticeFlowConfig {
  if (!config?.id || !Array.isArray(config.nodes) || config.nodes.length === 0) return BUILTIN_FLOWS.system

  for (const node of config.nodes) {
    if (!node?.id || !VALID_SOURCES.has(node.source) || !Array.isArray(node.steps) || node.steps.length === 0) {
      return BUILTIN_FLOWS.system
    }
    for (const step of node.steps) {
      if (!VALID_TEMPLATE_IDS_SET.has(step?.templateId)) return BUILTIN_FLOWS.system
      if (step.wordAdvance?.type === 'wordLoop') {
        if (!Array.isArray(step.wordAdvance.subSteps)) return BUILTIN_FLOWS.system
        if (step.wordAdvance.subSteps.some(sub => !VALID_TEMPLATE_IDS_SET.has(sub?.templateId))) {
          return BUILTIN_FLOWS.system
        }
      }
      if (step.onEnd !== undefined) {
        if (!Array.isArray(step.onEnd)) return BUILTIN_FLOWS.system
        for (const action of step.onEnd) {
          if (!VALID_END_ACTION_TYPES.has(action?.type)) return BUILTIN_FLOWS.system
          if (action.type === 'wrongWordClear' && !VALID_TEMPLATE_IDS_SET.has(action.templateId)) {
            return BUILTIN_FLOWS.system
          }
        }
      }
    }
  }
  return config
}

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
    onEnd: step?.onEnd ?? [],
  }
}

export function getMainPhase(cursor: PracticeFlowCursor): PracticePhaseDefinition {
  return materializeStep(getStep(cursor))
}

/** 根据 Cursor 即时解析主 Step、错词清空或 wordLoop 子步骤。 */
export function resolvePhaseByCtxCursor(cursor: PracticeFlowCursor): PracticePhaseDefinition {
  const mainPhase = materializeStep(getStep(cursor))
  let phase = mainPhase

  if (cursor.inWrongWordClear) {
    const action = mainPhase.onEnd[cursor.endActionIndex ?? 0]
    if (action?.type === 'wrongWordClear') phase = materializeStep(action)
  }

  if (cursor.loop !== null) {
    const subStep = phase.wordAdvance.subSteps?.[cursor.loop.subStepIndex]
    if (subStep) {
      return {
        ...materializeStep(subStep),
        // loop 子步骤只覆盖练习类型和显隐；推进规则必须继续沿用父 Phase 的 wordLoop。
        wordAdvance: phase.wordAdvance,
      }
    }
  }

  return phase
}

/** 只推进静态 node/step；动态错词和 wordLoop 状态由 Navigator 处理。 */
export function advanceStepCursor(cursor: PracticeFlowCursor): { cursor: PracticeFlowCursor; complete: boolean } {
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

export function getInitialCursor(val: Partial<PracticeFlowCursor> = {}): PracticeFlowCursor {
  return {
    nodeIndex: 0,
    stepIndex: 0,
    inWrongWordClear: false,
    loop: null,
    endActionIndex: null,
    ...val,
  }
}

function resolveInitialWords(source: PracticeWordsSource, taskWords: TaskWords): Word[] {
  switch (source) {
    case 'taskNew':
      return taskWords.new
    case 'taskReview':
      return taskWords.review
    case 'current':
      return [...taskWords.new, ...taskWords.review]
    case 'wrongWords':
      return []
  }
}

/** 加载流程并找到首个有词 Node，作为新会话真实起点。 */
export function resolveFlowStart(mode: WordPracticeMode, taskWords: TaskWords, flowId?: string): FlowStartResult {
  const total = taskWords.new.length + taskWords.review.length
  if (total === 0) throw new Error('NO_WORDS')

  loadPracticeFlow(flowId ?? getFlowIdForMode(mode))
  const config = getActiveFlowConfig()
  const nodeIndex = config.nodes.findIndex(node => resolveInitialWords(node.source, taskWords).length > 0)
  if (nodeIndex < 0) throw new Error('NO_WORDS')

  return {
    words: resolveInitialWords(config.nodes[nodeIndex].source, taskWords),
    total,
    newWordNumber: taskWords.new.length,
    reviewWordNumber: taskWords.review.length,
    cursor: getInitialCursor({ nodeIndex }),
  }
}
