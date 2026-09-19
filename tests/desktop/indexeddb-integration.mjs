// Standalone browser integration: node tests/desktop/indexeddb-integration.mjs
// Set TYPEWORDS_PLAYWRIGHT_MODULE to a Playwright entry point when it is not installed locally.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { settingsMigrationSource } from './settings-migration-source.mjs'
import { dictMigrationSource } from './dict-migration-source.mjs'
import { declarations } from './migration-declarations.mjs'

const root = new URL('../../', import.meta.url)
const source = path => readFileSync(new URL(path, root), 'utf8')
const transpile = path =>
  ts.transpileModule(source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
const modules = {
  persistence: transpile('app/core/composables/useDataSyncPersistence.ts'),
  account: transpile('app/core/platform/accountSync.ts'),
  accountPersistence: transpile('app/core/platform/accountPersistence.ts'),
  validation: transpile('app/core/composables/remotePracticeValidation.ts'),
  settingsValidation: transpile('app/core/composables/settingsValidation.ts'),
  dictionaryValidation: transpile('app/core/composables/dictionaryValidation.ts'),
  cache: transpile('app/core/utils/cache.ts'),
  enums: transpile('app/core/types/enum.ts'),
  session: transpile('app/core/composables/practice-words/practice-word-session.ts'),
  supabase: transpile('app/core/utils/supabase.ts'),
  init: transpile('app/core/composables/useInit.ts'),
  debounce: ts.transpileModule(declarations(fileURLToPath(root), 'app/core/utils/index.ts', ['debounce']), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  pinia: readFileSync(new URL('./pinia.prod.cjs', import.meta.resolve('pinia')), 'utf8'),
  settingsMigration: ts.transpileModule(settingsMigrationSource(fileURLToPath(root)), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  dictMigration: ts.transpileModule(dictMigrationSource(fileURLToPath(root)), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
}
const routes = new Map([
  ['/', '<!doctype html><meta charset="utf-8"><title>Isolated IndexedDB integration</title>'],
  ['/modules.json', JSON.stringify(modules)],
  ['/suite.js', source('tests/desktop/indexeddb-suite.mjs')],
  ['/settings-fixtures.js', source('tests/desktop/settings-validation-fixtures.mjs')],
  ['/dictionary-fixtures.js', source('tests/desktop/dictionary-validation-fixtures.mjs')],
  ['/idb.js', readFileSync(fileURLToPath(import.meta.resolve('idb-keyval')), 'utf8')],
  ['/vue.js', readFileSync(fileURLToPath(import.meta.resolve('vue/dist/vue.esm-browser.js')), 'utf8')],
])
const server = createServer((req, res) => {
  const body = routes.get(req.url)
  res.writeHead(body === undefined ? 404 : 200, {
    'Content-Type': req.url.endsWith('.js')
      ? 'text/javascript'
      : req.url.endsWith('.json')
        ? 'application/json'
        : 'text/html',
  })
  res.end(body ?? 'Not found')
})
let browser
let timeout
try {
  const { chromium } = await import(
    process.env.TYPEWORDS_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.TYPEWORDS_PLAYWRIGHT_MODULE).href : 'playwright'
  )
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ channel: process.env.TYPEWORDS_BROWSER_CHANNEL || 'msedge', headless: true })
  const context = await browser.newContext()
  const external = []
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue()
    external.push(route.request().url())
    return route.abort()
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin)
  const report = await Promise.race([
    page.evaluate(async () => (await import('/suite.js')).run()),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('IndexedDB integration timed out after 45s')), 45000)
    }),
  ])
  assert.deepEqual(errors, [])
  assert.deepEqual(external, [])
  assert.equal(report.cases.length, 19)
  console.log(JSON.stringify({ browser: browser.version(), externalRequests: external, ...report }, null, 2))
} finally {
  clearTimeout(timeout)
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
