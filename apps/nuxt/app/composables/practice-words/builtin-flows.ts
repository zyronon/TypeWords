/**
 * 内置练习流程的「可序列化配置表」。
 *
 * 每个 WordPracticeMode 对应一条 phases[]，与 v1 的 WordPracticeModeStageMap + next() 行为对齐。
 * 新增内置模式 = 在这里加一条配置，不必改 Navigator 里的 if-else。
 */
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import type { PracticeFlowConfig } from './registry-types.ts'

/** 内置流程字典：key 为 flowId，存入 sessionSnapshot.flowId */
export const BUILTIN_FLOWS: Record<string, PracticeFlowConfig> = {
  system: {
    id: 'system',
    version: 1,
    mode: WordPracticeMode.System,
    label: '学习',
    phases: [
      { templateId: 'followWriteNew' },
      { templateId: 'listenNew' },
      { templateId: 'dictationNew', advanceWordsFrom: 'taskReview' },
      { templateId: 'identifyReview' },
      { templateId: 'listenReview' },
      { templateId: 'dictationReview' },
    ],
  },
  free: {
    id: 'free',
    version: 1,
    mode: WordPracticeMode.Free,
    label: '自由练习',
    phases: [{ templateId: 'freePractice' }],
  },
  identifyOnly: {
    id: 'identifyOnly',
    version: 1,
    mode: WordPracticeMode.IdentifyOnly,
    label: '自测',
    phases: [
      { templateId: 'identifyNew', advanceWordsFrom: 'taskReview' },
      { templateId: 'identifyReview' },
    ],
  },
  dictationOnly: {
    id: 'dictationOnly',
    version: 1,
    mode: WordPracticeMode.DictationOnly,
    label: '默写',
    phases: [
      { templateId: 'dictationNew', advanceWordsFrom: 'taskReview' },
      { templateId: 'dictationReview' },
    ],
  },
  listenOnly: {
    id: 'listenOnly',
    version: 1,
    mode: WordPracticeMode.ListenOnly,
    label: '听写',
    phases: [
      { templateId: 'listenNew', advanceWordsFrom: 'taskReview' },
      { templateId: 'listenReview' },
    ],
  },
  shuffle: {
    id: 'shuffle',
    version: 1,
    mode: WordPracticeMode.Shuffle,
    label: '随机复习',
    phases: [{ templateId: 'shuffle' }],
  },
  review: {
    id: 'review',
    version: 1,
    mode: WordPracticeMode.Review,
    label: '复习',
    phases: [
      { templateId: 'identifyReview' },
      { templateId: 'listenReview' },
      { templateId: 'dictationReview' },
    ],
  },
}

/**
 * settingStore.wordPracticeMode → 默认内置 flowId。
 * 无自定义流程时，mode 与 flow 一一对应。
 */
export function getFlowIdForMode(mode: WordPracticeMode): string {
  const entry = Object.values(BUILTIN_FLOWS).find(flow => flow.mode === mode)
  return entry?.id ?? 'system'
}

/** 按 flowId 取配置对象（未校验）；loadPracticeFlow 内部会再 validate */
export function getFlowConfig(flowId: string): PracticeFlowConfig {
  return BUILTIN_FLOWS[flowId] ?? BUILTIN_FLOWS.system
}

/**
 * 列出所有内置 flowId。
 * 【Phase 2.5 编排页「恢复默认」会用】当前练习页未调用。
 */
export function getAllBuiltinFlowIds(): string[] {
  return Object.keys(BUILTIN_FLOWS)
}
