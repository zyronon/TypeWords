import { createVNode, render } from 'vue'
import type { ModalProps } from '@/base'
import { Dialog } from '@/base'

export class MessageBox {
  static confirm(
    content: string,
    title: string,
    onOk: () => any = () => void 0,
    onCancel: () => any = () => void 0,
    onClose: () => any = () => void 0,
    config: ModalProps = {}
  ) {
    let container = document.createElement('div')
    const close = () => {
      render(null, container)
      container.remove()
      onClose?.()
    }
    const vNode = createVNode(Dialog, {
      title,
      content,
      onCancel: onCancel,
      confirm: onOk,
      onClose: close,
      footer: true,
      ...config,
    })
    // const appContext = getCurrentInstance()?.appContext;
    // // 补丁：Component中获取当前组件树的provides
    // if (appContext) {
    //     const currentProvides = (getCurrentInstance() as any)?.provides;
    //     Reflect.set(appContext, 'provides', {...appContext.provides, ...currentProvides});
    // }
    // vNode.appContext = appContext;
    render(vNode, container)
    document.body.append(container)
  }

  static notice(content: string, title: string, config: ModalProps = {}) {
    let container = document.createElement('div')
    let tempOnCancel = () => {
      render(null, container)
      container.remove()
    }
    const vNode = createVNode(Dialog, {
      title,
      content,
      onCancel: tempOnCancel,
      ...config,
    })
    // const appContext = getCurrentInstance()?.appContext;
    // // 补丁：Component中获取当前组件树的provides
    // if (appContext) {
    //     const currentProvides = (getCurrentInstance() as any)?.provides;
    //     Reflect.set(appContext, 'provides', {...appContext.provides, ...currentProvides});
    // }
    // vNode.appContext = appContext;
    render(vNode, container)
    document.body.append(container)
  }
}
