/**
 * usePracticeIdleTimer — 空闲检测 composable
 *
 * 从 [id].vue 提取，负责：
 * - 记录最后一次键盘/鼠标活动时间
 * - 3 分钟无操作自动暂停计时
 * - 恢复计时逻辑 + 宿主通知
 */
import type { Ref } from 'vue'
import type { PracticeNotifier } from './practice-flow-types.ts'

const TIMER_DRIFT_TOLERANCE_MS = 2000

type TimerSegment = [number, number]

export function getIdlePauseTime(lastActivity: number, now: number, idleMs: number): number {
  return Math.min(now, lastActivity + idleMs)
}

function splitSegmentByDay([start, end]: TimerSegment): TimerSegment[] {
  const result: TimerSegment[] = []
  let cursor = start
  while (cursor < end) {
    const nextDay = new Date(cursor)
    nextDay.setHours(24, 0, 0, 0)
    const partEnd = Math.min(end, nextDay.getTime())
    result.push([cursor, partEnd])
    cursor = partEnd
  }
  return result
}

/**
 * 清理恢复缓存或运行中产生的异常时间片段。
 * spend 使用 interval 累计，不会在系统休眠时跳增，因此可作为片段总时长的安全上限。
 */
export function normalizePracticeTimer(
  segments: TimerSegment[],
  spend: number,
  now = Date.now()
): { segments: TimerSegment[]; spend: number } {
  const valid = segments
    .filter(segment => Array.isArray(segment) && segment.length === 2)
    .map(([start, end]) => [Number(start), Math.min(Number(end), now)] as TimerSegment)
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start)
    .sort((a, b) => a[0] - b[0])

  const merged: TimerSegment[] = []
  for (const [start, end] of valid) {
    const previous = merged[merged.length - 1]
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end)
    } else {
      merged.push([start, end])
    }
  }

  const safeSpend = Number.isFinite(spend) ? Math.max(0, spend) : 0
  const total = merged.reduce((sum, [start, end]) => sum + end - start, 0)
  const maxTotal = safeSpend + TIMER_DRIFT_TOLERANCE_MS

  // 片段总长远大于 interval 累计值时，优先从最长片段中移除异常时间。
  // 典型场景是电脑休眠后才触发 idle 检测，单个片段被拉长数十小时。
  let excess = Math.max(0, total - maxTotal)
  while (excess > 0 && merged.length > 0) {
    let longestIndex = 0
    for (let i = 1; i < merged.length; i++) {
      if (merged[i][1] - merged[i][0] > merged[longestIndex][1] - merged[longestIndex][0]) {
        longestIndex = i
      }
    }
    const segment = merged[longestIndex]
    const duration = segment[1] - segment[0]
    const reduction = Math.min(excess, duration)
    segment[1] -= reduction
    excess -= reduction
    if (segment[1] <= segment[0]) merged.splice(longestIndex, 1)
  }

  const normalizedSegments = merged.flatMap(splitSegmentByDay)
  if (normalizedSegments.length === 0) {
    return { segments: [], spend: safeSpend }
  }
  const normalizedSpend = normalizedSegments.reduce((sum, [start, end]) => sum + end - start, 0)
  return { segments: normalizedSegments, spend: normalizedSpend }
}

export function canAutoResumeVisibilityTimer(timer: {
  timerPaused: boolean
  timerPauseReason: string | null
}) {
  return timer.timerPaused && timer.timerPauseReason === 'auto_visibility'
}

export function usePracticeIdleTimer(options: {
  isFocus: Ref<boolean>
  statStore: {
    timerPaused: boolean
    timerPauseReason: string
    resumeTimer: () => void
    pauseTimer: (reason: 'auto_idle' | 'auto_visibility' | 'manual') => void
    spend: number
    segments: Array<[number, number]>
  }
  /** 空闲超时，默认 3 分钟 */
  IDLE_MS?: number
  notify?: PracticeNotifier
}) {
  const { isFocus, statStore } = options
  const IDLE_MS = options.IDLE_MS ?? 3 * 60 * 1000

  let lastKeyActivity = Date.now()
  let timer: ReturnType<typeof setInterval> | null = null

  /** 标记活动，由外部键盘/鼠标事件调用 */
  function bumpActivity() {
    lastKeyActivity = Date.now()
  }

  /** 恢复计时 + 宿主通知 */
  function handleResumeTimer() {
    if (!isFocus.value) return
    if (statStore.timerPaused) {
      statStore.resumeTimer()
      options.notify?.('success', '已恢复计时')
    }
    bumpActivity()
  }

  /** 启动空闲检测定时器 */
  function startTimer() {
    stopTimer()
    bumpActivity()
    timer = setInterval(() => {
      if (!isFocus.value) return
      if (statStore.timerPaused) return

      const now = Date.now()
      if (now - lastKeyActivity >= IDLE_MS) {
        statStore.pauseTimer('auto_idle')
        const segment = statStore.segments[statStore.segments.length - 1]
        if (segment) {
          segment[1] = Math.max(segment[0], getIdlePauseTime(lastKeyActivity, now, IDLE_MS))
        }
        return
      }
      statStore.spend += 1000
    }, 1000)
  }

  /** 停止空闲检测定时器 */
  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  return {
    bumpActivity,
    handleResumeTimer,
    startTimer,
    stopTimer,
  }
}
