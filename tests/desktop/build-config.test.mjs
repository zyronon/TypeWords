import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// Evaluate the real config; replace build plugin factories, not branch logic.
const root = process.env.TYPEWORDS_TEST_ROOT || fileURLToPath(new URL('../../', import.meta.url))

function config(env = {}, raw = false, exit = () => {}) {
  const source = readFileSync(resolve(root, 'nuxt.config.ts'), 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  runInNewContext(js, {
    exports,
    __dirname: process.cwd(),
    URL,
    process: { env, exit },
    console: { error() {} },
    require(name) {
      if (name === 'pathe' || name === 'node:path') return { resolve }
      if (name === 'child_process') return { execSync: () => 'fixture' }
      if (name === 'nuxt/config') return { defineNuxtConfig: value => value }
      return { default: () => ({}) }
    },
  })
  return raw ? exports.default : JSON.parse(JSON.stringify(exports.default))
}

test('Web retains mixed rendering, base path, proxy and API default', () => {
  const web = config({ NUXT_APP_BASE_URL: '/typing' })
  assert.notEqual(web.ssr, false)
  assert.equal(web.app.baseURL, '/typing/')
  assert.equal(web.routeRules['/words'].ssr, false)
  assert.equal(web.routeRules['/book/nce1'].prerender, true)
  assert.equal(web.runtimeConfig.public.apiBase, 'http://localhost/')
  assert.ok(web.nitro.devProxy['/baidu'])
})

test('Desktop is root-based SPA with explicit static-only rendering', () => {
  const desktop = config({ TYPEWORDS_TARGET: 'desktop', NUXT_APP_BASE_URL: '/web-only/' })
  assert.equal(desktop.ssr, false)
  assert.equal(desktop.app.baseURL, '/')
  assert.deepEqual(desktop.routeRules, {})
  assert.equal(desktop.nitro.prerender.crawlLinks, false)
  assert.deepEqual(desktop.nitro.prerender.routes, ['/'])
  assert.equal(desktop.image.provider, 'none')
  assert.deepEqual(desktop.nitro.devProxy, {})
  assert.equal(desktop.vite.server.strictPort, true)
  assert.equal(desktop.devServer.port, 5567)
  assert.equal(desktop.runtimeConfig.public.isDesktop, true)
})

test('Unknown build target does not enable desktop', () => {
  assert.notEqual(config({ TYPEWORDS_TARGET: 'Desktop' }).ssr, false)
})

function initialize(isDesktop) {
  const source = readFileSync(resolve(root, 'app/plugins/02.init.client.ts'), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const events = []
  let plugin
  runInNewContext(js, {
    exports: {},
    console: { log() {} },
    require: () => ({ ENV: { LIBS_URL: '/libs/' }, withAppBaseURL: value => value }),
    defineNuxtPlugin: callback => {
      plugin = callback
    },
    useRuntimeConfig: () => ({ public: { isDesktop } }),
    location: { href: 'https://example.com/' },
    navigator: { serviceWorker: {} },
    window: { addEventListener: name => events.push(name) },
    document: { createElement: () => ({}), head: { appendChild: () => events.push('script') } },
  })
  return plugin({ vueApp: { use: () => events.push('plugin') } }).then(() => events)
}

test('Desktop skips website script and SW but retains Vue plugin', async () => {
  assert.deepEqual(await initialize(true), ['plugin'])
})

test('Web retains website initialization', async () => {
  assert.deepEqual(await initialize(false), ['script', 'load', 'plugin'])
})

test('Desktop rejects an actual fallback listener and closes it before exiting', async () => {
  const events = []
  const desktop = config({ TYPEWORDS_TARGET: 'desktop' }, true, code => events.push(`exit:${code}`))
  await desktop.hooks.listen({ address: () => ({ port: 3000 }) }, { close: async () => events.push('closed') })
  assert.deepEqual(events, ['closed', 'exit:1'])
})

test('Desktop accepts the actual expected listener', async () => {
  const desktop = config({ TYPEWORDS_TARGET: 'desktop' }, true, () => assert.fail('unexpected exit'))
  await desktop.hooks.listen({ address: () => ({ port: 5567 }) }, { close: () => assert.fail('unexpected close') })
})

test('Desktop exits even when an invalid listener fails to close', async () => {
  const exits = []
  const desktop = config({ TYPEWORDS_TARGET: 'desktop' }, true, code => exits.push(code))
  await assert.rejects(
    desktop.hooks.listen(
      { address: () => null },
      {
        close: async () => {
          throw new Error('close failed')
        },
      }
    ),
    /close failed/
  )
  assert.deepEqual(exits, [1])
})

test('Desktop API is explicitly configured independently from Web API_BASE', () => {
  assert.equal(
    config({ TYPEWORDS_TARGET: 'desktop', API_BASE: 'http://localhost/' }).runtimeConfig.public.desktopApiBase,
    ''
  )
  assert.equal(
    config({ TYPEWORDS_TARGET: 'desktop', TYPEWORDS_DESKTOP_API_BASE: 'https://api.example.test/' }).runtimeConfig
      .public.desktopApiBase,
    'https://api.example.test/'
  )
  assert.equal(
    config({ TYPEWORDS_DESKTOP_API_BASE: 'https://api.example.test/' }).runtimeConfig.public.desktopApiBase,
    ''
  )
})

test('Desktop watcher ignores Rust build output without changing Web watcher configuration', () => {
  const desktop = config({ TYPEWORDS_TARGET: 'desktop' })
  assert.deepEqual(desktop.vite.server.watch.ignored, ['**/src-tauri/**'])
  assert.equal(config().vite.server, undefined)
})

test('Desktop excludes remote font declarations while Web retains the original face', () => {
  const desktop = config({ TYPEWORDS_TARGET: 'desktop' })
  const web = config({})
  const remoteSheet = '~/assets/css/web-fonts.css'
  assert.ok(web.css.includes(remoteSheet), 'Web must retain its original Garamond face')
  assert.ok(!desktop.css.includes(remoteSheet), 'Desktop must not load network font CSS')
  const home = readFileSync(resolve(root, 'app/pages/index.vue'), 'utf8')
  const desktopStyles = desktop.css.map(path => readFileSync(resolve(root, 'app', path.replace(/^~\//, '')), 'utf8'))
  assert.doesNotMatch([home, ...desktopStyles].join('\n'), /fonts\.(?:gstatic|googleapis)\.com/)
  assert.match(home, /font-family: Garamond, Georgia, 'Times New Roman', serif/)
  const face = readFileSync(resolve(root, 'app/assets/css/web-fonts.css'), 'utf8')
  assert.match(face, /font-family: 'Garamond'/)
  assert.match(face, /font-style: italic/)
  assert.match(face, /font-weight: 700/)
  assert.match(face, /https:\/\/fonts\.gstatic\.com/)
})
