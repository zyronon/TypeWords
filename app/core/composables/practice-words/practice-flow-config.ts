/** Step 模板和内置可序列化流程。 */
import { WordPracticeMode, WordPracticeType } from '@/core/types/enum.ts'
import { PRACTICE_WORD_GROUP_SIZE } from '@/core/utils/cache.ts'
import type {
  PracticeEndAction,
  PracticeFlowConfig,
  PracticeStepTemplate,
  PracticeStepTemplateId,
  PracticeWordAdvanceConfig,
  WordAdvanceRule,
} from './practice-flow-types.ts'

/** 跟写分组大小，与 v1 groupSize 一致。 */
export const GROUP_SIZE = PRACTICE_WORD_GROUP_SIZE
export const CURRENT_FLOW_VERSION = 6

export const STEP_TEMPLATE_META: Record<PracticeStepTemplateId, PracticeStepTemplate> = {
  followWrite: { id: 'followWrite', label: 'followWrite', practiceType: WordPracticeType.FollowWrite },
  spell: { id: 'spell', label: 'spell', practiceType: WordPracticeType.Spell },
  listen: { id: 'listen', label: 'listen', practiceType: WordPracticeType.Listen },
  dictation: { id: 'dictation', label: 'dictation', practiceType: WordPracticeType.Dictation },
  identify: { id: 'identify', label: 'identify', practiceType: WordPracticeType.Identify },
}

export function materializeWordAdvance(config?: PracticeWordAdvanceConfig): WordAdvanceRule {
  return config?.type === 'wordLoop'
    ? {
        type: 'wordLoop',
        groupSize: config.groupSize,
        subSteps: config.subSteps ?? [],
      }
    : { type: 'increment' }
}

/** 跟写 + 7 词 wordLoop + Spell 子步骤 */
const WORD_LOOP_WITH_SPELL: PracticeWordAdvanceConfig = {
  type: 'wordLoop',
  groupSize: GROUP_SIZE,
  subSteps: [{ templateId: 'spell' }],
}

/** 标准错词清空 action：FollowWrite + wordLoop(Spell)，与 v1 行为对齐 */
const WRONG_WORD_CLEAR_ACTION: PracticeEndAction = {
  type: 'wrongWordClear',
  templateId: 'followWrite',
  wordAdvance: WORD_LOOP_WITH_SPELL,
}

/** 标准错词清空 onEnd 队列（单个动作） */
const DEFAULT_ON_END: PracticeEndAction[] = [WRONG_WORD_CLEAR_ACTION]

/** 内置流程字典：key 为 flowId，存入 sessionSnapshot.flowId */
export const BUILTIN_FLOWS: Record<string, PracticeFlowConfig> = {
  /**
   * System 模式：新词（跟写7词一组→听写→默写）+ 复习（自测→听写→默写）
   */
  system: {
    id: 'system',
    version: CURRENT_FLOW_VERSION,
    mode: WordPracticeMode.System,
    label: 'smart_learning',
    nodes: [
      {
        id: 'new',
        label: 'new_words',
        source: 'taskNew',
        steps: [
          {
            templateId: 'followWrite',
            wordAdvance: WORD_LOOP_WITH_SPELL,
            onEnd: DEFAULT_ON_END,
            shuffleOnEnter: false,
          },
          {
            templateId: 'listen',
            shuffleOnEnter: true,
            onEnd: DEFAULT_ON_END,
          },
          {
            templateId: 'dictation',
            shuffleOnEnter: true,
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
      {
        id: 'review',
        label: 'review',
        source: 'taskReview',
        steps: [
          {
            templateId: 'identify',
            onEnd: DEFAULT_ON_END,
          },
          {
            templateId: 'listen',
            shuffleOnEnter: true,
            onEnd: DEFAULT_ON_END,
          },
          {
            templateId: 'dictation',
            shuffleOnEnter: true,
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
    ],
  },
  /**
   * Free 模式：单阶段跟写，无 wordLoop，用户控显隐
   */
  free: {
    id: 'free',
    version: CURRENT_FLOW_VERSION,
    mode: WordPracticeMode.Free,
    label: 'free_practice',
    nodes: [
      {
        id: 'practice',
        label: 'free_practice',
        source: 'current',
        steps: [
          {
            templateId: 'followWrite',
            wordAdvance: { type: 'increment' },
            onEnd: DEFAULT_ON_END,
            shuffleOnEnter: false,
          },
        ],
      },
    ],
  },
  /**
   * Review 模式：仅复习（自测→听写→默写）
   */
  review: {
    id: 'review',
    version: CURRENT_FLOW_VERSION,
    mode: WordPracticeMode.Review,
    label: 'review',
    nodes: [
      {
        id: 'review',
        label: 'review',
        source: 'taskReview',
        steps: [
          {
            templateId: 'identify',
            onEnd: DEFAULT_ON_END,
          },
          {
            templateId: 'listen',
            shuffleOnEnter: true,
            onEnd: DEFAULT_ON_END,
          },
          {
            templateId: 'dictation',
            shuffleOnEnter: true,
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
    ],
  },
  /**
   * IdentifyOnly：新词自测 + 复习自测（2 个 node）
   */
  identifyOnly: {
    id: 'identifyOnly',
    version: CURRENT_FLOW_VERSION,
    mode: WordPracticeMode.IdentifyOnly,
    label: 'identify',
    nodes: [
      {
        id: 'new',
        label: 'new_words',
        source: 'taskNew',
        steps: [
          {
            templateId: 'identify',
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
      {
        id: 'review',
        label: 'review',
        source: 'taskReview',
        steps: [
          {
            templateId: 'identify',
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
    ],
  },
  /**
   * DictationOnly：新词默写 + 复习默写
   */
  dictationOnly: {
    id: 'dictationOnly',
    version: CURRENT_FLOW_VERSION,
    mode: WordPracticeMode.DictationOnly,
    label: 'dictation',
    nodes: [
      {
        id: 'new',
        label: 'new_words',
        source: 'taskNew',
        steps: [
          {
            templateId: 'dictation',
            shuffleOnEnter: true,
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
      {
        id: 'review',
        label: 'review',
        source: 'taskReview',
        steps: [
          {
            templateId: 'dictation',
            shuffleOnEnter: true,
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
    ],
  },
  /**
   * ListenOnly：新词听写 + 复习听写
   */
  listenOnly: {
    id: 'listenOnly',
    version: CURRENT_FLOW_VERSION,
    mode: WordPracticeMode.ListenOnly,
    label: 'listen',
    nodes: [
      {
        id: 'new',
        label: 'new_words',
        source: 'taskNew',
        steps: [
          {
            templateId: 'listen',
            shuffleOnEnter: false,
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
      {
        id: 'review',
        label: 'review',
        source: 'taskReview',
        steps: [
          {
            templateId: 'listen',
            shuffleOnEnter: false,
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
    ],
  },
  /**
   * Shuffle：单阶段默写洗牌（使用 taskReview 词表）
   */
  shuffle: {
    id: 'shuffle',
    version: CURRENT_FLOW_VERSION,
    mode: WordPracticeMode.Shuffle,
    label: 'random_review',
    nodes: [
      {
        id: 'practice',
        label: 'random_review',
        source: 'taskReview',
        steps: [
          {
            templateId: 'dictation',
            wordAdvance: { type: 'increment' },
            onEnd: DEFAULT_ON_END,
            shuffleOnEnter: true,
          },
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
  if (mode === WordPracticeMode.Custom) return 'custom'
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
