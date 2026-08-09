import { createVNode, render } from 'vue'
import ToastComponent from './ToastComponent.vue'
import type { ToastOptions, ToastInstance, ToastService } from './type.ts'

interface ToastContainer {
  id: string
  container: HTMLElement
  instance: ToastInstance
  offset: number
}

let toastContainers: ToastContainer[] = []
let toastIdCounter = 0

// 创建Toast容器
const createToastContainer = (): HTMLElement => {
  const container = document.createElement('div')
  container.className = 'toast-container'
  container.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    pointer-events: none;
  `
  return container
}

// 更新所有Toast的位置
const updateToastPositions = () => {
  toastContainers.forEach((toastContainer, index) => {
    const offset = index * 70 // 每个Toast之间的间距，从80px减少到50px
    toastContainer.offset = offset
    toastContainer.container.style.marginTop = `${offset}px`
  })
}

// 移除Toast容器
const removeToastContainer = (id: string) => {
  const index = toastContainers.findIndex(container => container.id === id)
  if (index > -1) {
    const container = toastContainers[index]
    // 延迟销毁，等待动画完成
    setTimeout(() => {
      render(null, container!.container)
      container!.container.remove()
      const currentIndex = toastContainers.findIndex(c => c.id === id)
      if (currentIndex > -1) {
        toastContainers.splice(currentIndex, 1)
        updateToastPositions()
      }
    }, 300) // 等待动画完成（0.3秒）
  }
}

const Toast: ToastService = (options: ToastOptions | string): ToastInstance => {
  const toastOptions = typeof options === 'string' ? { message: options } : options
  const id = `toast-${++toastIdCounter}`

  // 创建Toast容器
  const container = createToastContainer()
  document.body.appendChild(container)

  // 创建VNode
  const vnode = createVNode(ToastComponent, {
    ...toastOptions,
    onClose: () => {
      removeToastContainer(id)
    },
  })

  // 渲染到容器
  render(vnode, container)

  // 创建实例
  const instance: ToastInstance = {
    close: () => {
      vnode.component?.exposed?.close?.()
    },
  }

  // 添加到容器列表
  const toastContainer: ToastContainer = {
    id,
    container,
    instance,
    offset: 0,
  }

  toastContainers.push(toastContainer)
  updateToastPositions()

  return instance
}

// 添加类型方法
Toast.success = (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => {
  return Toast({ message, type: 'success', ...options })
}

Toast.warning = (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => {
  return Toast({ message, type: 'warning', ...options })
}

Toast.info = (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => {
  return Toast({ message, type: 'info', ...options })
}

Toast.error = (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => {
  return Toast({ message, type: 'error', ...options })
}

// 关闭所有消息
Toast.closeAll = () => {
  toastContainers.forEach(container => container.instance.close())
  toastContainers = []
}

export default Toast
