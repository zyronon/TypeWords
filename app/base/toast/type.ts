export type ToastType = 'success' | 'warning' | 'info' | 'error'

export interface ToastAction {
  text: string
  onClick?: () => void
}

export interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number
  showClose?: boolean
  action?: ToastAction
}

export interface ToastInstance {
  close: () => void
}

export interface ToastService {
  (options: ToastOptions | string): ToastInstance

  success(message: string, options?: Omit<ToastOptions, 'message' | 'type'>): ToastInstance

  warning(message: string, options?: Omit<ToastOptions, 'message' | 'type'>): ToastInstance

  info(message: string, options?: Omit<ToastOptions, 'message' | 'type'>): ToastInstance

  error(message: string, options?: Omit<ToastOptions, 'message' | 'type'>): ToastInstance

  closeAll(): void
}
