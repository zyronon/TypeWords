import { onMounted, onUnmounted } from 'vue'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'

const IDLE_MS = 3 * 60 * 1000

export function usePracticeWordTimer(options: {
  isFocus: () => boolean
  bumpActivity: () => void
  onIdle?: () => void
}) {
  const statStore = usePracticeStore()
  let timer: ReturnType<typeof setInterval> | null = null
  let lastKeyActivity = Date.now()

  function bumpActivity() {
    lastKeyActivity = Date.now()
    options.bumpActivity()
  }

  function start() {
    stop()
    bumpActivity()
    timer = setInterval(() => {
      if (!options.isFocus()) return
      if (statStore.timerPaused) return
      const now = Date.now()
      if (now - lastKeyActivity >= IDLE_MS) {
        statStore.pauseTimer('auto_idle')
        options.onIdle?.()
        return
      }
      statStore.spend += 1000
    }, 1000)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(start)
  onUnmounted(stop)

  return { start, stop, bumpActivity, IDLE_MS }
}
