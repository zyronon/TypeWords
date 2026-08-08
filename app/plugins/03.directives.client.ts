import { createApp } from 'vue'
import { Loading } from '@/base'

export default defineNuxtPlugin(nuxtApp => {
  // v-opacity: 根据布尔值控制透明度
  nuxtApp.vueApp.directive('opacity', {
    mounted(el: HTMLElement, binding: any) {
      if (binding.arg === undefined || binding.arg !== 'noAnim') {
        el.classList.add('anim')
      }
      el.style.opacity = binding?.value ? '1' : '0'
    },
    updated(el: HTMLElement, binding: any) {
      el.style.opacity = binding?.value ? '1' : '0'
    },
  })

  // v-loading: 为元素添加/移除遮罩层（使用 Vue 组件）
  type ElWithMask = HTMLElement & { __loadingRoot?: HTMLDivElement; __loadingApp?: any }

  nuxtApp.vueApp.directive('loading', {
    mounted(el: ElWithMask, binding: any) {
      const position = getComputedStyle(el).position
      if (position === 'static' || !position) el.style.position = 'relative'

      const root = document.createElement('div')
      const app = createApp(Loading)
      app.mount(root)
      el.__loadingRoot = root
      el.__loadingApp = app
      if (binding?.value) el.appendChild(root)
    },
    updated(el: ElWithMask, binding: any) {
      const root = el.__loadingRoot
      const hasMask = root && root.parentNode === el
      if (binding?.value && !hasMask && root) el.appendChild(root)
      else if (!binding?.value && hasMask && root) el.removeChild(root)
    },
    unmounted(el: ElWithMask) {
      const root = el.__loadingRoot
      const app = el.__loadingApp
      if (app) app.unmount()
      if (root && root.parentNode === el) el.removeChild(root)
      delete el.__loadingRoot
      delete el.__loadingApp
    },
  })
})
