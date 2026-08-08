const ABSOLUTE_URL_RE = /^[a-z][a-z\d+.-]*:/i

function getRootedBaseURL(baseURL?: string) {
  if (typeof baseURL !== 'string') return undefined

  const trimmedBaseURL = baseURL.trim()

  if (!trimmedBaseURL) {
    return undefined
  }

  if (trimmedBaseURL.startsWith('/')) {
    return trimmedBaseURL
  }

  if (ABSOLUTE_URL_RE.test(trimmedBaseURL)) {
    try {
      return new URL(trimmedBaseURL).pathname
    } catch {}
  }

  return undefined
}

function getBaseURLFromAssetPath(assetPath?: string, marker?: string) {
  const rootedAssetPath = getRootedBaseURL(assetPath)

  if (!rootedAssetPath || !marker) {
    return undefined
  }

  const markerIndex = rootedAssetPath.indexOf(marker)

  if (markerIndex < 0) {
    return undefined
  }

  return normalizeBaseURL(rootedAssetPath.slice(0, markerIndex) || '/')
}

function getDocumentBaseURL() {
  if (typeof document === 'undefined') {
    return undefined
  }

  const manifestHref =
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute('href') ||
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href
  const manifestBaseURL = getBaseURLFromAssetPath(manifestHref, '/manifest.json')

  if (manifestBaseURL) {
    return manifestBaseURL
  }

  const nuxtScriptSrc =
    document.querySelector<HTMLScriptElement>('script[src*="/_nuxt/"]')?.getAttribute('src') ||
    document.querySelector<HTMLScriptElement>('script[src*="/_nuxt/"]')?.src

  return getBaseURLFromAssetPath(nuxtScriptSrc, '/_nuxt/')
}

export function normalizeBaseURL(baseURL: string = '/') {
  if (!baseURL) return '/'

  let normalizedBaseURL = baseURL.trim()

  if (!normalizedBaseURL.startsWith('/')) {
    normalizedBaseURL = `/${normalizedBaseURL}`
  }
  if (!normalizedBaseURL.endsWith('/')) {
    normalizedBaseURL = `${normalizedBaseURL}/`
  }

  return normalizedBaseURL.replace(/\/{2,}/g, '/')
}

export function getAppBaseURL() {
  const runtimeBaseURL = getRootedBaseURL(
    typeof globalThis !== 'undefined' ? (globalThis as any).__NUXT__?.config?.app?.baseURL : undefined
  )
  const documentBaseURL = getDocumentBaseURL()
  const envBaseURL = getRootedBaseURL(typeof process !== 'undefined' ? process.env?.NUXT_APP_BASE_URL : undefined)
  const viteBaseURL = getRootedBaseURL(import.meta.env?.BASE_URL)

  return normalizeBaseURL(runtimeBaseURL || documentBaseURL || envBaseURL || viteBaseURL || '/')
}

export function withAppBaseURL(path: string = '', baseURL: string = getAppBaseURL()) {
  if (!path || ABSOLUTE_URL_RE.test(path) || path.startsWith('//') || !path.startsWith('/')) {
    return path
  }

  const normalizedBaseURL = normalizeBaseURL(baseURL)

  if (normalizedBaseURL === '/') {
    return path
  }

  const basePath = normalizedBaseURL.slice(0, -1)

  if (path === '/') {
    return normalizedBaseURL
  }
  if (path === basePath || path.startsWith(`${basePath}/`)) {
    return path
  }

  return `${basePath}${path}`
}

export function toSiteURL(path: string, origin: string, baseURL: string = getAppBaseURL()) {
  return new URL(withAppBaseURL(path, baseURL), origin).toString()
}
