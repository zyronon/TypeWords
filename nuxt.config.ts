// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'node:path'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { execSync } from 'child_process'
import { defineNuxtConfig } from 'nuxt/config'

let latestCommitHash = ''
let latestCommitTime = ''
try {
  latestCommitHash = execSync('git rev-parse --short HEAD').toString().trim()
  latestCommitTime = execSync('git log -1 --format=%ci').toString().trim()
} catch (e) {
  latestCommitHash = 'unknown'
  latestCommitTime = 'unknown'
}

const siteOrigin = (process.env.ORIGIN || 'https://typewords.cc').replace(/\/$/, '')

function normalizeBaseURL(baseURL: string = '/') {
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

function withBaseURL(path: string, baseURL: string) {
  if (!path.startsWith('/')) return path
  if (baseURL === '/') return path
  if (path === '/') return baseURL
  return `${baseURL.slice(0, -1)}${path}`
}

function toSiteURL(path: string, baseURL: string) {
  return new URL(withBaseURL(path, baseURL), siteOrigin).toString()
}

const isDesktop = process.env.TYPEWORDS_TARGET === 'desktop'
const appBaseURL = isDesktop ? '/' : normalizeBaseURL(process.env.NUXT_APP_BASE_URL || '/')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    baseURL: appBaseURL,
    // keepalive: true,
    head: {
      title: 'Type Words — 免费英语单词练习 | Free English Typing Practice', // default fallback title
      htmlAttrs: {
        lang: 'zh-CN',
      },
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
  ...(isDesktop ? { ssr: false, image: { provider: 'none' } } : {}),
  routeRules: isDesktop
    ? {}
    : {
        '/words': { ssr: false },
        '/articles': { ssr: false },
        '/setting': { ssr: false },
        '/book/nce1': { prerender: true },
        '/book/nce2': { prerender: true },
        '/book/nce3': { prerender: true },
        '/book/nce4': { prerender: true },
      },
  // Nuxt owns the HTTP listener; Vite strictPort alone does not prevent fallback.
  hooks: isDesktop
    ? {
        async listen(server, listener) {
          const address = server.address()
          if (!address || typeof address === 'string' || address.port !== 5567) {
            console.error('[desktop] Expected port 5567; refusing fallback port')
            try {
              await listener.close()
            } finally {
              process.exit(1)
            }
          }
        },
      }
    : {},
  vite: {
    ...(isDesktop ? { server: { strictPort: true, watch: { ignored: ['**/src-tauri/**'] } } } : {}),
    plugins: [
      Components({
        resolvers: [
          IconsResolver({
            prefix: 'Icon',
          }),
        ],
      }),
      Icons({
        autoInstall: true,
      }),
    ],
  },
  // 模块
  modules: ['@pinia/nuxt', '@unocss/nuxt', 'unplugin-icons/nuxt', '@vue-macros/nuxt', '@nuxtjs/i18n', '@nuxt/image'],
  macros: {
    betterDefine: false,
  },
  // i18n 配置
  i18n: {
    locales: [
      { code: 'en', language: 'en-US', file: 'en.json', name: 'English' },
      { code: 'zh', language: 'zh-CN', file: 'zh.json', name: '中文' },
      { code: 'es', language: 'es-ES', file: 'es.json', name: 'Español' },
      { code: 'fr', language: 'fr-FR', file: 'fr.json', name: 'Français' },
      { code: 'pt', language: 'pt-BR', file: 'pt.json', name: 'Português' },
      { code: 'de', language: 'de-DE', file: 'de.json', name: 'Deutsch' },
      { code: 'ru', language: 'ru-RU', file: 'ru.json', name: 'Русский' },
      { code: 'uk', language: 'uk-UA', file: 'uk.json', name: 'Українська' },
      { code: 'ja', language: 'ja-JP', file: 'ja.json', name: '日本語' },
      { code: 'ko', language: 'ko-KR', file: 'ko.json', name: '한국어' },
      { code: 'th', language: 'th-TH', file: 'th.json', name: 'ไทย' },
      { code: 'vi', language: 'vi-VN', file: 'vi.json', name: 'Tiếng Việt' },
      { code: 'id', language: 'id-ID', file: 'id.json', name: 'Bahasa Indonesia' },
      { code: 'tw', language: 'zh-TW', file: 'tw.json', name: '繁體中文' },
    ],
    defaultLocale: 'zh',
    // langDir:'app/i18n/',
    strategy: 'no_prefix',
  },
  // CSS
  css: ['~/assets/css/main.scss', ...(isDesktop ? [] : ['~/assets/css/web-fonts.css'])],
  // 别名配置
  alias: {
    '@': resolve(__dirname, 'app'),
  },
  // 自动导入配置
  imports: {
    dirs: ['app/composables/**', 'app/utils/**'],
  },
  // 组件自动导入目录
  components: [
    { path: 'components', pathPrefix: false },
    { path: 'app/components', pathPrefix: false },
  ],
  // 运行时配置
  runtimeConfig: {
    public: {
      isDesktop,
      desktopApiBase: isDesktop ? process.env.TYPEWORDS_DESKTOP_API_BASE || '' : '',
      apiBase: process.env.API_BASE || 'http://localhost/',
      origin: process.env.ORIGIN || 'https://typewords.cc',
      host: process.env.HOST || 'typewords.cc',
      passwordRsaPublicKey: process.env.VITE_PASSWORD_RSA_PUBLIC_KEY || '',
      latestCommitHash: latestCommitHash + (process.env.NODE_ENV === 'production' ? '' : ' (dev)'),
      latestCommitTime: latestCommitTime,
    },
  },
  // 构建配置
  build: {
    transpile: ['vue-virtual-scroller', 'vxe-table'],
  },
  // 实验性功能
  experimental: {
    payloadExtraction: false, // 禁用 payload 提取，减少构建体积
  },
  // TypeScript 配置
  typescript: {
    strict: false,
    typeCheck: false, // 构建时不进行类型检查，加快构建速度
    tsConfig: {
      compilerOptions: {
        types: ['vue-macros/macros-global'],
        allowImportingTsExtensions: true,
      },
    },
  },
  devServer: {
    port: 5567,
  },
  nitro: {
    prerender: {
      ...(isDesktop ? { crawlLinks: false, routes: ['/'] } : {}),
      ignore: appBaseURL === '/' ? [] : [withBaseURL('/manifest.json', appBaseURL)],
    },
    devProxy: isDesktop
      ? {}
      : {
          '/baidu': {
            target: 'https://api.fanyi.baidu.com/api/trans/vip/translate',
            changeOrigin: true,
          },
        },
  },
})
