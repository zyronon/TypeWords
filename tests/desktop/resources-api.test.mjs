import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import axios from 'axios'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
function evaluate(path, globals = {}, dependencies = {}) {
  const source = readFileSync(resolve(root, path), 'utf8').replaceAll('import.meta.env.MODE', "'test'")
  const exports = {}
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    URL,
    console,
    ...globals,
    require: name =>
      dependencies[name] || { offset() {}, ShortcutKey: {}, WordPracticeMode: {}, WordPracticeStage: {} },
  })
  return exports
}
function http(config) {
  let requestHandler, errorHandler
  const instance = {
    interceptors: {
      request: {
        use(fn) {
          requestHandler = fn
        },
      },
      response: {
        use(fn, err) {
          errorHandler = err
        },
      },
    },
  }
  evaluate(
    'app/core/utils/http.ts',
    { useRuntimeConfig: () => ({ public: config }) },
    {
      axios: { default: { create: () => instance } },
      '@/base': { Toast: { warning() {} } },
      '../config/env.ts': { ENV: { API: 'http://localhost/' } },
    }
  )
  return { request: requestHandler, error: errorHandler }
}
test('dynamic library URLs contain exactly one path separator', () => {
  const { LIB_JS_URL } = evaluate('app/core/config/env.ts')
  assert.deepEqual(Object.values(LIB_JS_URL), [
    '/libs/Shepherd.14.5.1.mjs.js',
    '/libs/snapdom.min.js',
    '/libs/jszip.min.js',
    '/libs/xlsx.full.min.js',
  ])
})
test('Web Axios keeps its existing API default', () => {
  assert.equal(
    http({ isDesktop: false, desktopApiBase: 'https://unused.example/' }).request({}).baseURL,
    'http://localhost/'
  )
})
test('Desktop API with no service rejects before the adapter and reports disabled not timeout', async () => {
  const hooks = http({ isDesktop: true, desktopApiBase: '' })
  let error
  try {
    hooks.request({ url: 'public.word/query' })
  } catch (e) {
    error = e
  }
  assert.equal(error?.code, 'DESKTOP_API_UNAVAILABLE')
  const response = await hooks.error(error)
  assert.equal(response.success, false)
  assert.match(response.msg, /桌面.*API/)
})
test('Desktop API uses only an explicit HTTPS service, normalized with trailing slash', () => {
  const hooks = http({ isDesktop: true, desktopApiBase: 'https://api.example.test/typewords' })
  assert.equal(hooks.request({}).baseURL, 'https://api.example.test/typewords/')
})
test('Desktop API rejects proxy paths, local defaults, non-HTTPS, credentials and query/hash', () => {
  for (const desktopApiBase of [
    '/baidu',
    'http://localhost/',
    'https://localhost/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'http://api.example/',
    'https://user:pass@api.example/',
    'https://api.example/?key=x',
    'https://api.example/#x',
  ]) {
    assert.throws(
      () => http({ isDesktop: true, desktopApiBase }).request({}),
      { code: 'DESKTOP_API_UNAVAILABLE' },
      desktopApiBase
    )
  }
})
test('Desktop translation does not create Baidu proxy requests or mutate article', async () => {
  let created = 0
  const { getNetworkTranslate } = evaluate(
    'app/core/hooks/translate.ts',
    { useRuntimeConfig: () => ({ public: { isDesktop: true } }) },
    {
      '@/libs': {
        Baidu: class {
          constructor() {
            created++
          }
        },
      },
      '../types': { TranslateEngine: { Baidu: 0 } },
    }
  )
  const article = { title: 'fixture', titleTranslate: 'keep', textTranslate: 'keep', sections: [] }
  await getNetworkTranslate(article, 0)
  assert.equal(created, 0)
  assert.equal(article.titleTranslate, 'keep')
  assert.equal(article.textTranslate, 'keep')
})
test('translation UI checks desktop before clearing existing translations', () => {
  const source = readFileSync(resolve(root, 'app/components/article/EditArticle.vue'), 'utf8')
  const body = source.slice(source.indexOf('async function startNetworkTranslate()'))
  assert.ok(
    body.indexOf('isDesktop') >= 0 && body.indexOf('isDesktop') < body.indexOf("editArticle.titleTranslate = ''")
  )
  assert.match(body, /桌面.*百度/)
})

test('real Axios adapter receives zero desktop requests when unconfigured', async () => {
  const notices = []
  const module = evaluate(
    'app/core/utils/http.ts',
    {
      useRuntimeConfig: () => ({ public: { isDesktop: true, desktopApiBase: '' } }),
    },
    {
      axios: { default: axios },
      '@/base': { Toast: { warning: message => notices.push(message) } },
      '../config/env.ts': { ENV: { API: 'http://localhost/' } },
    }
  )
  let calls = 0
  module.axiosInstance.defaults.adapter = async () => {
    calls++
    throw new Error('must not reach network')
  }
  const response = await module.default('public.word/query', null, { word: 'fixture' }, 'get')
  assert.equal(calls, 0)
  assert.equal(notices.length, 1)
  assert.match(notices[0], /桌面.*API/)
  assert.equal(response.code, 503)
  assert.match(response.msg, /桌面.*API/)
})
