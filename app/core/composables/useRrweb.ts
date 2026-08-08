import { del, get, set } from 'idb-keyval'
import { nanoid } from 'nanoid'
import { saveAs } from 'file-saver'

/** IndexedDB key：存储会话索引列表 */
const RRWEB_SESSION_INDEX_KEY = 'rrweb-session-index'

/** 每个会话最多保存的 events 条数 */
const MAX_EVENTS_PER_SESSION = 10000

/** 最多保留的历史会话数量 */
const MAX_SESSIONS = 10

export type RrwebSessionMeta = {
  /** 会话 id */
  id: string
  /** 会话开始录制时间，ISO 字符串 */
  startedAt: string
  /** 录制结束时间（停止录制时写入），ISO 字符串 */
  endedAt?: string
  /** 本次会话 events 总数 */
  eventCount: number
}

export type RrwebSession = RrwebSessionMeta & {
  events: any[]
}

/** 获取会话的 IndexedDB key */
function sessionKey(id: string) {
  return `rrweb-session-${id}`
}

/** 读取所有会话元数据索引 */
async function getSessionIndex(): Promise<RrwebSessionMeta[]> {
  const raw = await get<RrwebSessionMeta[]>(RRWEB_SESSION_INDEX_KEY)
  return Array.isArray(raw) ? raw : []
}

/** 更新索引（会自动去重、只保留最新 MAX_SESSIONS 个） */
async function updateSessionIndex(meta: RrwebSessionMeta): Promise<void> {
  const index = await getSessionIndex()
  const existingIdx = index.findIndex(s => s.id === meta.id)
  if (existingIdx !== -1) {
    index[existingIdx] = meta
  } else {
    index.push(meta)
  }

  // 超出限制时，删除最旧的会话数据
  if (index.length > MAX_SESSIONS) {
    const sorted = [...index].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    const toDelete = sorted.slice(0, index.length - MAX_SESSIONS)
    for (const old of toDelete) {
      await del(sessionKey(old.id))
    }
    const deleteIds = new Set(toDelete.map(s => s.id))
    const newIndex = index.filter(s => !deleteIds.has(s.id))
    await set(RRWEB_SESSION_INDEX_KEY, newIndex)
  } else {
    await set(RRWEB_SESSION_INDEX_KEY, index)
  }
}

/** 持久化会话数据到 IndexedDB */
async function persistSession(session: RrwebSession): Promise<void> {
  // 写入时同步 eventCount，确保存入 IDB 的对象与 events 数组长度一致
  session.eventCount = session.events.length
  await set(sessionKey(session.id), session)
  await updateSessionIndex({
    id: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    eventCount: session.events.length,
  })
}

/** 全局停止函数，避免重复录制 */
let stopFn: (() => void) | null = null
let isRecording = false

/**
 * 启动 rrweb 录制（使用 @rrweb/record）
 * - 仅在浏览器端调用
 * - 每次调用开启一个新会话，记录 startedAt 时间
 * - 当前会话 events 达到 MAX_EVENTS_PER_SESSION 后自动停止
 */
export async function startRrwebRecording(): Promise<void> {
  if (isRecording) return
  if (!import.meta.client) return

  // 动态导入 @rrweb/record，避免 SSR 报错
  const { record } = await import('@rrweb/record')

  const sessionId = nanoid()
  const startedAt = new Date().toISOString()
  const events: any[] = []

  const session: RrwebSession = {
    id: sessionId,
    startedAt,
    eventCount: 0,
    events,
  }

  isRecording = true

  stopFn =
    record({
      emit(event) {
        if (!isRecording) return

        events.push(event)

        // 每 50 条或第 1 条时写入，避免频繁 IO
        if (events.length % 50 === 0 || events.length === 1) {
          persistSession(session).catch(console.error)
        }

        // 达到上限，停止当前会话录制
        if (events.length >= MAX_EVENTS_PER_SESSION) {
          stopCurrentSession()
        }
      },
      // 采样策略：降低 mousemove/scroll 频率，减少数据量
      sampling: {
        // 不录制鼠标移动事件
        mousemove: false,
        // 不录制鼠标交互事件
        mouseInteraction: false,
        scroll: 150,
        // set the interval of media interaction event
        media: 800,
        input: 'last',
      },
    }) ?? null

  // 页面隐藏时暂停录制，重新可见时恢复
  const onVisibilityChange = () => {
    if (document.hidden) {
      // 页面失焦/切换标签：暂停录制，但保留当前会话数据不清空
      if (stopFn) {
        stopFn()
        stopFn = null
        isRecording = false
        // 确保最新数据落盘
        persistSession(session).catch(console.error)
      }
    } else {
      // 页面重新可见：在同一会话中继续录制（events 继续追加）
      if (!isRecording && events.length < MAX_EVENTS_PER_SESSION) {
        isRecording = true
        stopFn =
          record({
            emit(event) {
              if (!isRecording) return
              events.push(event)
              if (events.length % 50 === 0) {
                persistSession(session).catch(console.error)
              }
              if (events.length >= MAX_EVENTS_PER_SESSION) {
                stopCurrentSession()
                document.removeEventListener('visibilitychange', onVisibilityChange)
              }
            },
            sampling: { mousemove: 50, scroll: 150, input: 'last' },
          }) ?? null
      }
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
}

/** 停止当前录制会话 */
function stopCurrentSession(): void {
  if (stopFn) {
    stopFn()
    stopFn = null
  }
  isRecording = false
}

/**
 * 导出所有会话数据为 JSON 文件（仅当 URL 含 rrweb=1 时调用）
 */
export async function exportRrwebSessions(): Promise<void> {
  if (!import.meta.client) return

  const index = await getSessionIndex()
  if (index.length === 0) return

  const sessions: RrwebSession[] = []
  for (const meta of index) {
    const session = await get<RrwebSession>(sessionKey(meta.id))
    if (session) sessions.push(session)
  }

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `rrweb-sessions-${dateStr}.json`
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), sessions }, null, 2)], {
    type: 'application/json',
  })
  saveAs(blob, filename)
}

/**
 * 获取当前所有会话的元数据摘要（用于 UI 展示）
 */
export async function getRrwebSessionStats(): Promise<{
  sessionCount: number
  totalEventCount: number
  latestStartedAt: string | null
}> {
  const index = await getSessionIndex()
  if (index.length === 0) {
    return { sessionCount: 0, totalEventCount: 0, latestStartedAt: null }
  }
  const totalEventCount = index.reduce((sum, s) => sum + (s.eventCount ?? 0), 0)
  const sorted = [...index].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  return {
    sessionCount: index.length,
    totalEventCount,
    latestStartedAt: sorted[0]?.startedAt ?? null,
  }
}

/**
 * 删除指定会话（供回放页使用）
 */
export async function deleteRrwebSession(id: string): Promise<void> {
  await del(sessionKey(id))
  const index = await getSessionIndex()
  const newIndex = index.filter(s => s.id !== id)
  await set(RRWEB_SESSION_INDEX_KEY, newIndex)
}

/**
 * 读取所有会话（供回放页使用）
 */
export async function getAllRrwebSessions(): Promise<RrwebSession[]> {
  const index = await getSessionIndex()
  const sessions: RrwebSession[] = []
  for (const meta of index) {
    const session = await get<RrwebSession>(sessionKey(meta.id))
    if (session) sessions.push(session)
  }
  // 按时间倒序
  return sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}
