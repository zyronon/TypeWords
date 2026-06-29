import { onDeactivated, onMounted, onUnmounted, watch } from 'vue'
import { emitter, EventKey } from '../utils/eventBus'
import { useSettingStore } from '../stores'
import { isMobile } from '../utils'
import { Toast } from '@typewords/base'

const CODE_TO_CHAR: Record<string, string> = {
  ...Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => [`Key${c}`, c.toLowerCase()])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Digit${i}`, String(i)])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Numpad${i}`, String(i)])),
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Space: ' ',
  Backspace: 'Backspace',
}

const SHIFT_CODE_TO_CHAR: Record<string, string> = {
  Digit1: '!',
  Digit2: '@',
  Digit3: '#',
  Digit4: '$',
  Digit5: '%',
  Digit6: '^',
  Digit7: '&',
  Digit8: '*',
  Digit9: '(',
  Digit0: ')',
  Minus: '_',
  Equal: '+',
  BracketLeft: '{',
  BracketRight: '}',
  Semicolon: ':',
  Quote: '"',
  Comma: '<',
  Period: '>',
  Slash: '?',
  Backslash: '|',
}

const CHAR_TO_CODE: Record<string, string> = {}
for (const [code, char] of Object.entries(CODE_TO_CHAR)) {
  CHAR_TO_CODE[char] = code
  if (code.startsWith('Key')) {
    CHAR_TO_CODE[char.toUpperCase()] = code
  }
}
for (const [code, char] of Object.entries(SHIFT_CODE_TO_CHAR)) {
  CHAR_TO_CODE[char] = code
}

function charToCode(char: string) {
  return CHAR_TO_CODE[char] ?? ''
}

function getSelectedText() {
  return window.getSelection().toString().trim()
}

export function useWindowClick(cb: (e: PointerEvent) => void) {
  const add = () => {
    emitter.on(EventKey.closeOther, cb)
    window.addEventListener('click', cb)
  }
  onMounted(add)
  // onActivated(add)

  const remove = () => {
    window.removeEventListener('click', cb)
  }
  onUnmounted(remove)
  onDeactivated(remove)
}

export function useEventListener(type: string, listener: EventListenerOrEventListenerObject) {
  const invokeListener = (event: KeyboardEvent) => {
    if (typeof listener === 'function') {
      return (listener as EventListener)(event)
    }
    if (listener && typeof (listener as EventListenerObject).handleEvent === 'function') {
      return (listener as EventListenerObject).handleEvent(event)
    }
  }

  let cleanup: (() => void) | null = null

  const add = () => {
    //chrome上，win的事件先触发，safari上input的事件先触发
    const emitWindowsKeys = new Set()
    const emitInputKeys = new Set()
    const cleanupFns: Array<() => void> = []
    const registerCleanup = (fn: () => void) => cleanupFns.push(fn)

    const performCleanup = () => {
      while (cleanupFns.length) {
        const fn = cleanupFns.pop()
        try {
          fn()
        } catch (err) {
          console.warn('[useEventListener] cleanup error', err)
        }
      }
    }

    if (type === 'keydown') {
      const ensureMobileInput = () => {
        let input = document.querySelector('#typing-listener') as HTMLInputElement | null
        if (!input) {
          input = document.createElement('input')
          input.id = 'typing-listener'
          input.type = 'text'
          input.autofocus = true
          input.autocomplete = 'off'
          input.autocapitalize = 'off'
          input.autocorrect = false
          input.spellcheck = false
          input.tabIndex = -1
          input.setAttribute('aria-hidden', 'true')
          Object.assign(input.style, {
            position: 'fixed',
            top: '50vh',
            left: '50vw',
            opacity: '0',
            pointerEvents: 'none',
            width: '1px',
            height: '1px',
            zIndex: '-1',
            // left: '-9999px',
          })
        }
        if (!input.parentNode) {
          document.body.appendChild(input)
        }
        setTimeout(() => {
          input.focus()
        }, 100)
        return input
      }

      const hiddenInput = ensureMobileInput()
      let isComposing = false

      const createSyntheticEvent = (payload: { key: string; code?: string; keyCode: number }) => {
        const base = {
          key: payload.key,
          code: payload.code ?? '',
          keyCode: payload.keyCode,
          which: payload.keyCode,
          ctrlKey: false,
          altKey: false,
          shiftKey: false,
          metaKey: false,
          repeat: false,
          isComposing: false,
          type,
          preventDefault() {},
          stopPropagation() {},
          stopImmediatePropagation() {},
        }
        return base as unknown as KeyboardEvent
      }

      const dispatchSyntheticKey = (payload: { key: string; code?: string; keyCode: number }) => {
        invokeListener(createSyntheticEvent(payload))
      }

      const handleCompositionStart = () => {
        // console.log('handleCompositionStart',Date.now())
        isComposing = true
        Toast.warning('请切换到英文输入')
      }

      const handleCompositionEnd = (event: CompositionEvent) => {
        isComposing = false
        if (!event.data) {
          hiddenInput.value = ' '
          return
        }
        for (const char of event.data) {
          const keyCode = char === ' ' ? 32 : char.toUpperCase().charCodeAt(0)
          dispatchSyntheticKey({
            key: char,
            code: charToCode(char),
            keyCode,
          })
        }
        hiddenInput.value = ' '
      }

      const handleInput = (event: InputEvent) => {
        // console.log('handleInput',Date.now())
        if (isComposing) return
        const target = event.target as HTMLInputElement | null
        if (!target) return
        let char = ''
        let keyCode = -1
        if (event.inputType === 'deleteContentBackward') {
          char = 'Backspace'
          keyCode = 8
        }else {
          char = target?.value?.slice(-1) || (event as any).data?.slice(-1)
          keyCode = char === ' ' ? 32 : char.toUpperCase().charCodeAt(0)
        }
        if (emitWindowsKeys.has(char)) return
        // console.log('handleInput', Date.now(), emitWindowsKeys)
        emitInputKeys.add(char)
        setTimeout(() => emitInputKeys.delete(char), 30)
        dispatchSyntheticKey({ key: char, code: charToCode(char), keyCode })
        target.value = ' '
      }

      const handleFocusRequest = (event: MouseEvent | TouchEvent) => {
        const target = event.target as HTMLElement | null
        if (!target) return
        if (!window.location.pathname.includes('/practice')) return
        const typingWord = target.closest('#PracticeArea')
        if (!typingWord) return
        if (target.closest('input, textarea, select, [contenteditable="true"]')) return false
        if (!getSelectedText()) {
          window.setTimeout(() => hiddenInput.focus(), 160)
        }
      }

      const windowListener = (e: KeyboardEvent) => {
        // if (e.code in CODE_TO_CHAR && !e.ctrlKey && !e.metaKey) return
        // console.log('windowListener', Date.now(), e, CODE_TO_CHAR)
        if (e.key === 'Process') {
          // @ts-ignore
          // e.key = CODE_TO_CHAR[e.code]
          //todo 这里不能直接设置值，会报错，后续可以用合成事件优化
          return
        }
        if (emitInputKeys.has(e.key)) return
        // console.log('windowListener', Date.now(), emitInputKeys)
        invokeListener(e)
        emitWindowsKeys.add(e.key)
        setTimeout(() => emitWindowsKeys.delete(e.key), 30)
      }

      hiddenInput.addEventListener('compositionstart', handleCompositionStart)
      registerCleanup(() => hiddenInput.removeEventListener('compositionstart', handleCompositionStart))

      hiddenInput.addEventListener('compositionend', handleCompositionEnd)
      registerCleanup(() => hiddenInput.removeEventListener('compositionend', handleCompositionEnd))

      hiddenInput.addEventListener('input', handleInput, { capture: true })
      registerCleanup(() => hiddenInput.removeEventListener('input', handleInput, { capture: true }))

      window.addEventListener('click', handleFocusRequest)
      registerCleanup(() => window.removeEventListener('click', handleFocusRequest))

      window.addEventListener('touchstart', handleFocusRequest)
      registerCleanup(() => window.removeEventListener('touchstart', handleFocusRequest))

      window.addEventListener(type, windowListener, { capture: true })
      registerCleanup(() => window.removeEventListener(type, windowListener, { capture: true }))

      registerCleanup(() => hiddenInput.remove())
    } else {
      const windowListener = (event: Event) => invokeListener(event as KeyboardEvent)
      window.addEventListener(type, windowListener, { capture: true })
      registerCleanup(() => window.removeEventListener(type, windowListener, { capture: true }))
    }

    cleanup = () => {
      performCleanup()
      cleanup = null
    }
  }
  onMounted(add)

  const remove = () => {
    if (cleanup) cleanup()
  }

  onUnmounted(remove)
  onDeactivated(remove)
}

export function getShortcutKey(e: KeyboardEvent) {
  let shortcutKey = ''
  if (e.ctrlKey || e.metaKey) shortcutKey += 'Ctrl+'
  if (e.altKey) shortcutKey += 'Alt+'
  if (e.shiftKey) shortcutKey += 'Shift+'
  if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') {
    if (e.keyCode >= 65 && e.keyCode <= 90) {
      shortcutKey += e.key.toUpperCase()
    } else {
      if (e.key === 'ArrowRight') {
        shortcutKey += '➡'
      } else if (e.key === 'ArrowLeft') {
        shortcutKey += '⬅'
      } else if (e.key === 'ArrowUp') {
        shortcutKey += '⬆'
      } else if (e.key === 'ArrowDown') {
        shortcutKey += '⬇'
      } else {
        shortcutKey += e.key
      }
    }
  }
  shortcutKey = shortcutKey.trim()

  // console.log('key', shortcutKey)
  return shortcutKey
}

export function useStartKeyboardEventListener() {
  const settingStore = useSettingStore()

  useEventListener('keydown', (e: KeyboardEvent) => {
    // console.log('keydown', e)
    //解决无法复制、全选的问题
    if ((e.ctrlKey || e.metaKey) && ['KeyC', 'KeyA', 'KeyD'].includes(e.code)) return
    if (!window?.disableEventListener) {
      // 检查当前单词是否包含空格，如果包含，则空格键应该被视为输入
      if (e.code === 'Space') {
        // 获取当前正在输入的单词信息
        const currentWord = window.__CURRENT_WORD_INFO__

        // 如果当前单词包含空格，且下一个字符应该是空格，则将空格键视为输入
        // 或者如果当前处于输入锁定状态（等待空格输入），也将空格键视为输入
        if (
          currentWord &&
          ((currentWord.word && currentWord.word.includes(' ') && currentWord.word[currentWord.input.length] === ' ') ||
            currentWord.inputLock === true)
        ) {
          e.preventDefault()
          return emitter.emit(EventKey.onTyping, e)
        }
      }

      let shortcutKey = getShortcutKey(e)
      // console.log('shortcutKey', shortcutKey)

      let shortcutEvent = []
      for (let [k, v] of Object.entries(settingStore.shortcutKeyMap)) {
        if (v === shortcutKey) {
          // console.log('快捷键', k)
          //必须是已监听的事件，才拦截并触发
          //因为在自测时，才会监听 1234 四个键，平时如果也拦截会导致无法输入1234
          if (emitter.all.has(k) && emitter.all.get(k)?.length) {
            shortcutEvent.push(k)
          }
        }
      }
      if (shortcutEvent.length > 0) {
        e.preventDefault()
        shortcutEvent.map(s => emitter.emit(s, e))
      } else {
        //非英文模式下，输入区域的 keyCode 均为 229时，
        // 空格键始终应该被转发到onTyping函数，由它来决定是作为输入还是切换单词
        if (e.code === 'Space') {
          e.preventDefault()
          return emitter.emit(EventKey.onTyping, e)
        }

        if (
          ((e.keyCode >= 65 && e.keyCode <= 90) ||
            (e.keyCode >= 48 && e.keyCode <= 57) ||
            (e.keyCode >= 96 && e.keyCode <= 105) ||
            // 空格键已经在上面处理过了
            e.code === 'Slash' ||
            e.code === 'Quote' ||
            e.code === 'Comma' ||
            e.code === 'BracketLeft' ||
            e.code === 'BracketRight' ||
            e.code === 'Period' ||
            e.code === 'Minus' ||
            e.code === 'Equal' ||
            e.code === 'Semicolon' ||
            // || e.code === 'Backquote'
            e.keyCode === 229) &&
          //当按下功能键时，不阻止事件传播
          !e.ctrlKey &&
          !e.altKey
        ) {
          if (isMobile() && e.keyCode === 229 && e.key === 'Unidentified') {
            // 安卓软键盘在keydown阶段不会提供字符，等待input/composition事件来派发实际输入
            return
          }
          e.preventDefault()
          emitter.emit(EventKey.onTyping, e)
        } else {
          emitter.emit(EventKey.keydown, e)
        }
      }
    }
  })
  useEventListener('keyup', (e: KeyboardEvent) => {
    if (!window?.disableEventListener) {
      emitter.emit(EventKey.keyup, e)
    }
  })
}

export function useOnKeyboardEventListener(onKeyDown: (e: KeyboardEvent) => void, onKeyUp: (e: KeyboardEvent) => void) {
  const add = () => {
    emitter.on(EventKey.keydown, onKeyDown)
    emitter.on(EventKey.keyup, onKeyUp)
  }
  onMounted(add)
  // onActivated(add)

  const remove = () => {
    emitter.off(EventKey.keydown, onKeyDown)
    emitter.off(EventKey.keyup, onKeyUp)
  }
  onUnmounted(remove)
  onDeactivated(remove)
}
