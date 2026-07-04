<script setup lang="ts">
import type { PracticeFlowNode, PracticeFlowStep, PracticeStepTemplateId, PracticeWordsSource } from '~/composables/practice-words/registry-types.ts'
import { STEP_TEMPLATE_META } from '~/composables/practice-words/phase-templates.ts'

const props = defineProps<{
  node: PracticeFlowNode
  index: number
  isActive: boolean
  isDragging?: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  remove: [index: number]
  dragStart: [index: number, event: DragEvent]
}>()

const sourceLabelMap: Record<PracticeWordsSource, string> = {
  taskNew: '新词',
  taskReview: '复习词',
  current: '当前词',
  wrongWords: '错词',
}

function stepLabel(step: PracticeFlowStep): string {
  const meta = STEP_TEMPLATE_META[step.templateId]
  let label = meta?.label ?? step.templateId
  if (step.wordAdvance?.type === 'wordLoop') label += '(组)'
  return label
}
</script>

<template>
  <div
    class="phase-block-card rounded-lg border-2 p-3 cursor-pointer transition-all select-none"
    :class="{
      'border-blue-400 bg-blue-50 dark:bg-blue-900/20': isActive,
      'border-gray-200 bg-white dark:bg-gray-800 hover:border-gray-300 dark:border-gray-600': !isActive && !isDragging,
      'opacity-50 border-dashed border-gray-400': isDragging,
    }"
    @click="emit('select', index)"
    draggable="true"
    @dragstart="emit('dragStart', index, $event)"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="drag-handle cursor-grab text-gray-400 hover:text-gray-600">
          <IconFluentDrag24Regular class="text-lg" />
        </span>
        <span class="font-bold text-sm">{{ node.label || `阶段 ${index + 1}` }}</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
          {{ sourceLabelMap[node.source] || node.source }}
        </span>
        <button
          class="ml-1 p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
          @click.stop="emit('remove', index)"
          :title="'删除此阶段'"
        >
          <IconFluentDismiss16Regular class="text-sm" />
        </button>
      </div>
    </div>

    <!-- Steps preview -->
    <div class="flex flex-wrap gap-1">
      <span
        v-for="(step, si) in node.steps"
        :key="si"
        class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      >
        {{ stepLabel(step) }}
      </span>
      <span v-if="!node.steps.length" class="text-xs text-gray-400 italic">暂无步骤</span>
    </div>

    <!-- Wrong word clear indicator -->
    <div v-if="node.steps.some(s => s.onEnd?.some(a => a.type === 'wrongWordClear'))" class="mt-1.5">
      <span class="text-xs text-orange-500 flex items-center gap-0.5">
        <IconFluentWarning16Regular class="text-xs" />
        含错词清空
      </span>
    </div>
  </div>
</template>
