/** Flow 配置的严格校验、存储，以及每个练习实例独享的运行时。 */
import { shallowRef } from 'vue'
import type { TaskWords, Word } from '@/core/types/types.ts'
import { WordPracticeMode } from '@/core/types/enum.ts'
import { shuffle } from '@/core/utils'
import {
  BUILTIN_FLOWS,
  CURRENT_FLOW_VERSION,
  getFlowConfig,
  getFlowIdForMode,
  materializeWordAdvance,
  STEP_TEMPLATE_META,
} from './practice-flow-config.ts'
import type {
  FlowStartResult,
  PracticeEndAction,
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticeFlowStep,
  PracticeLoopSubStep,
  PracticePhaseDefinition,
  PracticeWordAdvanceConfig,
  PracticeWordsSource,
} from './practice-flow-types.ts'

const VALID_SOURCES = new Set<PracticeWordsSource>(['taskNew', 'taskReview', 'current', 'wrongWords'])
const VALID_TEMPLATE_IDS_SET = new Set<string>(Object.keys(STEP_TEMPLATE_META))
const VALID_MODES = new Set(
  Object.values(WordPracticeMode).filter((value): value is WordPracticeMode => typeof value === 'number')
)
const FLOW_STORAGE_KEY = 'PracticeFlowV2'

interface UserFlowEntry {
  config: PracticeFlowConfig
  name: string
  createdAt: number
  updatedAt: number
}

interface PracticeFlowStorageData {
  activeId: string
  flows: Record<string, UserFlowEntry>
}

function cloneConfig(config: PracticeFlowConfig): PracticeFlowConfig {
  return JSON.parse(JSON.stringify(config)) as PracticeFlowConfig
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getFlowStorage(): PracticeFlowStorageData {
  try {
    const raw = localStorage.getItem(FLOW_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && parsed.flows && typeof parsed.flows === 'object') {
        return {
          activeId: typeof parsed.activeId === 'string' ? parsed.activeId : '',
          flows: parsed.flows,
        }
      }
    }
  } catch {
    // localStorage 不可用或数据损坏时回退为空配置。
  }
  return { activeId: '', flows: {} }
}

function setFlowStorage(data: PracticeFlowStorageData) {
  localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(data))
}

function isValidSubStep(value: unknown): value is PracticeLoopSubStep {
  if (!isRecord(value)) return false
  return (
    Object.keys(value).every(key => key === 'templateId' || key === 'label') &&
    typeof value.templateId === 'string' &&
    VALID_TEMPLATE_IDS_SET.has(value.templateId) &&
    (value.label === undefined || typeof value.label === 'string')
  )
}

function isValidWordAdvance(value: unknown): value is PracticeWordAdvanceConfig | undefined {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  if (value.type === 'increment') return true
  if (value.type !== 'wordLoop') return false
  if (
    typeof value.groupSize !== 'number' ||
    !Number.isFinite(value.groupSize) ||
    !Number.isInteger(value.groupSize) ||
    value.groupSize < 1
  ) {
    return false
  }
  return Array.isArray(value.subSteps) && value.subSteps.every(isValidSubStep)
}

function isValidEndAction(value: unknown): value is PracticeEndAction {
  if (!isRecord(value)) return false
  if (value.type === 'wrongWordClear') {
    return (
      typeof value.templateId === 'string' &&
      VALID_TEMPLATE_IDS_SET.has(value.templateId) &&
      isValidWordAdvance(value.wordAdvance)
    )
  }
  if (value.type === 'collectWrongWords') {
    return typeof value.target === 'string' && ['favorite', 'wrongBook'].includes(value.target)
  }
  if (value.type === 'generateReport') {
    return typeof value.reportType === 'string' && ['stepSummary', 'sessionSummary'].includes(value.reportType)
  }
  if (value.type === 'navigate') return value.target === 'nextStep' || value.target === 'complete'
  return false
}

export function isValidFlowConfig(value: unknown): value is PracticeFlowConfig {
  if (!isRecord(value)) return false
  if (
    typeof value.id !== 'string' || !value.id ||
    typeof value.label !== 'string' || !value.label ||
    value.version !== CURRENT_FLOW_VERSION ||
    typeof value.mode !== 'number' || !VALID_MODES.has(value.mode) ||
    !Array.isArray(value.nodes) ||
    value.nodes.length === 0
  ) {
    return false
  }

  const nodeIds = new Set<string>()
  for (const node of value.nodes) {
    if (
      !isRecord(node) ||
      typeof node.id !== 'string' || !node.id ||
      typeof node.label !== 'string' || !node.label ||
      nodeIds.has(node.id) ||
      typeof node.source !== 'string' || !VALID_SOURCES.has(node.source as PracticeWordsSource) ||
      !Array.isArray(node.steps) ||
      node.steps.length === 0
    ) {
      return false
    }
    nodeIds.add(node.id)

    for (const step of node.steps) {
      if (
        !isRecord(step) ||
        typeof step.templateId !== 'string' || !VALID_TEMPLATE_IDS_SET.has(step.templateId) ||
        (step.label !== undefined && typeof step.label !== 'string') ||
        !isValidWordAdvance(step.wordAdvance) ||
        (step.shuffleOnEnter !== undefined && typeof step.shuffleOnEnter !== 'boolean') ||
        (step.onEnd !== undefined && (!Array.isArray(step.onEnd) || !step.onEnd.every(isValidEndAction)))
      ) {
        return false
      }
    }
  }
  return true
}

/** 非法配置统一回退 System；返回值总是当前版本的独立配置对象。 */
export function resolveFlowConfigOrSystem(value: unknown): PracticeFlowConfig {
  return isValidFlowConfig(value) ? cloneConfig(value) : cloneConfig(BUILTIN_FLOWS.system)
}

function isValidUserFlowEntry(value: unknown): value is UserFlowEntry {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) &&
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) &&
    isValidFlowConfig(value.config)
  )
}

function getStoredFlow(id: string, data: PracticeFlowStorageData): PracticeFlowConfig | null {
  const entry = data.flows[id]
  return isValidUserFlowEntry(entry) ? cloneConfig(entry.config) : null
}

export function listUserFlows(): { id: string; name: string; updatedAt: number }[] {
  const data = getFlowStorage()
  return Object.entries(data.flows)
    .filter(([, entry]) => isValidUserFlowEntry(entry))
    .map(([id, entry]) => ({ id, name: entry.name, updatedAt: entry.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getUserFlow(flowId: string): PracticeFlowConfig | null {
  const data = getFlowStorage()
  return getStoredFlow(flowId, data)
}

export function getActiveCustomFlowId(): string {
  return getFlowStorage().activeId
}

export function setActiveCustomFlowId(id: string) {
  const data = getFlowStorage()
  data.activeId = id
  setFlowStorage(data)
}

export function saveUserFlow(id: string, config: PracticeFlowConfig, name: string) {
  if (id !== config.id || !isValidFlowConfig(config)) throw new Error('INVALID_FLOW_CONFIG')
  const data = getFlowStorage()
  const now = Date.now()
  const existing = data.flows[id]
  data.flows[id] = {
    config: cloneConfig(config),
    name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  if (!data.activeId) data.activeId = id
  setFlowStorage(data)
}

export function deleteUserFlow(id: string) {
  const data = getFlowStorage()
  delete data.flows[id]
  if (data.activeId === id) data.activeId = Object.keys(data.flows)[0] ?? ''
  setFlowStorage(data)
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

function resolveTaskCounts(config: PracticeFlowConfig, taskWords: TaskWords) {
  const sources = new Set(config.nodes.map(node => node.source))
  const includesNew = sources.has('taskNew') || sources.has('current')
  const includesReview = sources.has('taskReview') || sources.has('current')
  const newWordNumber = includesNew ? taskWords.new.length : 0
  const reviewWordNumber = includesReview ? taskWords.review.length : 0
  return {
    total: newWordNumber + reviewWordNumber,
    newWordNumber,
    reviewWordNumber,
  }
}

/** 创建一个练习实例独享的 Flow Runtime。 */
export function createPracticeFlowRuntime(initialConfig: PracticeFlowConfig = BUILTIN_FLOWS.system) {
  const activeFlowConfig = shallowRef(resolveFlowConfigOrSystem(initialConfig))

  function resolveFlowInput(flowIdOrConfig: string | PracticeFlowConfig): PracticeFlowConfig {
    if (typeof flowIdOrConfig !== 'string') return resolveFlowConfigOrSystem(flowIdOrConfig)
    if (flowIdOrConfig === 'custom') {
      const activeId = getActiveCustomFlowId()
      return (activeId ? getUserFlow(activeId) : null) ?? resolveFlowConfigOrSystem(null)
    }
    return getUserFlow(flowIdOrConfig) ?? resolveFlowConfigOrSystem(getFlowConfig(flowIdOrConfig))
  }

  function loadPracticeFlow(flowIdOrConfig: string | PracticeFlowConfig) {
    activeFlowConfig.value = resolveFlowInput(flowIdOrConfig)
    return activeFlowConfig.value
  }

  function getActiveFlowId() {
    return activeFlowConfig.value.id
  }

  function getStep(cursor: PracticeFlowCursor): PracticeFlowStep {
    const config = activeFlowConfig.value
    return config.nodes[cursor.nodeIndex]?.steps[cursor.stepIndex] ?? config.nodes[0].steps[0]
  }

  function materializeStep(step: PracticeFlowStep): PracticePhaseDefinition {
    return {
      practiceType: STEP_TEMPLATE_META[step.templateId].practiceType,
      wordAdvance: materializeWordAdvance(step.wordAdvance),
      onEnd: step.onEnd ?? [],
    }
  }

  function getMainPhase(cursor: PracticeFlowCursor): PracticePhaseDefinition {
    return materializeStep(getStep(cursor))
  }

  function resolvePhaseByCursor(cursor: PracticeFlowCursor): PracticePhaseDefinition {
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
          wordAdvance: phase.wordAdvance,
        }
      }
    }
    return phase
  }

  function advanceStepCursor(cursor: PracticeFlowCursor): { cursor: PracticeFlowCursor; complete: boolean } {
    const nodes = activeFlowConfig.value.nodes
    const currentNode = nodes[cursor.nodeIndex]
    const isLastStep = cursor.stepIndex >= currentNode.steps.length - 1
    const isLastNode = cursor.nodeIndex >= nodes.length - 1

    if (isLastStep && isLastNode) return { cursor, complete: true }
    return {
      cursor: getInitialCursor({
        nodeIndex: isLastStep ? cursor.nodeIndex + 1 : cursor.nodeIndex,
        stepIndex: isLastStep ? 0 : cursor.stepIndex + 1,
      }),
      complete: false,
    }
  }

  function resolveFlowStart(
    mode: WordPracticeMode,
    taskWords: TaskWords,
    flowIdOrConfig?: string | PracticeFlowConfig
  ): FlowStartResult {
    if (taskWords.new.length + taskWords.review.length === 0) throw new Error('NO_WORDS')
    loadPracticeFlow(flowIdOrConfig ?? getFlowIdForMode(mode))
    const config = activeFlowConfig.value
    let nodeIndex = -1
    let words: Word[] = []
    for (let index = 0; index < config.nodes.length; index++) {
      const resolvedWords = resolveInitialWords(config.nodes[index].source, taskWords)
      if (resolvedWords.length > 0) {
        nodeIndex = index
        const firstStep = config.nodes[index].steps[0]
        words = firstStep.shuffleOnEnter ? shuffle(resolvedWords) : resolvedWords
        break
      }
    }
    if (nodeIndex < 0) throw new Error('NO_WORDS')

    return {
      words,
      ...resolveTaskCounts(config, taskWords),
      cursor: getInitialCursor({ nodeIndex }),
    }
  }

  return {
    activeFlowConfig,
    loadPracticeFlow,
    getActiveFlowId,
    getMainPhase,
    resolvePhaseByCursor,
    advanceStepCursor,
    resolveFlowStart,
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
