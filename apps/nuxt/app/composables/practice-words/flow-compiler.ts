/**
 * 把「可序列化的流程配置」编译成「运行时注册表」。
 *
 * 输入：PracticeFlowConfig（nodes[] 树状结构）
 * 输出：ActiveFlowRegistry（phasesByCursor + 初始相位/Cursor）
 *
 * Phase 2.6 升级：
 * - 移除 spellInGroup 全局单例（wordLoop 子步骤由 step 配置的 subSteps[] 直接提供）
 * - PracticePhaseDefinition.requireWrongWordClear → onEnd: PracticeEndAction[]
 * - initialCursor 使用新字段（inWrongWordClear / loop / endActionIndex）
 *
 * 完全 cursor-native：无 WordPracticeStage、无 phasesByStage、无 stageSequence。
 */
import { compileWordAdvance, materializeStepTemplate } from './phase-templates.ts'
import type {
  ActiveFlowRegistry,
  PracticeEndAction,
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticeFlowNode,
  PracticePhaseDefinition,
  PracticeWordsSource,
  StepAdvanceRule,
} from './registry-types.ts'
import { cursorKey } from './registry-types.ts'

/**
 * 计算 StepAdvanceRule：
 * - 同 node 内还有下一 step → nextSource = 当前 node.source，shuffle 取下一 step.shuffleOnEnter
 * - 跨 node → nextSource = 下一 node.source，shuffle 取下一 node 第一 step.shuffleOnEnter
 * - 最后一步 → complete = true
 */
function computeStepAdvance(allNodes: PracticeFlowNode[], nodeIndex: number, stepIndex: number): StepAdvanceRule {
  const currentNode = allNodes[nodeIndex]
  const isLastStepInNode = stepIndex === currentNode.steps.length - 1
  const isLastNode = nodeIndex === allNodes.length - 1

  if (!isLastStepInNode) {
    const nextStep = currentNode.steps[stepIndex + 1]
    return {
      nextSource: currentNode.source as PracticeWordsSource,
      shuffle: nextStep.shuffleOnEnter ?? false,
    }
  }

  if (!isLastNode) {
    const nextNode = allNodes[nodeIndex + 1]
    const nextFirstStep = nextNode.steps[0]
    return {
      nextSource: nextNode.source as PracticeWordsSource,
      shuffle: nextFirstStep.shuffleOnEnter ?? false,
    }
  }

  return {
    nextSource: currentNode.source as PracticeWordsSource,
    complete: true,
  }
}

/** 编译单个 (nodeIndex, stepIndex) → PracticePhaseDefinition */
function compileStep(allNodes: PracticeFlowNode[], nodeIndex: number, stepIndex: number): PracticePhaseDefinition {
  const node = allNodes[nodeIndex]
  const step = node.steps[stepIndex]
  const templatePhase = materializeStepTemplate(step.templateId, step.displayOverride)

  return {
    ...templatePhase,
    wordAdvance: compileWordAdvance(step.wordAdvance),
    stepAdvance: computeStepAdvance(allNodes, nodeIndex, stepIndex),
    onEnd: step.onEnd ?? [],
  }
}

/**
 * 编译整条流程 → ActiveFlowRegistry。
 * loadPracticeFlow 最终调用的就是这个（经 buildRegistryFromConfig 包一层校验）。
 */
export function compileFlowConfig(config: PracticeFlowConfig): ActiveFlowRegistry {
  const phasesByCursor = new Map<string, PracticePhaseDefinition>()
  let firstPhase: PracticePhaseDefinition

  for (let ni = 0; ni < config.nodes.length; ni++) {
    const node = config.nodes[ni]
    for (let si = 0; si < node.steps.length; si++) {
      const phase = compileStep(config.nodes, ni, si)

      phasesByCursor.set(cursorKey(ni, si), phase)
      if (!firstPhase) firstPhase = phase
    }
  }

  const initialCursor: PracticeFlowCursor = {
    nodeIndex: 0,
    stepIndex: 0,
    inWrongWordClear: false,
    loop: null,
    endActionIndex: null,
  }

  return {
    config,
    phasesByCursor,
    firstPhase,
    initialCursor,
  }
}
