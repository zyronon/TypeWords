import { installDesktopLinks } from '@/core/platform/desktop'
import { Toast } from '@/base'

export default defineNuxtPlugin(() => {
  if (!useRuntimeConfig().public.isDesktop) return
  const dispose = installDesktopLinks(window, document, undefined, error => {
    Toast.error(error instanceof Error ? error.message : '打开外部链接失败')
  })
  if (import.meta.hot) import.meta.hot.dispose(dispose)
})
