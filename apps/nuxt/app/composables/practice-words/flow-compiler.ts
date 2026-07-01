/**
 * 把「可序列化的流程配置」编译成「运行时注册表」。
 *
 * 输入：PracticeFlowConfig（nodes[] 树状结构）
 * 输出：ActiveFlowRegistry（phasesByCursor、spellInGroup、cursorSteps）
 *
 * 完全 cursor-native：无 WordPracticeStage、无 phasesByStage、无 stageSequence。
 */
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { STEP_TEMPLATE_META, buildSpellInGroupPhase, GROUP_SIZE } from './phase-templates.ts'
import type {
  ActiveFlowRegistry,
  PracticeFlowConfig,
  PracticeFlowCursor,
  PracticeFlowNode,
  PracticeFlowStep,
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
function computeStepAdvance(
  allNodes: PracticeFlowNode[],
  nodeIndex: number,
  stepIndex: number
): StepAdvanceRule {
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
function compileStep(
  allNodes: PracticeFlowNode[],
  nodeIndex: number,
  stepIndex: number
): PracticePhaseDefinition {
  const node = allNodes[nodeIndex]
  const step = node.steps[stepIndex]
  const template = STEP_TEMPLATE_META[step.templateId]

  const wordAdvanceCfg = step.wordAdvance
  const wordAdvance: PracticePhaseDefinition['wordAdvance'] =
    wordAdvanceCfg?.type === 'wordLoop'
      ? { type: 'wordLoop', groupSize: wordAdvanceCfg.groupSize ?? GROUP_SIZE }
      : { type: 'increment' }

  const display = step.displayOverride
    ? { ...template.display, ...step.displayOverride }
    : template.display

  return {
    practiceType: template.practiceType,
    display,
    wordAdvance,
    stepAdvance: computeStepAdvance(allNodes, nodeIndex, stepIndex),
    requireWrongWordClear: step.requireWrongWordClear ?? true,
  }
}

/**
 * 编译整条流程 → ActiveFlowRegistry。
 * loadPracticeFlow 最终调用的就是这个（经 buildRegistryFromConfig 包一层校验）。
 */
export function compileFlowConfig(config: PracticeFlowConfig): ActiveFlowRegistry {
  const phasesByCursor = new Map<string, PracticePhaseDefinition>()
  const cursorSteps: Array<{ nodeIndex: number; stepIndex: number }> = []

  let firstPhase: PracticePhaseDefinition | undefined
  let wordLoopPhase: PracticePhaseDefinition | undefined

  for (let ni = 0; ni < config.nodes.length; ni++) {
    const node = config.nodes[ni]
    for (let si = 0; si < node.steps.length; si++) {
      const phase = compileStep(config.nodes, ni, si)

      phasesByCursor.set(cursorKey(ni, si), phase)
      cursorSteps.push({ nodeIndex: ni, stepIndex: si })

      if (!firstPhase) firstPhase = phase
      if (phase.wordAdvance.type === 'wordLoop' && !wordLoopPhase) {
        wordLoopPhase = phase
      }
    }
  }

  const spellInGroup = wordLoopPhase ? buildSpellInGroupPhase(wordLoopPhase) : null

  const initialCursor: PracticeFlowCursor = {
    nodeIndex: 0,
    stepIndex: 0,
    spellSubStep: false,
    wrongRetry: false,
  }

  return {
    config,
    phasesByCursor,
    spellInGroup,
    firstPhase: firstPhase!,
    initialCursor,
    cursorSteps,
  }
}
