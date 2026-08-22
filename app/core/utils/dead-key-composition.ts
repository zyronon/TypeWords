/**
 * 死键（dead key）组合处理 —— 兼容两种浏览器事件模型，自适应客户端键盘布局
 *
 * 西班牙语、国际美式等布局把 ' 等键作为重音死键：单独按下不产生字符，必须再按
 * 一个"组合终结符"（通常是空格）才会把死键落成实际字符（如 '），这枚组合空格
 * 会被系统消费，不是真正的分词空格。
 *
 * 浏览器对死键的 keydown 报告有两种模型，这里同时兼容：
 * 1. key='Dead'（Chromium/Gecko 常见）：死键本身不产生字符，字符由系统组合后
 *    经隐藏输入框的 input 事件送入，直接丢弃该 keydown 即可。
 * 2. 把死键报成基础字符（如 '，部分环境）：keydown 看似普通按键，但实际没有
 *    插入任何字符。用隐藏输入框是否产生 input 事件作为"字符是否真的落盘"的
 *    依据：撇号类键按下后如果没有字符落盘，下一个空格就是组合终结符。
 *
 * 普通英文布局不受影响：' 是真实按键，按下后立即产生 input 事件，状态随即复位，
 * 后面的空格照常作为分词空格处理。
 */

/** 浏览器明确报告的死键（模型 1）。 */
export function isDeadKeyEvent(event: { key: string }): boolean {
  return event.key === 'Dead'
}

/** 可能以基础字符形式报告的死键：撇号/双引号死键（模型 2 需要监听）。 */
function isApostropheDeadKeyCandidate(event: { key: string; code: string }): boolean {
  return event.code === 'Quote' && (event.key === "'" || event.key === '"')
}

export function isSpaceKeydownEvent(event: {
  key: string
  code: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  return event.code === 'Space' && event.key === ' '
}

let lastKeyDownWasDeadKey = false
let pendingQuoteComposition = false

/**
 * 跟踪 keydown 序列（对每个 keydown 调用一次）。
 *
 * 返回 true 表示这次空格是死键组合终结符，应当被吞掉，不交给输入逻辑处理；
 * 返回 false 则正常分发。吞掉后内部状态随之复位，不影响后续输入。
 */
export function shouldIgnoreDeadKeyCompositionSpace(event: {
  key: string
  code: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}): boolean {
  if (isSpaceKeydownEvent(event)) {
    if (lastKeyDownWasDeadKey || pendingQuoteComposition) {
      lastKeyDownWasDeadKey = false
      pendingQuoteComposition = false
      return true
    }
    return false
  }
  if (isDeadKeyEvent(event)) {
    lastKeyDownWasDeadKey = true
    pendingQuoteComposition = false
    return false
  }
  lastKeyDownWasDeadKey = false
  // 模型 2：撇号类按键进入"待组合"状态，直到真实字符落盘或下一个按键到来
  pendingQuoteComposition = isApostropheDeadKeyCandidate(event)
  return false
}

/**
 * 系统向隐藏输入框真实写入了一个字符时调用（input / compositionend 事件）。
 * 复位待组合状态：字符已经落盘，说明前面的按键是真实按键而非死键。
 */
export function confirmCharacterInserted(): void {
  pendingQuoteComposition = false
}

/** 复位内部状态，便于测试隔离。 */
export function resetDeadKeyCompositionState(): void {
  lastKeyDownWasDeadKey = false
  pendingQuoteComposition = false
}