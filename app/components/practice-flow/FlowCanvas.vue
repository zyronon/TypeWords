<script setup lang="ts">
import { BaseIcon, Checkbox, Dialog, InputNumber, Tooltip } from '@/base'
import type {
  PracticeEndAction,
  PracticeFlowConfig,
  PracticeFlowNode,
  PracticeFlowStep,
  PracticeStepTemplateId,
  PracticeWordsSource,
} from '@/core/composables/practice-words/practice-flow-types.ts'
import { STEP_TEMPLATE_META } from '@/core/composables/practice-words/practice-flow-config.ts'

const props = defineProps<{
  config: PracticeFlowConfig
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:config': [config: PracticeFlowConfig]
}>()

const sourceOptions: { value: PracticeWordsSource; label: string }[] = [
  { value: 'taskNew', label: '新词' },
  { value: 'taskReview', label: '复习词' },
]

const stepOptions: { value: PracticeStepTemplateId; label: string }[] = [
  { value: 'followWrite', label: '跟写' },
  { value: 'spell', label: '拼写' },
  { value: 'listen', label: '听写' },
  { value: 'dictation', label: '默写' },
  { value: 'identify', label: '自测' },
]

let showSourceDialog = $ref(false)
let showStepDialog = $ref(false)
let stepTargetNodeIndex = $ref(0)
let draggedNodeIndex = $ref<number | null>(null)
let draggedStep = $ref<{ nodeIndex: number; stepIndex: number } | null>(null)

const nodes = $computed(() => props.config.nodes)

function nowId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function cloneNodes() {
  return props.config.nodes.map(node => ({
    ...node,
    steps: node.steps.map(step => ({ ...step })),
  }))
}

function emitNodes(nextNodes: PracticeFlowNode[]) {
  if (props.readonly) return
  emit('update:config', {
    ...props.config,
    nodes: nextNodes,
  })
}

function sourceLabel(source: PracticeWordsSource) {
  return sourceOptions.find(item => item.value === source)?.label ?? source
}

function stepLabel(step: PracticeFlowStep) {
  return step.label ?? STEP_TEMPLATE_META[step.templateId]?.label ?? step.templateId
}

function makeLoop(groupSize = 7) {
  return {
    type: 'wordLoop' as const,
    groupSize: Math.max(1, Number(groupSize || 7)),
    subSteps: [{ templateId: 'spell' as const }],
  }
}

function makeWrongWordClear(): PracticeEndAction {
  return {
    type: 'wrongWordClear',
    templateId: 'followWrite',
    wordAdvance: makeLoop(),
  }
}

function createStep(templateId: PracticeStepTemplateId): PracticeFlowStep {
  return {
    templateId,
    shuffleOnEnter: false,
    wordAdvance: templateId === 'followWrite' ? makeLoop() : undefined,
  }
}

function addNode(source: PracticeWordsSource) {
  emitNodes([
    ...nodes,
    {
      id: nowId(`node_${source}`),
      label: sourceLabel(source),
      source,
      steps: [],
    },
  ])
  showSourceDialog = false
}

function removeNode(nodeIndex: number) {
  emitNodes(nodes.filter((_, index) => index !== nodeIndex))
}

function moveNode(from: number, to: number) {
  if (to < 0 || to >= nodes.length || from === to) return
  const nextNodes = cloneNodes()
  const [target] = nextNodes.splice(from, 1)
  nextNodes.splice(to, 0, target)
  emitNodes(nextNodes)
}

function addStep(nodeIndex: number, templateId: PracticeStepTemplateId) {
  const nextNodes = cloneNodes()
  nextNodes[nodeIndex].steps.push(createStep(templateId))
  emitNodes(nextNodes)
  showStepDialog = false
}

function removeStep(nodeIndex: number, stepIndex: number) {
  const nextNodes = cloneNodes()
  nextNodes[nodeIndex].steps.splice(stepIndex, 1)
  emitNodes(nextNodes)
}

function moveStep(nodeIndex: number, from: number, to: number) {
  const node = nodes[nodeIndex]
  if (!node || to < 0 || to >= node.steps.length || from === to) return
  const nextNodes = cloneNodes()
  const [target] = nextNodes[nodeIndex].steps.splice(from, 1)
  nextNodes[nodeIndex].steps.splice(to, 0, target)
  emitNodes(nextNodes)
}

function updateStep(nodeIndex: number, stepIndex: number, patch: Partial<PracticeFlowStep>) {
  const nextNodes = cloneNodes()
  nextNodes[nodeIndex].steps[stepIndex] = {
    ...nextNodes[nodeIndex].steps[stepIndex],
    ...patch,
  }
  emitNodes(nextNodes)
}

function toggleShuffle(nodeIndex: number, stepIndex: number, checked: boolean) {
  updateStep(nodeIndex, stepIndex, { shuffleOnEnter: checked })
}

function toggleLoop(nodeIndex: number, stepIndex: number, checked: boolean) {
  const step = nodes[nodeIndex].steps[stepIndex]
  updateStep(nodeIndex, stepIndex, {
    wordAdvance: checked ? makeLoop(step.wordAdvance?.type === 'wordLoop' ? step.wordAdvance.groupSize : 7) : undefined,
  })
}

function updateLoopGroupSize(nodeIndex: number, stepIndex: number, value: number | null) {
  const step = nodes[nodeIndex].steps[stepIndex]
  if (step.wordAdvance?.type !== 'wordLoop') return
  updateStep(nodeIndex, stepIndex, {
    wordAdvance: makeLoop(value ?? 7),
  })
}

function hasWrongWordClear(step: PracticeFlowStep) {
  return step.onEnd?.some(action => action.type === 'wrongWordClear') ?? false
}

function toggleWrongWordClear(nodeIndex: number, stepIndex: number, checked: boolean) {
  const step = nodes[nodeIndex].steps[stepIndex]
  if (checked) {
    updateStep(nodeIndex, stepIndex, {
      onEnd: [...(step.onEnd?.filter(action => action.type !== 'wrongWordClear') ?? []), makeWrongWordClear()],
    })
    return
  }
  updateStep(nodeIndex, stepIndex, {
    onEnd: step.onEnd?.filter(action => action.type !== 'wrongWordClear'),
  })
}

function openStepDialog(nodeIndex: number) {
  stepTargetNodeIndex = nodeIndex
  showStepDialog = true
}

function onNodeDragStart(index: number, event: DragEvent) {
  if (props.readonly) return
  draggedNodeIndex = index
  event.dataTransfer?.setData('text/plain', String(index))
}

function onNodeDrop(index: number) {
  if (draggedNodeIndex !== null) moveNode(draggedNodeIndex, index)
  draggedNodeIndex = null
}

function onStepDragStart(nodeIndex: number, stepIndex: number, event: DragEvent) {
  if (props.readonly) return
  draggedStep = { nodeIndex, stepIndex }
  event.dataTransfer?.setData('text/plain', `${nodeIndex}:${stepIndex}`)
}

function onStepDrop(nodeIndex: number, stepIndex: number) {
  if (draggedStep && draggedStep.nodeIndex === nodeIndex) {
    moveStep(nodeIndex, draggedStep.stepIndex, stepIndex)
  }
  draggedStep = null
}
</script>

<template>
  <div class="flow-canvas-root">
    <div class="nodes-scroll" @dragover.prevent>
      <!-- Empty state: single "+" -->
      <div
        v-if="!nodes.length"
        class="empty-stage"
        role="button"
        :tabindex="readonly ? -1 : 0"
        @click="!readonly && (showSourceDialog = true)"
        @keydown.enter.space.prevent="!readonly && (showSourceDialog = true)"
      >
        <IconFluentAdd24Regular />
      </div>

      <template v-for="(node, nodeIndex) in nodes" :key="node.id || nodeIndex">
        <section
          class="stage-column"
          :class="{ dragging: draggedNodeIndex === nodeIndex, readonly }"
          :draggable="!readonly"
          @dragstart="onNodeDragStart(nodeIndex, $event)"
          @dragend="draggedNodeIndex = null"
          @drop="onNodeDrop(nodeIndex)"
        >
          <header class="stage-header">
            <Tooltip v-if="!readonly" title="拖拽阶段排序">
              <IconFluentArrowMove24Regular class="stage-drag" />
            </Tooltip>
            <div v-else class="stage-drag-placeholder" />
            <div class="stage-title">{{ $t(node.label) || sourceLabel(node.source) }}</div>
            <BaseIcon
              v-if="!readonly"
              title="上移阶段"
              no-bg
              role="button"
              :tabindex="nodeIndex === 0 ? -1 : 0"
              :disabled="nodeIndex === 0"
              @click="moveNode(nodeIndex, nodeIndex - 1)"
              @keydown.enter.space.prevent="moveNode(nodeIndex, nodeIndex - 1)"
            >
              <IconFluentArrowLeft20Regular />
            </BaseIcon>
            <BaseIcon
              v-if="!readonly"
              title="下移阶段"
              no-bg
              role="button"
              :tabindex="nodeIndex === nodes.length - 1 ? -1 : 0"
              :disabled="nodeIndex === nodes.length - 1"
              @click="moveNode(nodeIndex, nodeIndex + 1)"
              @keydown.enter.space.prevent="moveNode(nodeIndex, nodeIndex + 1)"
            >
              <IconFluentArrowRight20Regular />
            </BaseIcon>
            <BaseIcon
              v-if="!readonly"
              title="删除阶段"
              no-bg
              role="button"
              tabindex="0"
              @click="removeNode(nodeIndex)"
              @keydown.enter.space.prevent="removeNode(nodeIndex)"
            >
              <IconFluentDelete20Regular />
            </BaseIcon>
            <div v-else class="stage-delete-placeholder" />
          </header>

          <div class="steps-list">
            <template v-for="(step, stepIndex) in node.steps" :key="`${node.id}-${stepIndex}`">
              <article
                class="step-card"
                :draggable="!readonly"
                @dragstart.stop="onStepDragStart(nodeIndex, stepIndex, $event)"
                @dragend="draggedStep = null"
                @drop.stop="onStepDrop(nodeIndex, stepIndex)"
              >
                <div class="step-header">
                  <Tooltip v-if="!readonly" title="拖拽步骤排序">
                    <IconFluentArrowMove24Regular class="step-drag" />
                  </Tooltip>
                  <div v-else class="step-drag-placeholder" />
                  <div class="step-title">{{ $t(stepLabel(step)) }}</div>
                  <div class="step-actions">
                    <BaseIcon
                      v-if="!readonly"
                      title="上移步骤"
                      no-bg
                      role="button"
                      :tabindex="stepIndex === 0 ? -1 : 0"
                      :disabled="stepIndex === 0"
                      @click="moveStep(nodeIndex, stepIndex, stepIndex - 1)"
                      @keydown.enter.space.prevent="moveStep(nodeIndex, stepIndex, stepIndex - 1)"
                    >
                      <IconFluentArrowUp20Regular />
                    </BaseIcon>
                    <BaseIcon
                      v-if="!readonly"
                      title="下移步骤"
                      no-bg
                      role="button"
                      :tabindex="stepIndex === node.steps.length - 1 ? -1 : 0"
                      :disabled="stepIndex === node.steps.length - 1"
                      @click="moveStep(nodeIndex, stepIndex, stepIndex + 1)"
                      @keydown.enter.space.prevent="moveStep(nodeIndex, stepIndex, stepIndex + 1)"
                    >
                      <IconFluentArrowDown20Regular />
                    </BaseIcon>
                    <BaseIcon
                      v-if="!readonly"
                      title="删除步骤"
                      no-bg
                      role="button"
                      tabindex="0"
                      @click="removeStep(nodeIndex, stepIndex)"
                      @keydown.enter.space.prevent="removeStep(nodeIndex, stepIndex)"
                    >
                      <IconFluentDelete20Regular />
                    </BaseIcon>
                  </div>
                </div>

                <div class="step-options" :class="{ disabled: readonly }">
                  <Checkbox
                    :disabled="readonly"
                    :model-value="!!step.shuffleOnEnter"
                    @on-change="checked => toggleShuffle(nodeIndex, stepIndex, checked)"
                  >
                    进入时打乱单词
                  </Checkbox>
                  <Checkbox
                    :disabled="readonly"
                    :model-value="step.wordAdvance?.type === 'wordLoop'"
                    @on-change="checked => toggleLoop(nodeIndex, stepIndex, checked)"
                  >
                    是否循环练习
                  </Checkbox>
                  <div class="loop-size-row" :class="{ disabled: step.wordAdvance?.type !== 'wordLoop' || readonly }">
                    <span class="required">*</span>
                    <span>每第几个词循环：</span>
                    <InputNumber
                      :model-value="step.wordAdvance?.type === 'wordLoop' ? (step.wordAdvance.groupSize ?? 7) : 0"
                      :min="1"
                      :disabled="step.wordAdvance?.type !== 'wordLoop' || readonly"
                      @update:model-value="value => updateLoopGroupSize(nodeIndex, stepIndex, value)"
                    />
                  </div>
                  <Checkbox
                    :disabled="readonly"
                    :model-value="hasWrongWordClear(step)"
                    @on-change="checked => toggleWrongWordClear(nodeIndex, stepIndex, checked)"
                  >
                    结束后进入错词练习
                  </Checkbox>
                </div>
              </article>

              <div v-if="stepIndex < node.steps.length - 1" class="step-arrow">
                <IconFluentArrowDown24Regular />
              </div>
            </template>

            <!-- Add step button (only when not readonly) -->
            <div
              v-if="!readonly"
              class="add-step-card"
              role="button"
              tabindex="0"
              @click="openStepDialog(nodeIndex)"
              @keydown.enter.space.prevent="openStepDialog(nodeIndex)"
            >
              <IconFluentAdd24Regular class="text-2xl" />
            </div>
          </div>
        </section>

        <div v-if="nodeIndex < nodes.length - 1" class="node-arrow">
          <IconFluentArrowRight24Regular />
        </div>
      </template>

      <!-- Add node button: only show when there's at least one node and not readonly -->
      <div
        v-if="!readonly && nodes.length > 0"
        class="add-stage-card"
        role="button"
        tabindex="0"
        @click="showSourceDialog = true"
        @keydown.enter.space.prevent="showSourceDialog = true"
      >
        <IconFluentAdd24Regular />
      </div>
    </div>

    <Dialog v-model="showSourceDialog" title="选择词源" :footer="false">
      <div class="choice-list">
        <div
          v-for="source in sourceOptions"
          :key="source.value"
          class="choice-item"
          role="button"
          tabindex="0"
          @click="addNode(source.value)"
          @keydown.enter.space.prevent="addNode(source.value)"
        >
          {{ source.label }}
        </div>
      </div>
    </Dialog>

    <Dialog v-model="showStepDialog" title="新增步骤" :footer="false">
      <div class="choice-list">
        <div
          v-for="step in stepOptions"
          :key="step.value"
          class="choice-item"
          role="button"
          tabindex="0"
          @click="addStep(stepTargetNodeIndex, step.value)"
          @keydown.enter.space.prevent="addStep(stepTargetNodeIndex, step.value)"
        >
          {{ step.label }}
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped lang="scss">
.flow-canvas-root {
  min-width: 0;
}

.nodes-scroll {
  min-height: 38rem;
  overflow-x: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
}

.stage-column {
  min-width: 23rem;
  min-height: 38rem;
  border: 1px solid var(--color-link);
  border-radius: 0.35rem;
  background: var(--color-bg-1, transparent);
  transition:
    opacity 0.2s,
    box-shadow 0.2s;

  &.dragging {
    opacity: 0.45;
  }

  &:hover {
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12);
  }
}

.stage-header {
  height: 2.6rem;
  display: flex;
  align-items: center;
  background: var(--color-fourth);
  color: var(--color-font-3);
  border-radius: 0.35rem 0.35rem 0 0;
  padding: 0 0.5rem;
}

.stage-drag,
.step-drag {
  cursor: grab;
  color: var(--color-font-3);
}

.stage-drag-placeholder,
.step-drag-placeholder,
.stage-delete-placeholder {
  width: 1.8rem;
}

.stage-title {
  flex: 1;
  text-align: center;
  font-size: 1.25rem;
  font-weight: 600;
}

.steps-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.4rem;
}

.step-card {
  box-sizing: border-box;
  width: 100%;
  border-radius: 0.55rem;
  background: var(--color-fourth);
  padding: 0.5rem 1rem 1rem;
  color: var(--color-font-1);
}

.step-header {
  display: grid;
  grid-template-columns: 1.8rem 1fr auto;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.6rem;
}

.step-title {
  color: var(--color-font-3);
  text-align: center;
  font-size: 1.2rem;
  font-weight: 600;
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
}

.step-options {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;

  &.disabled {
    cursor: not-allowed;
  }
}

.loop-size-row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 0.35rem;
  padding-left: 1.65rem;
  font-size: 0.9rem;

  &.disabled {
    opacity: 0.55;
  }

  :deep(.input-number) {
    width: 7rem;
  }
}

.required {
  color: var(--color-link);
}

.step-arrow,
.node-arrow {
  color: var(--color-font-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-arrow {
  height: 2.2rem;
}

.node-arrow {
  flex: 0 0 1.4rem;
}

.add-step-card,
.add-stage-card,
.empty-stage {
  border-radius: 0.55rem;
  background: var(--color-fourth);
  color: var(--color-font-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    color: var(--color-link);
    box-shadow: inset 0 0 0 1px var(--color-link);
  }
}

.add-step-card {
  width: 100%;
  height: 4rem;
  margin-top: 2rem;
}

.add-stage-card,
.empty-stage {
  min-width: 23rem;
  height: 4rem;
  margin-left: 1rem;
}

.choice-list {
  display: grid;
  padding: 1rem;
  gap: 0.7rem;
  min-width: 16rem;
}

.choice-item {
  border: 1px solid var(--color-input-border);
  border-radius: 0.4rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    border-color: var(--color-link);
    color: var(--color-link);
    background: rgba(22, 119, 255, 0.08);
  }
}

.empty-stage:focus-visible,
.add-stage-card:focus-visible,
.add-step-card:focus-visible,
.choice-item:focus-visible {
  outline: 2px solid var(--color-link);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .stage-column,
  .add-step-card,
  .add-stage-card,
  .empty-stage,
  .choice-item {
    transition-duration: 0.01ms;
  }
}
</style>
