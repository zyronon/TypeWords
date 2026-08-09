export type ModalEntry = { id: string | number; close: () => any }

/**
 * 全局唯一弹窗栈：
 * - 即使 Dialog.vue 被热更新或存在多处导入，也尽量复用同一份栈
 * - 避免把“实例状态”放在 SFC 模块作用域里导致多份初始化
 */
const g = globalThis as any
const KEY = '__typewords_modalStack__'

if (!g[KEY]) g[KEY] = []

export const modalStack: ModalEntry[] = g[KEY]

