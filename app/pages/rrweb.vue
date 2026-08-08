<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { getAllRrwebSessions, deleteRrwebSession, exportRrwebSessions, type RrwebSession } from '@/core/composables/useRrweb'
import 'rrweb-player/dist/style.css'

definePageMeta({ layout: 'empty' })

const route = useRoute()

// 未携带 rrweb=1 参数，直接 403
const isAuthorized = route.query.rrweb === '1'

const sessions = ref<RrwebSession[]>([])
const selectedSessionId = ref<string | null>(null)
const playerContainer = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const exportLoading = ref(false)
const playerInstance = ref<any>(null)

// 从 IndexedDB 加载
async function loadFromIndexedDB() {
  loading.value = true
  try {
    sessions.value = await getAllRrwebSessions()
    if (sessions.value.length > 0 && !selectedSessionId.value) {
      selectedSessionId.value = sessions.value[0].id
    }
  } finally {
    loading.value = false
  }
}

// 导出所有会话
async function handleExport() {
  if (exportLoading.value) return
  exportLoading.value = true
  try {
    await exportRrwebSessions()
  } finally {
    exportLoading.value = false
  }
}

// 计算会话占用空间（JSON 序列化后的字节数）
function calcSessionSize(session: RrwebSession): string {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(session)).length
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  } catch {
    return ''
  }
}

// 从上传的 JSON 文件加载
function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target?.result as string)
      const imported: RrwebSession[] = Array.isArray(data.sessions) ? data.sessions : []
      sessions.value = imported.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
      if (sessions.value.length > 0) {
        selectedSessionId.value = sessions.value[0].id
      }
    } catch {
      alert('解析文件失败，请确认是合法的 rrweb 导出文件')
    }
  }
  reader.readAsText(file)
}

// 销毁播放器实例
function destroyPlayer() {
  if (playerInstance.value) {
    try { playerInstance.value.$destroy() } catch {}
    playerInstance.value = null
  }
  if (playerContainer.value) {
    playerContainer.value.innerHTML = ''
  }
}

// 开始回放选中的会话
async function startReplay() {
  if (!playerContainer.value || !selectedSessionId.value) return

  const session = sessions.value.find(s => s.id === selectedSessionId.value)
  if (!session || !session.events.length) {
    alert('该会话没有录制数据')
    return
  }

  destroyPlayer()

  // 等 DOM 清空后再初始化播放器
  await nextTick()

  const RrwebPlayer = (await import('rrweb-player')).default

  const containerW = playerContainer.value.clientWidth
  const containerH = playerContainer.value.clientHeight

  playerInstance.value = new RrwebPlayer({
    target: playerContainer.value,
    props: {
      events: session.events,
      width: containerW,
      height: containerH - 80, // 留出底部控制栏高度
    //   autoPlay: true,
    //   showController: true,
    //   skipInactive: true,
    },
  })
}

// 删除指定会话
async function removeSession(id: string) {
  await deleteRrwebSession(id)
  sessions.value = sessions.value.filter(s => s.id !== id)
  if (selectedSessionId.value === id) {
    selectedSessionId.value = sessions.value[0]?.id ?? null
    destroyPlayer()
  }
}

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleString('zh-CN')
}

onMounted(() => {
  if (isAuthorized) loadFromIndexedDB()
})

onBeforeUnmount(() => {
  destroyPlayer()
})
</script>

<template>
  <!-- 未授权 -->
  <div v-if="!isAuthorized" class="forbidden">
    403 Forbidden
  </div>

  <div v-else class="rrweb-replay-page">
    <!-- 左侧边栏 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>rrweb 回放</h2>
        <button class="export-btn" @click="handleExport" :disabled="exportLoading">
          {{ exportLoading ? '导出中…' : '⬇ 导出所有会话' }}
        </button>
      </div>

      <!-- 从文件导入 -->
      <div class="section">
        <div class="section-title">从文件导入</div>
        <label class="upload-btn">
          <input type="file" accept="application/json,.json" @change="handleFileUpload" />
          选择 JSON 文件
        </label>
      </div>

      <!-- 本地 IndexedDB 会话 -->
      <div class="section">
        <div class="section-title">
          本地会话
          <button class="refresh-btn" @click="loadFromIndexedDB" :disabled="loading">
            {{ loading ? '加载中…' : '刷新' }}
          </button>
        </div>
        <div v-if="!sessions.length" class="empty-tip">暂无会话数据</div>
        <div v-else class="session-list">
          <div
            v-for="s in sessions"
            :key="s.id"
            class="session-item"
            :class="{ active: selectedSessionId === s.id }"
            @click="selectedSessionId = s.id"
          >
            <div class="session-item-body">
              <div class="session-date">{{ formatDate(s.startedAt) }}</div>
              <div class="session-meta">
                {{ s.eventCount ?? s.events?.length ?? 0 }} 条
                <span v-if="s.events?.length" class="session-size">· {{ calcSessionSize(s) }}</span>
              </div>
            </div>
            <button class="delete-btn" title="删除" @click.stop="removeSession(s.id)">✕</button>
          </div>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="bottom-actions">
        <button
          class="play-btn"
          @click="startReplay"
          :disabled="!selectedSessionId"
        >▶ 开始回放</button>
      </div>
    </div>

    <!-- 回放区域 -->
    <div class="replay-area">
      <div v-if="!playerInstance" class="placeholder">
        选择左侧会话后点击「开始回放」
      </div>
      <div ref="playerContainer" class="player-container"></div>
    </div>
  </div>
</template>

<style scoped>
.forbidden {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: #888;
}

.rrweb-replay-page {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 14px;
}

/* ── 侧边栏 ── */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #2d2d4e;
  padding: 1rem;
  gap: 1rem;
  overflow-y: auto;
}

.sidebar-header h2 {
  font-size: 1.1rem;
  font-weight: bold;
  color: #a78bfa;
}

.subtitle {
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.1rem;
}

.export-btn {
  margin-top: 0.6rem;
  width: 100%;
  padding: 0.4rem 0.8rem;
  background: #2d2d4e;
  border: 1px solid #444;
  border-radius: 6px;
  color: #ccc;
  font-size: 0.82rem;
  cursor: pointer;
  text-align: center;
}
.export-btn:hover:not(:disabled) { background: #3d3d6e; color: #fff; }
.export-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #666;
  letter-spacing: 0.05em;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-btn {
  display: block;
  padding: 0.4rem 0.8rem;
  background: #2d2d4e;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #444;
  font-size: 0.85rem;
  text-align: center;
}
.upload-btn:hover { background: #3d3d6e; }
.upload-btn input { display: none; }

.refresh-btn {
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  background: #2d2d4e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
}
.refresh-btn:hover:not(:disabled) { background: #3d3d6e; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-tip {
  font-size: 0.8rem;
  color: #555;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 340px;
  overflow-y: auto;
}

.session-item {
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.session-item:hover { background: #2d2d4e; }
.session-item.active { background: #2d2d4e; border-color: #a78bfa; }

.session-item-body { flex: 1; min-width: 0; }
.session-date { font-size: 0.82rem; color: #ccc; }
.session-meta { font-size: 0.75rem; color: #666; margin-top: 0.1rem; }
.session-size { color: #555; }

.delete-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #555;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 0;
}
.session-item:hover .delete-btn { opacity: 1; }
.delete-btn:hover { background: #5f1a1a; border-color: #c0392b; color: #ff6b6b; }

/* ── 底部操作区 ── */
.bottom-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.play-btn {
  width: 100%;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: bold;
  background: #7c3aed;
  color: white;
}
.play-btn:hover:not(:disabled) { background: #6d28d9; }
.play-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── 回放区域 ── */
.replay-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #444;
  font-size: 1rem;
  pointer-events: none;
}

.player-container {
  width: 100%;
  height: 100%;
}

/* 覆盖 rrweb-player 默认样式以适应深色主题 */
:deep(.rr-player) {
  width: 100% !important;
  height: 100% !important;
  background: #111 !important;
}

:deep(.rr-player__frame) {
  width: 100% !important;
  height: calc(100% - 80px) !important;
}

:deep(.rr-controller) {
  background: #1e1e3a !important;
  border-top: 1px solid #2d2d4e !important;
}

:deep(.rr-progress__step) {
  background: #7c3aed !important;
}

:deep(.rr-controller__btns button) {
  color: #ccc !important;
}
</style>
