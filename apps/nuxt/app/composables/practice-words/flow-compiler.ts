/**
 * 把「可序列化的流程配置」编译成「运行时注册表」。
 *
 * 输入：PracticeFlowConfig（builtin-flows 或用户 JSON）
 * 输出：ActiveFlowRegistry（phasesByStage、错词/Spell 特殊相位等）
 *
 * 这一层存在的意义：Navigator 只读编译结果，不读 JSON 原始字段。
 */
import { WordPracticeMode, WordPracticeStage, WordPracticeType } from '@typewords/core/types/enum.ts'
import {
  buildSpellInGroupPhase,
  GROUP_SIZE,
  PHASE_TEMPLATE_META,
  resolveBlockStage,
  resolveBlockWordsFrom,
} from './phase-templates.ts'
import type {
  ActiveFlowRegistry,
  PracticeFlowConfig,
  PracticeFlowPhaseBlock,
  PracticePhaseDefinition,
} from './registry-types.ts'

/**
 * 内部：根据模板元数据 + 已算好的 advance 规则，拼出一条 PracticePhaseDefinition。
 * 【内部 helper，不导出】
 */
function def(
  mode: WordPracticeMode,
  stage: WordPracticeStage,
  practiceType: WordPracticeType,
  block: PracticeFlowPhaseBlock,
  wordAdvance: PracticePhaseDefinition['wordAdvance'],
  stageAdvance: PracticePhaseDefinition['stageAdvance'],
  requireWrongWordClear: boolean
): PracticePhaseDefinition {
  const meta = PHASE_TEMPLATE_META[block.templateId]
  return {
    key: { mode, stage, practiceType },
    display: meta.display,
    wordAdvance,
    stageAdvance,
    requireWrongWordClear,
  }
}

/**
 * 把流程配置里的「一个阶段块」编译成完整阶段定义。
 *
 * - wordAdvance：是否 7 词 wordLoop，来自 block.wordLoop 或模板默认
 * - stageAdvance：链到下一块的 nextStage / wordsFrom / shuffle；最后一块 → complete
 *
 * 这是「可编排」的核心：改 builtin-flows 的 phases 数组即可改行为，不必改 Navigator。
 */
function compilePhaseBlock(
  mode: WordPracticeMode,
  block: PracticeFlowPhaseBlock,
  nextBlock: PracticeFlowPhaseBlock | undefined
): PracticePhaseDefinition {
  const meta = PHASE_TEMPLATE_META[block.templateId]
  const stage = resolveBlockStage(block)
  const useWordLoop = block.wordLoop ?? meta.wordLoop ?? false
  const groupSize = block.groupSize ?? GROUP_SIZE
  const requireWrongWordClear = block.requireWrongWordClear ?? meta.requireWrongWordClear ?? true

  const wordAdvance = useWordLoop
    ? { type: 'wordLoop' as const, groupSize }
    : { type: 'increment' as const }

  let stageAdvance: PracticePhaseDefinition['stageAdvance']

  if (!nextBlock) {
    stageAdvance = { wordsFrom: 'current', complete: true }
  } else {
    const nextStage = resolveBlockStage(nextBlock)
    const advanceWordsFrom =
      block.advanceWordsFrom ?? resolveBlockWordsFrom(nextBlock)
    const shuffle = block.shuffle ?? meta.shuffleOnAdvance ?? false
    stageAdvance = {
      nextStage,
      wordsFrom: advanceWordsFrom,
      shuffle,
      toast: block.toast ?? meta.advanceToast,
    }
  }

  return def(mode, stage, meta.practiceType, block, wordAdvance, stageAdvance, requireWrongWordClear)
}

/**
 * 编译整条流程 → ActiveFlowRegistry。
 * loadPracticeFlow 最终调用的就是这个（经 buildRegistryFromConfig 包一层校验）。
 */
export function compileFlowConfig(config: PracticeFlowConfig): ActiveFlowRegistry {
  const phasesByStage = new Map<WordPracticeStage, PracticePhaseDefinition>()
  const stageSequence: WordPracticeStage[] = []
  const compiled: PracticePhaseDefinition[] = []

  for (let i = 0; i < config.phases.length; i++) {
    const phase = compilePhaseBlock(config.mode, config.phases[i], config.phases[i + 1])
    compiled.push(phase)
    phasesByStage.set(phase.key.stage, phase)
    stageSequence.push(phase.key.stage)
  }

  const wordLoopPhase = compiled.find(p => p.wordAdvance.type === 'wordLoop') ?? compiled[0]
  const spellInGroup = wordLoopPhase?.wordAdvance.type === 'wordLoop'
    ? buildSpellInGroupPhase(wordLoopPhase)
    : null

  return {
    config,
    phasesByStage,
    stageSequence,
    spellInGroup,
    firstPhase: compiled[0],
  }
}
