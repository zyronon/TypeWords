<script setup lang="ts">
import type { PracticeFlowNode, PracticeFlowStep } from '~/composables/practice-words/registry-types.ts'
import { STEP_TEMPLATE_META } from '~/composables/practice-words/phase-templates.ts'

const props = defineProps<{
  nodes: PracticeFlowNode[]
}>()

const sourceLabelMap: Record<string, string> = {
  taskNew: '新词',
  taskReview: '复习词',
  current: '当前词',
  wrongWords: '错词',
}

function hasWordLoop(step: PracticeFlowStep): boolean {
  return step.wordAdvance?.type === 'wordLoop'
}
</script>

<template>
  <div class="flow-preview space-y-2" v-if="nodes.length">
    <div v-for="(node, ni) in nodes" :key="ni" class="flex items-start gap-2">
      <!-- Node indicator -->
      <div class="flex flex-col items-center">
        <div class="w-3 h-3 rounded-full bg-blue-400 shrink-0 mt-1.5" />
        <div v-if="ni < nodes.length - 1" class="w-0.5 h-full min-h-4 bg-blue-200 my-0.5" />
      </div>

      <!-- Node content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-medium text-sm">{{ node.label }}</span>
          <span class="text-xs text-gray-400">({{ sourceLabelMap[node.source] || node.source }})</span>
        </div>

        <!-- Steps -->
        <div class="flex flex-wrap gap-1">
          <span
            v-for="(step, si) in node.steps"
            :key="si"
            class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          >
            {{ STEP_TEMPLATE_META[step.templateId]?.label || step.templateId }}
            <template v-if="hasWordLoop(step)">(组)</template>
          </span>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="text-sm text-gray-400 text-center py-4">
    流程为空，请添加阶段
  </div>
</template>
