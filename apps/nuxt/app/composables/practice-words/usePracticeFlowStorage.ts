/**
 * 用户自定义练习流程存储层。
 *
 * 独立 key `PracticeFlowV2` 存储用户创建的多份流程预设。
 * 与系统内置 BUILTIN_FLOWS 隔离，互不影响。
 *
 * 存储结构：
 * {
 *   activeId: string,          // 当前激活的自定义流程 id
 *   flows: Record<string, {    // 多份命名预设
 *     config: PracticeFlowConfig,
 *     name: string,            // 用户自定义名称（如「晨读流程」）
 *     createdAt: number,
 *     updatedAt: number,
 *   }>
 * }
 */
import type { PracticeFlowConfig } from './registry-types.ts'

const STORAGE_KEY = 'PracticeFlowV2'

export interface UserFlowEntry {
  config: PracticeFlowConfig
  name: string
  createdAt: number
  updatedAt: number
}

export interface PracticeFlowStorageData {
  activeId: string
  flows: Record<string, UserFlowEntry>
}

function getStorage(): PracticeFlowStorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // corrupted data, reset
  }
  return { activeId: '', flows: {} }
}

function setStorage(data: PracticeFlowStorageData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** 列出所有用户流程 */
export function listUserFlows(): { id: string; name: string; updatedAt: number }[] {
  const { flows } = getStorage()
  return Object.entries(flows)
    .map(([id, entry]) => ({ id, name: entry.name, updatedAt: entry.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 按 id 获取单个用户流程配置 */
export function getUserFlow(flowId: string): PracticeFlowConfig | null {
  const { flows } = getStorage()
  return flows[flowId]?.config ?? null
}

/** 获取当前激活的自定义流程 id */
export function getActiveCustomFlowId(): string {
  return getStorage().activeId
}

/** 设置当前激活的自定义流程 id */
export function setActiveCustomFlowId(id: string) {
  const data = getStorage()
  data.activeId = id
  setStorage(data)
}

/** 保存（创建/更新）一条用户流程 */
export function saveUserFlow(id: string, config: PracticeFlowConfig, name: string) {
  const data = getStorage()
  const now = Date.now()
  const existing = data.flows[id]
  data.flows[id] = {
    config,
    name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  if (!data.activeId) data.activeId = id
  setStorage(data)
}

/** 删除一条用户流程 */
export function deleteUserFlow(id: string) {
  const data = getStorage()
  delete data.flows[id]
  if (data.activeId === id) {
    data.activeId = Object.keys(data.flows)[0] ?? ''
  }
  setStorage(data)
}

/** 加载当前激活的自定义流程配置（供 loadPracticeFlow 使用） */
export function loadCustomFlow(): PracticeFlowConfig | null {
  const { activeId, flows } = getStorage()
  if (!activeId) return null
  return flows[activeId]?.config ?? null
}
