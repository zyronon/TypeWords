import { createClient } from '@supabase/supabase-js'

/** Desktop permits hosted project origins only; keep connect-src in sync. */
export function validatedSyncUrl(value: string, desktop: boolean): string {
  if (!desktop) return value
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('桌面同步需要有效的 HTTPS Supabase 项目地址')
  }
  if (
    url.protocol !== 'https:' ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('桌面同步仅支持 https://<项目>.supabase.co，不支持自托管、代理路径或自定义域名')
  }
  return url.origin
}

export function createSyncClient(url: string, key: string, desktop: boolean): ReturnType<typeof createClient> {
  return createClient(validatedSyncUrl(url, desktop), key)
}
