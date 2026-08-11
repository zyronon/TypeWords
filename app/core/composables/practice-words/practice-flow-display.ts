import type { PracticeFlowConfig, PracticeFlowCursor } from './practice-flow-types.ts'

export interface PracticeFlowProgressStage {
  name: string
  ratio: number
  percentage: number
  active: boolean
  children?: PracticeFlowProgressStage[]
}

export interface PracticeFlowDisplayState {
  status: string
  stages: PracticeFlowProgressStage[]
  showSkipStep: boolean
}

export interface PracticeFlowDisplayInput {
  config: PracticeFlowConfig
  cursor: PracticeFlowCursor
  wordIndex: number
  wordCount: number
  translate?: (key: string) => string
}

/**
 * 将 Flow/Cursor 转成跨平台可直接渲染的阶段模型。
 * Web 和小程序必须共享此计算，平台组件只负责视觉呈现。
 */
export function getPracticeFlowDisplayState(input: PracticeFlowDisplayInput): PracticeFlowDisplayState {
  const { config, cursor } = input
  const translate = input.translate ?? (key => key)
  const nodes = config.nodes
  const currentProgress = input.wordCount ? (input.wordIndex / input.wordCount) * 100 : 0

  let status = translate(config.label)
  if (cursor.loop) {
    status = '小组巩固'
  } else if (cursor.inWrongWordClear) {
    status = translate('review_wrong_words')
  } else {
    const node = nodes[cursor.nodeIndex]
    if (node && !(nodes.length === 1 && node.steps.length === 1)) {
      const step = node.steps[cursor.stepIndex]
      const stepLabel = step?.label ?? step?.templateId ?? ''
      status = translate(node.label) + (stepLabel ? ` · ${translate(stepLabel)}` : '')
    }
  }

  if (!nodes.length) {
    return { status, stages: [], showSkipStep: false }
  }

  if (nodes.length === 1 && nodes[0].steps.length === 1) {
    return {
      status,
      stages: [{ name: '', ratio: 100, percentage: currentProgress, active: true }],
      showSkipStep: false,
    }
  }

  const isSingleNode = nodes.length === 1
  const stages = nodes.map((node, nodeIndex): PracticeFlowProgressStage => {
    const isCurrentNode = nodeIndex === cursor.nodeIndex
    const isCompletedNode = nodeIndex < cursor.nodeIndex
    const children =
      isCurrentNode && node.steps.length > 1
        ? node.steps.map((step, stepIndex): PracticeFlowProgressStage => ({
            name: translate(step.label ?? step.templateId),
            ratio: Math.floor(100 / node.steps.length),
            percentage: stepIndex < cursor.stepIndex ? 100 : stepIndex === cursor.stepIndex ? currentProgress : 0,
            active: stepIndex === cursor.stepIndex,
          }))
        : undefined

    return {
      name: translate(node.label),
      ratio: isSingleNode ? 100 : isCurrentNode ? 70 : 30,
      percentage: isCompletedNode ? 100 : isCurrentNode ? currentProgress : 0,
      active: isCurrentNode,
      children,
    }
  })

  return {
    status,
    stages,
    showSkipStep: nodes.length > 1 || nodes[0].steps.length > 1,
  }
}
