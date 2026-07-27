/** Step 模板、默认显隐和内置可序列化流程。 */
import { WordPracticeMode, WordPracticeType } from '@typewords/core/types/enum.ts'
import type {
  PracticeDisplayPolicy,
  PracticeEndAction,
  PracticeFlowConfig,
  PracticeStepTemplate,
  PracticeStepTemplateId,
  PracticeWordAdvanceConfig,
  WordAdvanceRule,
} from './practice-flow-types.ts'

/** 跟写分组大小，与 v1 groupSize 一致。 */
export const GROUP_SIZE = 7

export function phaseDisplay(overrides: Partial<PracticeDisplayPolicy> = {}): PracticeDisplayPolicy {
  return {
    showWordTranslation: true,
    showSentences: true,
    showSentenceTranslation: true,
    showPhrases: true,
    showSynos: true,
    showEtymology: true,
    showRelWords: true,
    inputMode: 'followWrite',
    ...overrides,
  }
}

const DISPLAY_FOLLOW_WRITE = phaseDisplay()
const DISPLAY_SPELL = phaseDisplay({
  inputMode: 'spell',
  showEtymology: false,
  showRelWords: false,
})
const DISPLAY_LISTEN = phaseDisplay({
  showWordTranslation: false,
  showSentences: false,
  showSentenceTranslation: false,
  showPhrases: false,
  showSynos: false,
  showEtymology: false,
  showRelWords: false,
  inputMode: 'spell',
})
const DISPLAY_DICTATION = phaseDisplay({
  showWordTranslation: true,
  showSentences: false,
  showSentenceTranslation: false,
  showPhrases: false,
  showSynos: false,
  showEtymology: false,
  showRelWords: false,
  inputMode: 'dictation',
})
const DISPLAY_IDENTIFY = phaseDisplay({
  showWordTranslation: false,
  showSentences: false,
  showSentenceTranslation: false,
  showPhrases: false,
  showSynos: false,
  showEtymology: false,
  showRelWords: false,
  inputMode: 'followWrite',
})

export const STEP_TEMPLATE_META: Record<PracticeStepTemplateId, PracticeStepTemplate> = {
  followWrite: { id: 'followWrite', label: '跟写', practiceType: WordPracticeType.FollowWrite, display: DISPLAY_FOLLOW_WRITE, },
  spell: { id: 'spell', label: '拼写', practiceType: WordPracticeType.Spell, display: DISPLAY_SPELL },
  listen: { id: 'listen', label: '听写', practiceType: WordPracticeType.Listen, display: DISPLAY_LISTEN },
  dictation: { id: 'dictation', label: '默写', practiceType: WordPracticeType.Dictation, display: DISPLAY_DICTATION },
  identify: { id: 'identify', label: '自测', practiceType: WordPracticeType.Identify, display: DISPLAY_IDENTIFY },
}

export function materializeStepTemplate(
  templateId: PracticeStepTemplateId,
  displayOverride?: Partial<PracticeDisplayPolicy>
): Pick<PracticeStepTemplate, 'practiceType' | 'display'> {
  const template = STEP_TEMPLATE_META[templateId]
  return {
    practiceType: template.practiceType,
    display: displayOverride ? { ...template.display, ...displayOverride } : template.display,
  }
}

export function materializeWordAdvance(config?: PracticeWordAdvanceConfig): WordAdvanceRule {
  return config?.type === 'wordLoop'
    ? {
        type: 'wordLoop',
        groupSize: config.groupSize ?? GROUP_SIZE,
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
    version: 4,
    mode: WordPracticeMode.System,
    label: '学习',
    nodes: [
      {
        id: 'new',
        label: '新词',
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
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
      {
        id: 'review',
        label: '复习',
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
    version: 4,
    mode: WordPracticeMode.Free,
    label: '自由练习',
    nodes: [
      {
        id: 'practice',
        label: '自由练习',
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
    version: 4,
    mode: WordPracticeMode.Review,
    label: '复习',
    nodes: [
      {
        id: 'review',
        label: '复习',
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
    version: 4,
    mode: WordPracticeMode.IdentifyOnly,
    label: '自测',
    nodes: [
      {
        id: 'new',
        label: '新词',
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
        label: '复习',
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
    version: 4,
    mode: WordPracticeMode.DictationOnly,
    label: '默写',
    nodes: [
      {
        id: 'new',
        label: '新词',
        source: 'taskNew',
        steps: [
          {
            templateId: 'dictation',
            onEnd: DEFAULT_ON_END,
          },
        ],
      },
      {
        id: 'review',
        label: '复习',
        source: 'taskReview',
        steps: [
          {
            templateId: 'dictation',
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
    version: 4,
    mode: WordPracticeMode.ListenOnly,
    label: '听写',
    nodes: [
      {
        id: 'new',
        label: '新词',
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
        label: '复习',
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
    version: 4,
    mode: WordPracticeMode.Shuffle,
    label: '随机复习',
    nodes: [
      {
        id: 'practice',
        label: '随机复习',
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
