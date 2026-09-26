/**
 * 死键（dead key）处理：Chromium/Gecko 在死键布局（西班牙语、国际美式等）下把
 * 死键报告为 key='Dead'。死键本身不产生字符，字符由系统组合后经隐藏输入框的
 * input 事件送进输入逻辑；紧跟死键的空格是组合终结符，会被系统消费，不是分词空格。
 */
let lastKeyDownWasDeadKey = false

/** 返回 true 表示这次空格是死键组合终结符，应吞掉；对其他键跟踪死键状态。 */
export function shouldIgnoreDeadKeyCompositionSpace(event: {
  key: string
  code: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if (event.code === 'Space' && event.key === ' ') {
    const isTerminator = lastKeyDownWasDeadKey
    lastKeyDownWasDeadKey = false
    return isTerminator
  }
  lastKeyDownWasDeadKey = event.key === 'Dead'
  return false
}

/** 复位内部状态，便于测试隔离。 */
export function resetDeadKeyCompositionState(): void {
  lastKeyDownWasDeadKey = false
}
