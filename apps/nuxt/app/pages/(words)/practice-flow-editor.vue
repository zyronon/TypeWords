<script setup lang="ts">
/**
 * 用户自定义练习流程编排页（Phase 3 · 档位 A）
 *
 * 路由：/practice-flow-editor
 * 提供可视化的阶段块拖拽排序编排能力，保存为本地 JSON 预设。
 */
import { BaseButton, BasePage, Dialog, Toast } from '@typewords/base'
import { APP_NAME } from '@typewords/core/config/env.ts'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import type { PracticeFlowConfig } from '~/composables/practice-words/registry-types.ts'
import { validateFlowConfig } from '~/composables/practice-words/flow-schema.ts'
import {
  listUserFlows,
  saveUserFlow,
  deleteUserFlow,
  getUserFlow,
  setActiveCustomFlowId,
  getActiveCustomFlowId,
} from '~/composables/practice-words/usePracticeFlowStorage.ts'

useHead({ title: APP_NAME + ' 流程编排' })

// ─── State ───
let config = $ref<PracticeFlowConfig>(createDefaultConfig())
let flowName = $ref('我的流程')
let savedFlows = $ref<{ id: string; name: string; updatedAt: number }[]>([])
let activeFlowId = $ref('')
let showDeleteDialog = $ref(false)
let deleteTargetId = $ref('')
let showResetConfirm = $ref(false)
let isDirty = $ref(false)

// ─── Init ───
function refreshFlowList() {
  savedFlows = listUserFlows()
  activeFlowId = getActiveCustomFlowId()
}

function createDefaultConfig(): PracticeFlowConfig {
  const id = `custom_${Date.now()}`
  return {
    id,
    version: 3,
    mode: WordPracticeMode.Custom,
    label: '自定义流程',
    nodes: [],
  }
}

function loadFlow(flowId: string) {
  const saved = getUserFlow(flowId)
  if (saved) {
    config = JSON.parse(JSON.stringify(saved)) // deep clone
    flowName = savedFlows.find(f => f.id === flowId)?.name || '我的流程'
    setActiveCustomFlowId(flowId)
    activeFlowId = flowId
    isDirty = false
    Toast.success('已加载')
  }
}

function resetToDefault() {
  config = createDefaultConfig()
  flowName = '我的流程'
  isDirty = false
  showResetConfirm = false
}

function onConfigUpdate(newConfig: PracticeFlowConfig) {
  config = newConfig
  isDirty = true
}

// ─── Save ───
function handleSave() {
  if (!config.nodes.length) {
    Toast.warning('请至少添加一个阶段')
    return
  }
  if (!flowName.trim()) {
    Toast.warning('请输入流程名称')
    return
  }

  // Assign IDs to nodes without one
  const configToSave = {
    ...config,
    label: flowName.trim(),
    nodes: config.nodes.map((n, i) => ({
      ...n,
      id: n.id || `node_${i}_${n.source}`,
    })),
  }

  // Validate
  const validated = validateFlowConfig(configToSave)
  if (validated.id === 'system' && configToSave.id !== 'system') {
    Toast.warning('流程配置无效，已回退为默认流程。请检查是否有空阶段或非法配置。')
    return
  }

  saveUserFlow(configToSave.id, configToSave, flowName.trim())
  setActiveCustomFlowId(configToSave.id)
  activeFlowId = configToSave.id
  isDirty = false
  refreshFlowList()
  Toast.success('保存成功')
}

// ─── Delete ───
function confirmDelete(flowId: string) {
  deleteTargetId = flowId
  showDeleteDialog = true
}

function handleDelete() {
  deleteUserFlow(deleteTargetId)
  if (activeFlowId === deleteTargetId) {
    activeFlowId = ''
    resetToDefault()
  }
  showDeleteDialog = false
  refreshFlowList()
  Toast.success('已删除')
}

// ─── Preview ───
let showPreview = $ref(false)

// ─── Init ───
refreshFlowList()
if (activeFlowId) {
  const existing = getUserFlow(activeFlowId)
  if (existing) {
    config = JSON.parse(JSON.stringify(existing))
    flowName = savedFlows.find(f => f.id === activeFlowId)?.name || '我的流程'
  }
}

// Format time
function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <BasePage>
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold">流程编排</h1>
        <p class="text-sm text-gray-500 mt-1">拖拽编排你的单词练习流程</p>
      </div>
      <div class="flex items-center gap-3">
        <input
          v-model="flowName"
          placeholder="流程名称"
          class="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 min-w-[150px]"
        />
        <BaseButton type="primary" @click="handleSave" :disabled="!isDirty">
          <div class="flex items-center gap-1">
            <IconFluentSave20Regular class="text-lg" />
            <span>保存</span>
          </div>
        </BaseButton>
        <BaseButton type="info" @click="showResetConfirm = true">
          恢复默认
        </BaseButton>
        <BaseButton type="info" @click="showPreview = !showPreview">
          {{ showPreview ? '编辑' : '预览' }}
        </BaseButton>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Editor / Preview -->
      <div class="flex-1 min-w-0">
        <FlowEditor v-if="!showPreview" :config="config" @update:config="onConfigUpdate" />
        <div v-else class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <div class="text-sm font-medium mb-3 text-gray-500">流程预览</div>
          <FlowPreview :nodes="config.nodes" />
        </div>
      </div>

      <!-- Sidebar: Saved flows list -->
      <div class="w-full lg:w-56 shrink-0">
        <div class="text-sm font-medium mb-3 text-gray-500">
          已保存的流程
          <span class="text-xs text-gray-400 ml-1">({{ savedFlows.length }})</span>
        </div>

        <div class="space-y-1.5" v-if="savedFlows.length">
          <div
            v-for="flow in savedFlows"
            :key="flow.id"
            class="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors"
            :class="flow.id === activeFlowId
              ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
              : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-transparent'"
            @click="loadFlow(flow.id)"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{{ flow.name }}</div>
              <div class="text-xs text-gray-400">{{ formatTime(flow.updatedAt) }}</div>
            </div>
            <button
              class="ml-2 p-0.5 text-gray-400 hover:text-red-500 shrink-0 transition-colors"
              @click.stop="confirmDelete(flow.id)"
            >
              <IconFluentDismiss12Regular />
            </button>
          </div>
        </div>
        <div v-else class="text-sm text-gray-400 text-center py-4">
          暂无保存的流程
        </div>
      </div>
    </div>

    <!-- Delete confirm dialog -->
    <Dialog v-model="showDeleteDialog" title="确认删除" :footer="true" @confirm="handleDelete">
      <p class="text-sm">确定要删除此流程吗？此操作不可撤销。</p>
    </Dialog>

    <!-- Reset confirm dialog -->
    <Dialog v-model="showResetConfirm" title="恢复默认" :footer="true" @confirm="resetToDefault">
      <p class="text-sm">将清除当前编辑内容，恢复为空白流程。确定继续？</p>
    </Dialog>
  </BasePage>
</template>
