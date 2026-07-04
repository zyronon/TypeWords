/**
 * usePracticeIdleTimer — 空闲检测 composable
 *
 * 从 [id].vue 提取，负责：
 * - 记录最后一次键盘/鼠标活动时间
 * - 3 分钟无操作自动暂停计时
 * - 恢复计时逻辑 + Toast 提示
 */
import { ref } from 'vue'
import type { Ref } from 'vue'
import { Toast } from '@typewords/base'

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
}) {
  const { isFocus, statStore } = options
  const IDLE_MS = options.IDLE_MS ?? 3 * 60 * 1000

  let lastKeyActivity = Date.now()
  let timer: ReturnType<typeof setInterval> | null = null

  /** 标记活动，由外部键盘/鼠标事件调用 */
  function bumpActivity() {
    lastKeyActivity = Date.now()
  }

  /** 恢复计时 + Toast 提示 */
  function handleResumeTimer() {
    if (!isFocus.value) return
    if (statStore.timerPaused) {
      statStore.resumeTimer()
      Toast.success('已恢复计时')
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
