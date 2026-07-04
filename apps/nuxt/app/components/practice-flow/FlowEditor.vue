<script setup lang="ts">
import type {
  PracticeFlowConfig,
  PracticeFlowNode,
  PracticeFlowStep,
  PracticeStepTemplateId,
  PracticeWordsSource,
  PracticeEndAction,
  PracticeWordAdvanceConfig,
} from '~/composables/practice-words/registry-types.ts'
import { STEP_TEMPLATE_META } from '~/composables/practice-words/phase-templates.ts'

const props = defineProps<{
  config: PracticeFlowConfig
}>()

const emit = defineEmits<{
  'update:config': [config: PracticeFlowConfig]
}>()

// ─── State ───
let selectedNodeIndex = $ref<number | null>(null)
let dragIndex = $ref<number | null>(null)

// ─── Derived ───
const nodes = $computed(() => props.config.nodes)
const selectedNode = $computed(() =>
  selectedNodeIndex !== null ? nodes[selectedNodeIndex] : null
)

// ─── Available step templates (for "add step") ───
const stepTemplateIds = Object.keys(STEP_TEMPLATE_META) as PracticeStepTemplateId[]

const sourceOptions: { value: PracticeWordsSource; label: string }[] = [
  { value: 'taskNew', label: '新词' },
  { value: 'taskReview', label: '复习词' },
  { value: 'current', label: '当前词' },
]

// ─── Node CRUD ───
function addNode(source: PracticeWordsSource) {
  const newNodes = [
    ...nodes,
    {
      id: '',
      label: sourceOptions.find(s => s.value === source)?.label + '阶段',
      source,
      steps: [],
    } satisfies PracticeFlowNode,
  ]
  emitUpdate({ nodes: newNodes })
  selectedNodeIndex = newNodes.length - 1
}

function removeNode(index: number) {
  if (nodes.length <= 1) return
  const newNodes = nodes.filter((_, i) => i !== index)
  if (selectedNodeIndex === index) selectedNodeIndex = null
  else if (selectedNodeIndex !== null && selectedNodeIndex > index) selectedNodeIndex--
  emitUpdate({ nodes: newNodes })
}

function moveNode(from: number, to: number) {
  if (from === to) return
  const newNodes = [...nodes]
  const [moved] = newNodes.splice(from, 1)
  newNodes.splice(to, 0, moved)
  if (selectedNodeIndex === from) selectedNodeIndex = to
  else if (selectedNodeIndex !== null) {
    if (from < to && selectedNodeIndex > from && selectedNodeIndex <= to) selectedNodeIndex--
    else if (from > to && selectedNodeIndex >= to && selectedNodeIndex < from) selectedNodeIndex++
  }
  emitUpdate({ nodes: newNodes })
}

function updateNode(index: number, patch: Partial<PracticeFlowNode>) {
  const newNodes = nodes.map((n, i) => (i === index ? { ...n, ...patch } : n))
  emitUpdate({ nodes: newNodes })
}

// ─── Step CRUD ───
function addStep(nodeIndex: number, templateId: PracticeStepTemplateId) {
  const newNodes = nodes.map((n, i) => {
    if (i !== nodeIndex) return n
    return {
      ...n,
      steps: [
        ...n.steps,
        {
          templateId,
          wordAdvance: templateId === 'followWrite' ? { type: 'wordLoop', groupSize: 7, subSteps: [{ templateId: 'spell' }] } : undefined,
          shuffleOnEnter: false,
        } satisfies PracticeFlowStep,
      ],
    }
  })
  emitUpdate({ nodes: newNodes })
}

function removeStep(nodeIndex: number, stepIndex: number) {
  const newNodes = nodes.map((n, i) => {
    if (i !== nodeIndex) return n
    return { ...n, steps: n.steps.filter((_, si) => si !== stepIndex) }
  })
  emitUpdate({ nodes: newNodes })
}

function moveStep(nodeIndex: number, from: number, to: number) {
  if (from === to) return
  const newNodes = nodes.map((n, i) => {
    if (i !== nodeIndex) return n
    const newSteps = [...n.steps]
    const [moved] = newSteps.splice(from, 1)
    newSteps.splice(to, 0, moved)
    return { ...n, steps: newSteps }
  })
  emitUpdate({ nodes: newNodes })
}

function updateStep(nodeIndex: number, stepIndex: number, patch: Partial<PracticeFlowStep>) {
  const newNodes = nodes.map((n, i) => {
    if (i !== nodeIndex) return n
    const newSteps = n.steps.map((s, si) => (si === stepIndex ? { ...s, ...patch } : s))
    return { ...n, steps: newSteps }
  })
  emitUpdate({ nodes: newNodes })
}

function toggleWrongWordClear(nodeIndex: number, stepIndex: number) {
  const step = nodes[nodeIndex].steps[stepIndex]
  const hasIt = step.onEnd?.some(a => a.type === 'wrongWordClear')
  const newSteps = nodes.map((n, i) => {
    if (i !== nodeIndex) return n
    return {
      ...n,
      steps: n.steps.map((s, si) => {
        if (si !== stepIndex) return s
        if (hasIt) {
          return { ...s, onEnd: s.onEnd?.filter(a => a.type !== 'wrongWordClear') }
        }
        return {
          ...s,
          onEnd: [
            ...(s.onEnd || []),
            {
              type: 'wrongWordClear',
              templateId: 'followWrite',
              wordAdvance: { type: 'wordLoop', groupSize: 7, subSteps: [{ templateId: 'spell' }] },
            } satisfies PracticeEndAction,
          ],
        }
      }),
    }
  })
  emitUpdate({ nodes: newNodes })
}

// ─── Helpers ───
function emitUpdate(patch: Partial<PracticeFlowConfig>) {
  emit('update:config', { ...props.config, ...patch })
}

function nodeTitle(node: PracticeFlowNode, index: number): string {
  return node.label || `阶段 ${index + 1}`
}

function sourceLabel(source: PracticeWordsSource): string {
  return sourceOptions.find(s => s.value === source)?.label ?? source
}

// ─── Drag & Drop ───
function onDragStart(index: number, e: DragEvent) {
  dragIndex = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(targetIndex: number) {
  if (dragIndex !== null && dragIndex !== targetIndex) {
    moveNode(dragIndex, targetIndex)
  }
  dragIndex = null
}

function onDragEnd() {
  dragIndex = null
}
</script>

<template>
  <div class="flow-editor flex flex-col lg:flex-row gap-4 h-full min-h-[500px]">
    <!-- Left: Available blocks palette -->
    <div class="w-full lg:w-48 shrink-0">
      <div class="text-sm font-medium mb-3 text-gray-500">添加阶段</div>
      <div class="space-y-2">
        <div
          v-for="opt in sourceOptions"
          :key="opt.value"
          class="w-full text-left px-3 py-2.5 box-border rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-blue-900/20"
          @click="addNode(opt.value)"
        >
          <div class="font-medium">{{ opt.label }}阶段</div>
          <div class="text-xs text-gray-400 mt-0.5">词源：{{ opt.label }}</div>
        </div>
      </div>

      <!-- Quick presets -->
      <div class="text-sm font-medium mt-6 mb-3 text-gray-500">快捷预设</div>
      <div class="space-y-1.5">
        <button
          class="w-full text-left px-3 py-1.5 rounded text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors dark:bg-purple-900/20 dark:hover:bg-purple-900/30 dark:text-purple-300"
          @click="addNode('taskNew'); addNode('taskReview')"
        >
          新词 + 复习（双阶段）
        </button>
      </div>
    </div>

    <!-- Center: Sortable flow node list -->
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium mb-3 text-gray-500">
        流程编排
        <span class="text-xs text-gray-400 ml-1">（拖拽排序）</span>
      </div>

      <div class="space-y-2" @dragover="onDragOver">
        <!-- Empty state -->
        <div
          v-if="!nodes.length"
          class="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 dark:border-gray-600"
        >
          <IconFluentAddCircle20Regular class="text-3xl mb-2" />
          <span>从左侧添加阶段开始编排</span>
        </div>

        <div
          v-for="(node, ni) in nodes"
          :key="ni"
          @drop="onDrop(ni)"
        >
          <PhaseBlockCard
            :node="node"
            :index="ni"
            :is-active="selectedNodeIndex === ni"
            :is-dragging="dragIndex === ni"
            @select="selectedNodeIndex = ni"
            @remove="removeNode(ni)"
            @drag-start="onDragStart"
          />
        </div>
      </div>
    </div>

    <!-- Right: Properties panel -->
    <div class="w-full lg:w-64 shrink-0" v-if="selectedNode">
      <div class="text-sm font-medium mb-3 text-gray-500">阶段属性</div>

      <div class="space-y-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <!-- Node label -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">名称</label>
          <input
            :value="selectedNode.label"
            @input="updateNode(selectedNodeIndex!, { label: ($event.target as HTMLInputElement).value })"
            class="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
        </div>

        <!-- Source -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">词源</label>
          <select
            :value="selectedNode.source"
            @change="updateNode(selectedNodeIndex!, { source: ($event.target as HTMLSelectElement).value as PracticeWordsSource })"
            class="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          >
            <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <!-- Steps list -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500">步骤</label>
            <div class="flex gap-1">
              <button
                v-for="tid in stepTemplateIds"
                :key="tid"
                class="text-xs px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300"
                @click="addStep(selectedNodeIndex!, tid)"
              >
                +{{ STEP_TEMPLATE_META[tid]?.label }}
              </button>
            </div>
          </div>

          <div class="space-y-1.5" v-if="selectedNode.steps.length">
            <div
              v-for="(step, si) in selectedNode.steps"
              :key="si"
              class="step-item flex items-center justify-between bg-white dark:bg-gray-700 rounded px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center gap-1.5">
                <!-- Move up/down -->
                <button
                  class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  :disabled="si === 0"
                  @click="moveStep(selectedNodeIndex!, si, si - 1)"
                >▲</button>
                <button
                  class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  :disabled="si === selectedNode!.steps.length - 1"
                  @click="moveStep(selectedNodeIndex!, si, si + 1)"
                >▼</button>

                <span class="font-medium">{{ STEP_TEMPLATE_META[step.templateId]?.label }}</span>

                <!-- wordLoop badge -->
                <span
                  v-if="step.wordAdvance?.type === 'wordLoop'"
                  class="text-xs px-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                >组</span>
              </div>

              <div class="flex items-center gap-1">
                <!-- Wrong word clear toggle -->
                <button
                  class="text-xs px-1.5 py-0.5 rounded transition-colors"
                  :class="step.onEnd?.some(a => a.type === 'wrongWordClear')
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-500'"
                  @click="toggleWrongWordClear(selectedNodeIndex!, si)"
                  title="错词清空"
                >错词</button>

                <button
                  class="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                  @click="removeStep(selectedNodeIndex!, si)"
                >
                  <IconFluentDismiss12Regular />
                </button>
              </div>
            </div>
          </div>

          <div v-else class="text-xs text-gray-400 italic py-2">
            点击上方按钮添加步骤
          </div>
        </div>

        <!-- Shuffle option for first step -->
        <div
          v-if="selectedNode.steps.length > 0"
          class="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-600"
        >
          <label class="text-xs text-gray-500">步骤进入时打乱</label>
          <div class="flex gap-1">
            <button
              v-for="(step, si) in selectedNode.steps"
              :key="si"
              class="text-xs px-1.5 py-0.5 rounded transition-colors"
              :class="step.shuffleOnEnter
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'"
              @click="updateStep(selectedNodeIndex!, si, { shuffleOnEnter: !step.shuffleOnEnter })"
            >
              {{ STEP_TEMPLATE_META[step.templateId]?.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Right: Placeholder when no node selected -->
    <div v-else class="w-full lg:w-64 shrink-0 flex items-center justify-center">
      <div class="text-sm text-gray-400 text-center">
        <IconFluentOptions20Regular class="text-2xl mb-2 mx-auto" />
        选择一个阶段<br/>查看属性
      </div>
    </div>
  </div>
</template>
