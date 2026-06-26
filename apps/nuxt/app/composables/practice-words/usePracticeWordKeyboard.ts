import { onMounted, onUnmounted } from 'vue'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { getShortcutKey } from '@typewords/core/hooks/event.ts'

/**
 * v2 练习页键盘：Space 始终优先走 onTyping，不依赖 __CURRENT_WORD_INFO__。
 */
export function usePracticeWordKeyboard() {
  const settingStore = useSettingStore()

  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && ['KeyC', 'KeyA', 'KeyD'].includes(e.code)) return
    if (window?.disableEventListener) return

    if (e.code === 'Space') {
      e.preventDefault()
      return emitter.emit(EventKey.onTyping, e)
    }

    const shortcutKey = getShortcutKey(e)
    const shortcutEvent: string[] = []
    for (const [k, v] of Object.entries(settingStore.shortcutKeyMap)) {
      if (v === shortcutKey && emitter.all.has(k) && emitter.all.get(k)?.length) {
        shortcutEvent.push(k)
      }
    }

    if (shortcutEvent.length > 0) {
      e.preventDefault()
      shortcutEvent.forEach(s => emitter.emit(s, e))
      return
    }

    if (
      ((e.keyCode >= 65 && e.keyCode <= 90) ||
        (e.keyCode >= 48 && e.keyCode <= 57) ||
        (e.keyCode >= 96 && e.keyCode <= 105) ||
        e.code === 'Slash' ||
        e.code === 'Quote' ||
        e.code === 'Comma' ||
        e.code === 'BracketLeft' ||
        e.code === 'BracketRight' ||
        e.code === 'Period' ||
        e.code === 'Minus' ||
        e.code === 'Equal' ||
        e.code === 'Semicolon' ||
        e.code === 'Backquote') &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault()
      emitter.emit(EventKey.onTyping, e)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown, { capture: true })
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown, { capture: true })
  })
}
