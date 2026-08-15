<script setup lang="ts">
import { BackIcon, BaseButton, BaseIcon, BaseInput, BasePage, Dialog, Toast } from '@/base'
import { APP_NAME } from '@/core/config/env.ts'
import { WordPracticeMode } from '@/core/types/enum.ts'
import { onMounted, onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import type { PracticeFlowConfig } from '@/core/composables/practice-words/practice-flow-types.ts'
import {
  CURRENT_FLOW_VERSION,
  getAllBuiltinFlowIds,
  getFlowConfig,
} from '@/core/composables/practice-words/practice-flow-config.ts'
import {
  deleteUserFlow,
  getActiveCustomFlowId,
  getUserFlow,
  listUserFlows,
  saveUserFlow,
  setActiveCustomFlowId,
} from '@/core/composables/practice-words/practice-flow-runtime.ts'

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
let selectedFlowId = $ref('')
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
    version: CURRENT_FLOW_VERSION,
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
  if (!confirmDiscardChanges()) return
  if (builtin) {
    // 系统内置 → 只读查看
    const cfg = getFlowConfig(flowId)
    if (!cfg) return
    config = cloneConfig(cfg)
    flowName = cfg.label || flowId
    isBuiltinActive = true
    selectedFlowId = flowId
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
  selectedFlowId = flowId
  isBuiltinActive = false
  isDirty = false
}

// ─── Duplicate builtin flow ───
function duplicateBuiltin(flowId: string) {
  if (!confirmDiscardChanges()) return
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
  selectedFlowId = newId
  isBuiltinActive = false
  isDirty = false
  buildFlowList()
  Toast.success('已创建副本')
}

// ─── Create new (directly blank) ───
function createNew() {
  if (!confirmDiscardChanges()) return
  config = createBlankConfig()
  flowName = '自由学习'
  selectedFlowId = config.id
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
    version: CURRENT_FLOW_VERSION,
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
                subSteps: step.wordAdvance.subSteps?.length
                  ? step.wordAdvance.subSteps
                  : [{ templateId: 'spell' }],
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

  try {
    saveUserFlow(configToSave.id, configToSave, configToSave.label)
  } catch {
    Toast.warning('流程配置无效，请检查是否有空阶段或非法配置')
    return
  }

  setActiveCustomFlowId(configToSave.id)
  config = cloneConfig(configToSave)
  flowName = configToSave.label
  activeFlowId = configToSave.id
  selectedFlowId = configToSave.id
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
  if (!listUserFlows().some(flow => flow.id === selectedFlowId || flow.id === config.id)) {
    config = createBlankConfig()
    flowName = config.label
    selectedFlowId = config.id
    isDirty = false
    return
  }
  showDeleteDialog = true
}

function handleDeleteCurrent() {
  const targetId = selectedFlowId || config.id
  if (targetId) {
    deleteUserFlow(targetId)
  }
  config = createBlankConfig()
  flowName = config.label
  selectedFlowId = config.id
  isBuiltinActive = false
  isDirty = false
  showDeleteDialog = false
  buildFlowList()
  Toast.success('已删除')
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function activateCurrentFlow() {
  if (isBuiltinActive || isDirty) {
    Toast.warning(isDirty ? '请先保存当前修改' : '内置流程不能设为自定义流程')
    return
  }
  if (!selectedFlowId || !getUserFlow(selectedFlowId)) {
    Toast.warning('请先保存当前流程')
    return
  }
  setActiveCustomFlowId(selectedFlowId)
  activeFlowId = selectedFlowId
  Toast.success('已设为当前自定义流程')
}

function onFlowNameUpdate() {
  if (!isBuiltinActive) isDirty = true
}

function confirmDiscardChanges(): boolean {
  return !isDirty || window.confirm('当前流程有未保存修改，确定放弃吗？')
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))
onBeforeRouteLeave(() => confirmDiscardChanges())

// ─── Init ───
buildFlowList()
if (activeFlowId) {
  const existing = getUserFlow(activeFlowId)
  if (existing) {
    config = cloneConfig(existing)
    flowName = existing.label || '自由学习'
    isBuiltinActive = false
    selectedFlowId = activeFlowId
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
            @update:model-value="onFlowNameUpdate"
          />
          <BaseButton type="primary" @click="handleSave" :disabled="isBuiltinActive || !isDirty">
            <div class="inline-center gap-1">
              <IconFluentSave20Regular />
              保存
            </div>
          </BaseButton>
          <BaseButton
            v-if="!isBuiltinActive"
            type="primary"
            @click="activateCurrentFlow"
            :disabled="isDirty || selectedFlowId === activeFlowId"
          >
            设为当前流程
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
              :class="{ active: item.id === selectedFlowId, activated: !item.builtin && item.id === activeFlowId }"
              role="button"
              tabindex="0"
              @click="loadFlow(item.id, item.builtin)"
              @keydown.enter.space.prevent="loadFlow(item.id, item.builtin)"
            >
              <div class="flex items-center gap-1">
                <span class="flow-list-name">{{ $t(item.name) }}</span>
                <span v-if="item.builtin" class="builtin-badge">内置</span>
                <IconFluentCheckmarkCircle16Filled
                  v-else-if="item.id === activeFlowId"
                  title="当前激活流程"
                  class="active-flow-icon"
                />
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
  color: var(--color-link);
}

.flow-workspace {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  gap: 2rem;
  min-height: 42rem;
}

.flow-list-panel {
  border-right: 1px solid var(--color-input-border);
  padding-right: 1.8rem;
}

.flow-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.flow-list-item {
  min-height: 2.5rem;
  border-radius: 0.45rem;
  background: var(--color-fourth);
  color: var(--color-font-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.flow-list-item {
  gap: 0.25rem;
  text-align: center;

  &.active,
  &:hover {
    color: var(--color-link);
    box-shadow: inset 0 0 0 1px var(--color-link);
    background: rgba(22, 119, 255, 0.08);
  }

  &:focus-visible {
    outline: 2px solid var(--color-link);
    outline-offset: 2px;
  }

  &.activated:not(.active) {
    box-shadow: inset 3px 0 0 var(--color-link);
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
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
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
  background: var(--color-fifth);
  color: var(--color-main-text);
  font-size: 0.9rem;
  border: 1px solid var(--color-input-border);
}

.builtin-dup-row {
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .flow-header {
    flex-direction: column;
  }

  .flow-actions,
  .flow-name-input {
    width: 100%;
    max-width: 100%;
  }

  .flow-workspace {
    grid-template-columns: 1fr;
  }

  .flow-list-panel {
    border-right: 0;
    border-bottom: 1px solid var(--color-input-border);
    padding: 0 0 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flow-list-item {
    transition-duration: 0.01ms;
  }
}
</style>
