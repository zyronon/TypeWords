/** Flow 配置存储、迁移、校验，以及每个练习实例独享的运行时。 */
import { shallowRef } from 'vue'
import type { TaskWords, Word } from '@typewords/core/types/types.ts'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import {
  BUILTIN_FLOWS,
  CURRENT_FLOW_VERSION,
  getFlowConfig,
  getFlowIdForMode,
  materializeStepTemplate,
  materializeWordAdvance,
} from './practice-flow-config.ts'
import type {
  FlowStartResult,
  PracticeEndAction,
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticeFlowStep,
  PracticeLoopSubStep,
  PracticePhaseDefinition,
  PracticeStepTemplateId,
  PracticeWordAdvanceConfig,
  PracticeWordsSource,
} from './practice-flow-types.ts'

const VALID_SOURCES = new Set<PracticeWordsSource>(['taskNew', 'taskReview', 'current', 'wrongWords'])
const VALID_TEMPLATE_IDS: PracticeStepTemplateId[] = ['followWrite', 'spell', 'listen', 'dictation', 'identify']
const VALID_TEMPLATE_IDS_SET = new Set<string>(VALID_TEMPLATE_IDS)
const VALID_INPUT_MODES = new Set(['followWrite', 'spell', 'dictation'])
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

function migrateSubSteps(subSteps: PracticeLoopSubStep[], addLegacyDefault: boolean): PracticeLoopSubStep[] {
  return subSteps.map(subStep => addLegacyDefault && subStep.clearWrongOnSuccess === undefined
    ? { ...subStep, clearWrongOnSuccess: subStep.templateId === 'spell' }
    : { ...subStep })
}

function migrateWordAdvance(
  wordAdvance: PracticeWordAdvanceConfig | undefined,
  addLegacyDefault: boolean
): PracticeWordAdvanceConfig | undefined {
  if (wordAdvance?.type !== 'wordLoop') return wordAdvance
  return {
    ...wordAdvance,
    subSteps: migrateSubSteps(wordAdvance.subSteps ?? [], addLegacyDefault),
  }
}

function migrateEndAction(action: PracticeEndAction, addLegacyDefault: boolean): PracticeEndAction {
  if (action.type !== 'wrongWordClear') return { ...action }
  return {
    ...action,
    wordAdvance: migrateWordAdvance(action.wordAdvance, addLegacyDefault),
  }
}

/** 将受支持的旧配置迁移到当前版本；未来版本返回 null，避免错误降级解释。 */
export function migrateFlowConfig(config: PracticeFlowConfig | null | undefined): PracticeFlowConfig | null {
  if (!config || !Number.isInteger(config.version) || config.version < 1 || config.version > CURRENT_FLOW_VERSION) {
    return null
  }

  const migrated = cloneConfig(config)
  const addLegacyDefault = migrated.version <= 4
  migrated.version = CURRENT_FLOW_VERSION
  migrated.nodes = (migrated.nodes ?? []).map(node => ({
    ...node,
    steps: (node.steps ?? []).map(step => ({
      ...step,
      wordAdvance: migrateWordAdvance(step.wordAdvance, addLegacyDefault),
      onEnd: step.onEnd?.map(action => migrateEndAction(action, addLegacyDefault)),
    })),
  }))
  return migrated
}

function isValidDisplayOverride(value: unknown): boolean {
  if (value === undefined) return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([key, item]) => {
    if (key === 'inputMode') return typeof item === 'string' && VALID_INPUT_MODES.has(item)
    return typeof item === 'boolean'
  })
}

function isValidSubStep(subStep: PracticeLoopSubStep): boolean {
  return (
    !!subStep &&
    VALID_TEMPLATE_IDS_SET.has(subStep.templateId) &&
    isValidDisplayOverride(subStep.displayOverride) &&
    (subStep.clearWrongOnSuccess === undefined || typeof subStep.clearWrongOnSuccess === 'boolean')
  )
}

function isValidWordAdvance(wordAdvance?: PracticeWordAdvanceConfig): boolean {
  if (wordAdvance === undefined) return true
  if (wordAdvance.type === 'increment') return true
  if (wordAdvance.type !== 'wordLoop') return false
  if (!Number.isFinite(wordAdvance.groupSize) || !Number.isInteger(wordAdvance.groupSize) || wordAdvance.groupSize! < 1) {
    return false
  }
  return Array.isArray(wordAdvance.subSteps) && wordAdvance.subSteps.every(isValidSubStep)
}

function isValidEndAction(action: PracticeEndAction): boolean {
  if (!action || typeof action !== 'object') return false
  if (action.type === 'wrongWordClear') {
    return (
      VALID_TEMPLATE_IDS_SET.has(action.templateId) &&
      isValidDisplayOverride(action.displayOverride) &&
      isValidWordAdvance(action.wordAdvance)
    )
  }
  if (action.type === 'collectWrongWords') return ['favorite', 'wrongBook'].includes(action.target)
  if (action.type === 'generateReport') return ['stepSummary', 'sessionSummary'].includes(action.reportType)
  if (action.type === 'navigate') return typeof action.target === 'string' && action.target.length > 0
  return false
}

function isValidFlowConfig(config: PracticeFlowConfig): boolean {
  if (
    !config.id ||
    config.version !== CURRENT_FLOW_VERSION ||
    !VALID_MODES.has(config.mode) ||
    !Array.isArray(config.nodes) ||
    config.nodes.length === 0
  ) {
    return false
  }

  const nodeIds = new Set<string>()
  for (const node of config.nodes) {
    if (
      !node?.id ||
      nodeIds.has(node.id) ||
      !VALID_SOURCES.has(node.source) ||
      !Array.isArray(node.steps) ||
      node.steps.length === 0
    ) {
      return false
    }
    nodeIds.add(node.id)

    for (const step of node.steps) {
      if (
        !VALID_TEMPLATE_IDS_SET.has(step?.templateId) ||
        !isValidDisplayOverride(step.displayOverride) ||
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
export function validateFlowConfig(config: PracticeFlowConfig | null | undefined): PracticeFlowConfig {
  const migrated = migrateFlowConfig(config)
  return migrated && isValidFlowConfig(migrated) ? migrated : cloneConfig(BUILTIN_FLOWS.system)
}

function migrateStoredFlow(id: string, data: PracticeFlowStorageData): PracticeFlowConfig | null {
  const entry = data.flows[id]
  if (!entry) return null
  const migrated = migrateFlowConfig(entry.config)
  if (!migrated || !isValidFlowConfig(migrated)) return null
  if (entry.config.version !== migrated.version || JSON.stringify(entry.config) !== JSON.stringify(migrated)) {
    entry.config = migrated
    setFlowStorage(data)
  }
  return migrated
}

export function listUserFlows(): { id: string; name: string; updatedAt: number }[] {
  const data = getFlowStorage()
  return Object.entries(data.flows)
    .filter(([id]) => !!migrateStoredFlow(id, data))
    .map(([id, entry]) => ({ id, name: entry.name, updatedAt: entry.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getUserFlow(flowId: string): PracticeFlowConfig | null {
  const data = getFlowStorage()
  return migrateStoredFlow(flowId, data)
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
  const data = getFlowStorage()
  const now = Date.now()
  const existing = data.flows[id]
  const validated = validateFlowConfig(config)
  if (validated.id === 'system' && config.id !== 'system') throw new Error('INVALID_FLOW_CONFIG')
  data.flows[id] = {
    config: validated,
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
  const activeFlowConfig = shallowRef(validateFlowConfig(initialConfig))

  function resolveFlowInput(flowIdOrConfig: string | PracticeFlowConfig): PracticeFlowConfig {
    if (typeof flowIdOrConfig !== 'string') return validateFlowConfig(flowIdOrConfig)
    if (flowIdOrConfig === 'custom') {
      const activeId = getActiveCustomFlowId()
      return validateFlowConfig(activeId ? getUserFlow(activeId) : null)
    }
    return validateFlowConfig(getUserFlow(flowIdOrConfig) ?? getFlowConfig(flowIdOrConfig))
  }

  function loadPracticeFlow(flowIdOrConfig: string | PracticeFlowConfig) {
    activeFlowConfig.value = resolveFlowInput(flowIdOrConfig)
    return activeFlowConfig.value
  }

  function getActiveFlowConfig() {
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
      ...materializeStepTemplate(step.templateId, step.displayOverride),
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
    const nodeIndex = config.nodes.findIndex(node => resolveInitialWords(node.source, taskWords).length > 0)
    if (nodeIndex < 0) throw new Error('NO_WORDS')

    return {
      words: resolveInitialWords(config.nodes[nodeIndex].source, taskWords),
      ...resolveTaskCounts(config, taskWords),
      cursor: getInitialCursor({ nodeIndex }),
    }
  }

  return {
    activeFlowConfig,
    loadPracticeFlow,
    getActiveFlowConfig,
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
