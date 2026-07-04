<script setup lang="ts">
import { BackIcon, BaseButton, BaseIcon, BaseInput, BasePage, Dialog, Toast } from '@typewords/base'
import { APP_NAME } from '@typewords/core/config/env.ts'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import type { PracticeFlowConfig } from '~/composables/practice-words/registry-types.ts'
import { validateFlowConfig } from '~/composables/practice-words/flow-schema.ts'
import { getAllBuiltinFlowIds, getFlowConfig } from '~/composables/practice-words/builtin-flows.ts'
import {
  deleteUserFlow,
  getActiveCustomFlowId,
  getUserFlow,
  listUserFlows,
  saveUserFlow,
  setActiveCustomFlowId,
} from '~/composables/practice-words/usePracticeFlowStorage.ts'

useHead({ title: APP_NAME + ' 流程编排' })

// ─── Types ───
interface FlowListItem {
  id: string
  name: string
  updatedAt: number
  builtin: boolean
}

// ─── State ───
let config = $ref<PracticeFlowConfig>(createBlankConfig())
let flowName = $ref('自由学习')
let flowListItems = $ref<FlowListItem[]>([])
let activeFlowId = $ref('')
let isBuiltinActive = $ref(false)
let isDirty = $ref(false)
let showDeleteDialog = $ref(false)

function nowId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function cloneConfig(value: PracticeFlowConfig): PracticeFlowConfig {
  return JSON.parse(JSON.stringify(value))
}

function createBlankConfig(): PracticeFlowConfig {
  return {
    id: nowId('custom'),
    version: 3,
    mode: WordPracticeMode.Custom,
    label: '自由学习',
    nodes: [],
  }
}

// ─── Flow list ───
function buildFlowList() {
  const items: FlowListItem[] = []

  // 系统内置流程
  const builtinIds = getAllBuiltinFlowIds()
  for (const id of builtinIds) {
    const cfg = getFlowConfig(id)
    if (cfg) {
      items.push({ id, name: cfg.label || id, updatedAt: 0, builtin: true })
    }
  }

  // 用户自定义流程
  const userFlows = listUserFlows()
  for (const uf of userFlows) {
    items.push({ id: uf.id, name: uf.name, updatedAt: uf.updatedAt, builtin: false })
  }

  flowListItems = items
  activeFlowId = getActiveCustomFlowId()
  // 如果当前激活的是用户流程且存在
  if (activeFlowId && userFlows.some(f => f.id === activeFlowId)) {
    isBuiltinActive = false
  } else if (!activeFlowId) {
    isBuiltinActive = false
  }
}

// ─── Load flow ───
function loadFlow(flowId: string, builtin: boolean) {
  if (builtin) {
    // 系统内置 → 只读查看
    const cfg = getFlowConfig(flowId)
    if (!cfg) return
    config = cloneConfig(cfg)
    flowName = cfg.label || flowId
    isBuiltinActive = true
    isDirty = false
    // 不修改 activeFlowId（保留用户激活的流程）
    return
  }

  const saved = getUserFlow(flowId)
  if (!saved) {
    Toast.warning('流程不存在')
    buildFlowList()
    return
  }
  config = cloneConfig(saved)
  flowName = saved.label || '自由学习'
  setActiveCustomFlowId(flowId)
  activeFlowId = flowId
  isBuiltinActive = false
  isDirty = false
}

// ─── Duplicate builtin flow ───
function duplicateBuiltin(flowId: string) {
  const cfg = getFlowConfig(flowId)
  if (!cfg) return
  const newId = nowId('custom')
  const dup = cloneConfig(cfg)
  dup.id = newId
  dup.mode = WordPracticeMode.Custom
  dup.label = cfg.label + '（副本）'
  saveUserFlow(newId, dup, dup.label)
  setActiveCustomFlowId(newId)
  config = cloneConfig(dup)
  flowName = dup.label
  activeFlowId = newId
  isBuiltinActive = false
  isDirty = false
  buildFlowList()
  Toast.success('已创建副本')
}

// ─── Create new (directly blank) ───
function createNew() {
  config = createBlankConfig()
  flowName = '自由学习'
  activeFlowId = ''
  isBuiltinActive = false
  isDirty = true
}

// ─── Config update (only allowed for user flows) ───
function onConfigUpdate(nextConfig: PracticeFlowConfig) {
  if (isBuiltinActive) return
  config = nextConfig
  isDirty = true
}

// ─── Normalize & save ───
function normalizeBeforeSave(): PracticeFlowConfig | null {
  const name = flowName.trim()
  if (!name) {
    Toast.warning('请输入流程名称')
    return null
  }
  if (!config.nodes.length || config.nodes.some(node => !node.steps.length)) {
    Toast.warning('请至少添加一个阶段和一个练习步骤')
    return null
  }

  return {
    ...config,
    id: config.id || nowId('custom'),
    version: 3,
    mode: WordPracticeMode.Custom,
    label: name,
    nodes: config.nodes.map((node, nodeIndex) => ({
      ...node,
      id: node.id || nowId(`node_${nodeIndex}`),
      label: node.label?.trim() || `阶段 ${nodeIndex + 1}`,
      steps: node.steps.map(step => ({
        ...step,
        wordAdvance:
          step.wordAdvance?.type === 'wordLoop'
            ? {
                type: 'wordLoop',
                groupSize: Math.max(1, Number(step.wordAdvance.groupSize || 7)),
                subSteps: step.wordAdvance.subSteps?.length ? step.wordAdvance.subSteps : [{ templateId: 'spell' }],
              }
            : step.wordAdvance,
      })),
    })),
  }
}

function handleSave() {
  if (isBuiltinActive) return
  const configToSave = normalizeBeforeSave()
  if (!configToSave) return

  const validated = validateFlowConfig(configToSave)
  if (validated.id === 'system' && configToSave.id !== 'system') {
    Toast.warning('流程配置无效，请检查是否有空阶段或非法配置')
    return
  }

  saveUserFlow(configToSave.id, configToSave, configToSave.label)
  setActiveCustomFlowId(configToSave.id)
  config = cloneConfig(configToSave)
  flowName = configToSave.label
  activeFlowId = configToSave.id
  isDirty = false
  buildFlowList()
  Toast.success('保存成功')
}

// ─── Delete ───
function requestDeleteCurrent() {
  if (isBuiltinActive) {
    Toast.warning('系统内置流程不可删除')
    return
  }
  if (!activeFlowId && !listUserFlows().some(flow => flow.id === config.id)) {
    config = createBlankConfig()
    flowName = config.label
    isDirty = false
    return
  }
  showDeleteDialog = true
}

function handleDeleteCurrent() {
  const targetId = activeFlowId || config.id
  if (targetId) {
    deleteUserFlow(targetId)
  }
  buildFlowList()
  config = createBlankConfig()
  flowName = config.label
  activeFlowId = ''
  isBuiltinActive = false
  isDirty = false
  showDeleteDialog = false
  Toast.success('已删除')
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── Init ───
buildFlowList()
if (activeFlowId) {
  const existing = getUserFlow(activeFlowId)
  if (existing) {
    config = cloneConfig(existing)
    flowName = existing.label || '自由学习'
    isBuiltinActive = false
    isDirty = false
  }
}
</script>

<template>
  <BasePage>
    <div class="flow-page">
      <div class="flow-header">
        <div class="flow-title-block">
          <BackIcon />
          <div>
            <h1>流程管理</h1>
            <p>创建专属于你的单词练习流程</p>
          </div>
        </div>

        <div class="flow-actions">
          <BaseInput
            v-model="flowName"
            placeholder="流程名称"
            class="flow-name-input mr-4"
            :disabled="isBuiltinActive"
          />
          <BaseButton type="primary" @click="handleSave" :disabled="isBuiltinActive || !isDirty">
            <div class="inline-center gap-1">
              <IconFluentSave20Regular />
              保存
            </div>
          </BaseButton>
          <BaseButton v-if="!isBuiltinActive" type="primary" class="danger-button" @click="requestDeleteCurrent">
            <div class="inline-center gap-1">
              <IconFluentDelete20Regular />
              删除
            </div>
          </BaseButton>
        </div>
      </div>

      <div class="flow-workspace">
        <!-- Left: Flow list -->
        <aside class="flow-list-panel">
          <div class="flex justify-between items-center mb-2">
            <span class="text-lg">流程列表</span>
            <BaseIcon title="新建流程" @click="createNew">
              <IconFluentAdd24Regular />
            </BaseIcon>
          </div>
          <div class="flow-list">
            <div
              v-for="item in flowListItems"
              :key="item.id"
              class="flow-list-item"
              :class="{ active: item.id === activeFlowId && !isBuiltinActive }"
              @click="loadFlow(item.id, item.builtin)"
            >
              <div class="flex items-center gap-1">
                <span class="flow-list-name">{{ item.name }}</span>
                <span v-if="item.builtin" class="builtin-badge">内置</span>
              </div>
            </div>
          </div>
        </aside>

        <!-- Center: Canvas -->
        <div class="flow-canvas-wrapper">
          <!-- Builtin readonly banner -->
          <div v-if="isBuiltinActive" class="flex gap-2 items-center">
            <!-- Duplicate button for builtin -->
            <div class="builtin-dup-row">
              <BaseButton @click="duplicateBuiltin(config.id)"> 创建副本 </BaseButton>
            </div>
            <div class="builtin-readonly-banner">
              <IconFluentLockClosed20Regular />
              <span>系统内置流程，仅可查看，可创建副本后编辑。</span>
            </div>
          </div>

          <FlowCanvas
            class="flow-canvas"
            :config="config"
            :readonly="isBuiltinActive"
            @update:config="onConfigUpdate"
          />
        </div>
      </div>
    </div>

    <Dialog v-model="showDeleteDialog" title="确认删除" :footer="true" @ok="handleDeleteCurrent">
      <div class="p-4 pb-0">确定要删除当前流程吗？此操作不可撤销。</div>
    </Dialog>
  </BasePage>
</template>

<style scoped lang="scss">
.flow-page {
  min-height: calc(100vh - 4rem);
  color: var(--color-font-1);
}

.flow-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 2rem;
}

.flow-title-block {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;

  h1 {
    margin: 0;
    font-size: 1.8rem;
    line-height: 1.2;
    font-weight: 700;
  }

  p {
    margin: 0.6rem 0 0;
    color: var(--color-font-3);
    font-size: 0.95rem;
  }
}

.flow-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.flow-name-input {
  width: 20rem;
  max-width: min(20rem, 45vw);
}

.danger-button {
  background: #f43f5e !important;

  &:hover {
    background: #e11d48 !important;
  }
}

.flow-workspace {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  gap: 2rem;
  min-height: 42rem;
}

.flow-list-panel {
  border-right: 1px solid #ababab;
  padding-right: 1.8rem;
}

.flow-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.flow-list-item, {
  min-height: 2.5rem;
  border-radius: 0.45rem;
  background: var(--color-fourth);
  color: var(--color-font-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.flow-list-item {
  gap: 0.25rem;
  text-align: center;

  &.active,
  &:hover {
    color: #1677ff;
    box-shadow: inset 0 0 0 1px #1677ff;
    background: rgba(22, 119, 255, 0.08);
  }
}

.flow-list-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1rem;
}

.flow-list-meta {
  font-size: 0.75rem;
  opacity: 0.65;
}

.builtin-badge {
  font-size: 0.65rem;
  padding: 0 0.3rem;
  border-radius: 0.2rem;
  background: #e6f4ff;
  color: #1677ff;
  line-height: 1.4;
  flex-shrink: 0;
}

.flow-canvas-wrapper {
  min-width: 0;
}

.flow-canvas {
  min-width: 0;
}

.builtin-readonly-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  margin-bottom: 1rem;
  border-radius: 0.4rem;
  background: #fffbe6;
  color: #ad6800;
  font-size: 0.9rem;
  border: 1px solid #ffe58f;
}

.builtin-dup-row {
  margin-bottom: 1rem;
}
</style>
