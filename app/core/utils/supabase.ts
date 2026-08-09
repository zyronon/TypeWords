import { createClient } from '@supabase/supabase-js'
import { Toast } from '@/base'
import { useRuntimeStore } from '../stores'

export const SUPABASE_CONFIG_KEY = 'supabase_config'

export type SupabaseStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface SupabaseConfig {
  url: string
  key: string
  status: SupabaseStatus
  statusMessage?: string
}

const defaultConfig: SupabaseConfig = {
  url: '',
  key: '',
  status: 'idle',
}

export function getConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Partial<SupabaseConfig>
    if (!c || !c.url || !c.key) return null
    return {
      url: c.url,
      key: c.key,
      status: c.status ?? 'idle',
      statusMessage: c.statusMessage,
    }
  } catch {
    return null
  }
}

export function setConfig(partial: Partial<SupabaseConfig>): void {
  const cur = getConfig() ?? defaultConfig
  const next: SupabaseConfig = {
    url: partial.url ?? cur.url,
    key: partial.key ?? cur.key,
    status: partial.status ?? cur.status,
    statusMessage: partial.statusMessage !== undefined ? partial.statusMessage : cur.statusMessage,
  }
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(next))
}

export class Supabase {
  static instance: ReturnType<typeof createClient> | null = null
  static supabaseUrl = ''
  static supabaseKey = ''
  static errorCount = 0

  /** 是否允许执行同步：仅当 config 存在、url/key 有值且 status === 'success' 时返回 true */
  static check(): boolean {
    const c = getConfig()
    if (!c?.url || !c?.key) return false
    if (c.status !== 'success') return false
    this.supabaseUrl = c.url
    this.supabaseKey = c.key
    return true
  }

  static saveConfig(url: string, key: string): void {
    setConfig({ url, key })
  }

  static removeConfig(): void {
    localStorage.removeItem(SUPABASE_CONFIG_KEY)
  }

  /** 拿到客户端；仅根据 url/key 建连，不依赖 status（供设置页保存配置时验表使用） */
  static getInstance(): ReturnType<typeof createClient> {
    if (!Supabase.instance) {
      const c = getConfig()
      if (c?.url && c?.key) {
        this.supabaseUrl = c.url
        this.supabaseKey = c.key
        try {
          Supabase.instance = createClient(this.supabaseUrl, this.supabaseKey)
        } catch (e) {
          Toast.error((e as Error).message)
          Supabase.instance = {
            from: () => ({
              select: () => Promise.resolve({ data: [] }),
              upsert: () => Promise.resolve({ data: [] }),
              insert: () => Promise.resolve({ data: [] }),
            }),
          } as unknown as ReturnType<typeof createClient>
        }
      } else {
        Supabase.instance = {
          from: () => ({
            select: () => Promise.resolve({ data: [] }),
            upsert: () => Promise.resolve({ data: [] }),
            insert: () => Promise.resolve({ data: [] }),
          }),
        } as unknown as ReturnType<typeof createClient>
      }
    }
    return Supabase.instance as ReturnType<typeof createClient>
  }

  static getConfig(): SupabaseConfig | null {
    return getConfig()
  }

  static getStatus(): { status: SupabaseStatus; statusMessage?: string } {
    const c = getConfig()
    return {
      status: c?.status ?? 'idle',
      statusMessage: c?.statusMessage,
    }
  }

  static setStatus(status: SupabaseStatus, statusMessage?: string): void {
    if (status === 'error') {
      // debugger
      //如果是请求错误，则可重试3次再报错，因为会有很多误判
      if ('TypeError: Failed to fetch' === statusMessage && this.errorCount < 3) {
        this.errorCount++
        return
      }
      window?.umami?.track('sp-error', { error: statusMessage })
    }
    if (status !== 'error') {
      this.errorCount = 0
    }
    const runtimeStore = useRuntimeStore()
    runtimeStore.isError = status === 'error'
    setConfig({ status, statusMessage })
  }
}
