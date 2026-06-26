import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import type { PracticeFlowConfig } from './registry-types.ts'

export const BUILTIN_FLOWS: Record<string, PracticeFlowConfig> = {
  system: { id: 'system', version: 1, mode: WordPracticeMode.System, label: '学习' },
  free: { id: 'free', version: 1, mode: WordPracticeMode.Free, label: '自由练习' },
  identifyOnly: { id: 'identifyOnly', version: 1, mode: WordPracticeMode.IdentifyOnly, label: '自测' },
  dictationOnly: { id: 'dictationOnly', version: 1, mode: WordPracticeMode.DictationOnly, label: '默写' },
  listenOnly: { id: 'listenOnly', version: 1, mode: WordPracticeMode.ListenOnly, label: '听写' },
  shuffle: { id: 'shuffle', version: 1, mode: WordPracticeMode.Shuffle, label: '随机复习' },
  review: { id: 'review', version: 1, mode: WordPracticeMode.Review, label: '复习' },
}

export function getFlowIdForMode(mode: WordPracticeMode): string {
  const entry = Object.values(BUILTIN_FLOWS).find(flow => flow.mode === mode)
  return entry?.id ?? 'system'
}

export function getFlowConfig(flowId: string): PracticeFlowConfig {
  return BUILTIN_FLOWS[flowId] ?? BUILTIN_FLOWS.system
}
