/**
 * 内置练习流程的「可序列化配置表」。
 *
 * Phase 2 Architecture Upgrade：
 * - phases[] → nodes[{ source, steps[] }] 树状结构
 * - 每个 node 描述「练哪批词」，node.steps 描述「怎么练」
 * - 新增模式 = 在这里加一条配置，不必改 Navigator 里的 if-else
 *
 * 与 v1 WordPracticeModeStageMap + next() 行为对齐（由测试验收）。
 */
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import type { PracticeFlowConfig } from './registry-types.ts'

/** 内置流程字典：key 为 flowId，存入 sessionSnapshot.flowId */
export const BUILTIN_FLOWS: Record<string, PracticeFlowConfig> = {
  /**
   * System 模式：新词（跟写7词一组→听写→默写）+ 复习（自测→听写→默写）
   */
  system: {
    id: 'system',
    version: 2,
    mode: WordPracticeMode.System,
    label: '学习',
    nodes: [
      {
        id: 'new',
        label: '新词',
        source: 'taskNew',
        steps: [
          { templateId: 'followWrite', wordAdvance: { type: 'wordLoop', groupSize: 7 }, requireWrongWordClear: true, shuffleOnEnter: false },
          { templateId: 'listen', shuffleOnEnter: true, requireWrongWordClear: true },
          { templateId: 'dictation', requireWrongWordClear: true },
        ],
      },
      {
        id: 'review',
        label: '复习',
        source: 'taskReview',
        steps: [
          { templateId: 'identify', requireWrongWordClear: true },
          { templateId: 'listen', shuffleOnEnter: true, requireWrongWordClear: true },
          { templateId: 'dictation', requireWrongWordClear: true },
        ],
      },
    ],
  },

  /**
   * Free 模式：单阶段跟写，无 wordLoop，用户控显隐
   */
  free: {
    id: 'free',
    version: 2,
    mode: WordPracticeMode.Free,
    label: '自由练习',
    nodes: [
      {
        id: 'practice',
        label: '自由练习',
        source: 'current',
        steps: [
          { templateId: 'followWrite', wordAdvance: { type: 'increment' }, requireWrongWordClear: true, shuffleOnEnter: false },
        ],
      },
    ],
  },

  /**
   * Review 模式：仅复习（自测→听写→默写）
   */
  review: {
    id: 'review',
    version: 2,
    mode: WordPracticeMode.Review,
    label: '复习',
    nodes: [
      {
        id: 'review',
        label: '复习',
        source: 'taskReview',
        steps: [
          { templateId: 'identify', requireWrongWordClear: true },
          { templateId: 'listen', shuffleOnEnter: true, requireWrongWordClear: true },
          { templateId: 'dictation', requireWrongWordClear: true },
        ],
      },
    ],
  },

  /**
   * IdentifyOnly：新词自测 + 复习自测（2 个 node）
   */
  identifyOnly: {
    id: 'identifyOnly',
    version: 2,
    mode: WordPracticeMode.IdentifyOnly,
    label: '自测',
    nodes: [
      {
        id: 'new',
        label: '新词',
        source: 'taskNew',
        steps: [{ templateId: 'identify', requireWrongWordClear: true }],
      },
      {
        id: 'review',
        label: '复习',
        source: 'taskReview',
        steps: [{ templateId: 'identify', requireWrongWordClear: true }],
      },
    ],
  },

  /**
   * DictationOnly：新词默写 + 复习默写
   */
  dictationOnly: {
    id: 'dictationOnly',
    version: 2,
    mode: WordPracticeMode.DictationOnly,
    label: '默写',
    nodes: [
      {
        id: 'new',
        label: '新词',
        source: 'taskNew',
        steps: [{ templateId: 'dictation', requireWrongWordClear: true }],
      },
      {
        id: 'review',
        label: '复习',
        source: 'taskReview',
        steps: [{ templateId: 'dictation', requireWrongWordClear: true }],
      },
    ],
  },

  /**
   * ListenOnly：新词听写 + 复习听写
   */
  listenOnly: {
    id: 'listenOnly',
    version: 2,
    mode: WordPracticeMode.ListenOnly,
    label: '听写',
    nodes: [
      {
        id: 'new',
        label: '新词',
        source: 'taskNew',
        steps: [{ templateId: 'listen', shuffleOnEnter: false, requireWrongWordClear: true }],
      },
      {
        id: 'review',
        label: '复习',
        source: 'taskReview',
        steps: [{ templateId: 'listen', shuffleOnEnter: false, requireWrongWordClear: true }],
      },
    ],
  },

  /**
   * Shuffle：单阶段默写洗牌（使用 taskReview 词表）
   */
  shuffle: {
    id: 'shuffle',
    version: 2,
    mode: WordPracticeMode.Shuffle,
    label: '随机复习',
    nodes: [
      {
        id: 'practice',
        label: '随机复习',
        source: 'taskReview',
        steps: [
          { templateId: 'dictation', wordAdvance: { type: 'increment' }, requireWrongWordClear: true, shuffleOnEnter: true },
        ],
      },
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
 * 【Phase 3 编排页「恢复默认」会用】
 */
export function getAllBuiltinFlowIds(): string[] {
  return Object.keys(BUILTIN_FLOWS)
}
