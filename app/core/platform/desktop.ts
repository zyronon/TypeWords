/** Save through a native picker only on Desktop; Web retains file-saver. */
export async function saveBackup(content: Blob, fileName: string, desktop: boolean): Promise<boolean> {
  if (!desktop) {
    const { default: saveAs } = await import('file-saver')
    saveAs(content, fileName)
    return true
  }
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({
    defaultPath: fileName,
    filters: [{ name: 'TypeWords backup', extensions: ['zip'] }],
  })
  if (path === null) return false
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  await writeFile(path, new Uint8Array(await content.arrayBuffer()))
  return true
}

// Existing product destinations only. Keep native capability scope in sync.
export const EXTERNAL_HOSTS = [
  'github.com',
  'typewords.cc',
  '2study.top',
  'enpuz.com',
  'www.youdao.com',
  'v.wjx.cn',
  'www.google.cn',
  'chromewebstore.google.com',
  'microsoftedge.microsoft.com',
  'supabase.com',
  'www.kdocs.cn',
  'x.com',
  'pan.quark.cn',
  'v.v8l.cn',
] as const

// Product About/feedback mailbox only. Keep native capability scope in sync.
export const EXTERNAL_MAILS = ['zyronon@163.com'] as const

function mailtoAddress(url: URL): string {
  const raw = decodeURIComponent((url.pathname || url.href.replace(/^mailto:/i, '')).replace(/^\//, ''))
  return raw.split('?')[0]
}

export function validatedExternalUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol === 'mailto:') {
    const address = mailtoAddress(url)
    if (url.username || url.password || url.port || url.search || url.hash) {
      throw new Error('桌面版已阻止不受信任的外部链接')
    }
    if (!(EXTERNAL_MAILS as readonly string[]).includes(address)) {
      throw new Error('桌面版已阻止不受信任的外部链接')
    }
    return `mailto:${address}`
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !(EXTERNAL_HOSTS as readonly string[]).includes(url.hostname)
  ) {
    throw new Error('桌面版已阻止不受信任的外部链接')
  }
  return url.href
}

export async function openExternal(value: string): Promise<void> {
  const url = validatedExternalUrl(value)
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(url)
}

/** Desktop-only interception; the native host independently denies remote navigation/popups. */
export function installDesktopLinks(
  win: Window,
  doc: Document,
  open: (url: string) => Promise<void> = openExternal,
  onError: (error: unknown) => void = console.error
): () => void {
  const originalOpen = win.open
  const navigate = (value: string) => {
    try {
      const url = new URL(value, win.location.href)
      if (url.origin === win.location.origin && url.protocol === win.location.protocol) {
        win.location.assign(url.href)
      } else {
        void open(validatedExternalUrl(url.href)).catch(onError)
      }
    } catch (error) {
      onError(error)
    }
  }
  win.open = ((url?: string | URL) => {
    if (url) navigate(String(url))
    return null
  }) as typeof win.open
  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!anchor) return
    const url = new URL(anchor.href, win.location.href)
    if (url.origin === win.location.origin && url.protocol === win.location.protocol) return
    event.preventDefault()
    event.stopImmediatePropagation()
    navigate(url.href)
  }
  doc.addEventListener('click', handleClick, true)
  doc.addEventListener('auxclick', handleClick, true)
  return () => {
    win.open = originalOpen
    doc.removeEventListener('click', handleClick, true)
    doc.removeEventListener('auxclick', handleClick, true)
  }
}
