import { WordPracticeStage } from '@typewords/core/types/enum.ts'
import type { PracticeFlowConfig } from './registry-types.ts'
import { BUILTIN_FLOWS } from './builtin-flows.ts'

export function validateFlowConfig(config: PracticeFlowConfig | null | undefined): PracticeFlowConfig {
  if (!config?.id) return BUILTIN_FLOWS.system
  return BUILTIN_FLOWS[config.id] ?? BUILTIN_FLOWS.system
}

export function isValidStageSequence(stages: WordPracticeStage[]): boolean {
  if (!stages.length) return false
  return stages[stages.length - 1] === WordPracticeStage.Complete || stages.includes(WordPracticeStage.Complete)
}
