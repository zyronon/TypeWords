import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
function load(path, modules, globals = {}) {
  const exports = {}
  runInNewContext(
    ts.transpileModule(readFileSync(resolve(root, path), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      URL,
      console,
      ...globals,
      require(name) {
        assert.ok(name in modules, `Unexpected import: ${name}`)
        return modules[name]
      },
    }
  )
  return exports
}
function harness(desktop = true) {
  const calls = []
  const storage = new Map()
  const runtime = {}
  const sdk = {
    createClient(url, key) {
      calls.push({ url, key })
      if (!key) throw Error('key required')
      return { url, key }
    },
  }
  const platform = load('app/core/platform/sync.ts', { '@supabase/supabase-js': sdk })
  const api = load(
    'app/core/utils/supabase.ts',
    {
      '@supabase/supabase-js': sdk,
      '../platform/sync': platform,
      '@/base': { Toast: { error() {} } },
      '../stores': { useRuntimeStore: () => runtime },
    },
    {
      useRuntimeConfig: () => ({ public: { isDesktop: desktop } }),
      window: {},
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
      },
    }
  )
  return { ...api, platform, calls, storage, runtime }
}

test('desktop accepts only hosted HTTPS project origins and normalizes trailing slash', () => {
  const h = harness()
  assert.equal(
    h.platform.validatedSyncUrl(' https://project-123.supabase.co/ ', true),
    'https://project-123.supabase.co'
  )
  for (const url of [
    '',
    '/proxy',
    'http://project.supabase.co',
    'https://supabase.co',
    'https://evil.test',
    'https://project.supabase.co.evil.test',
    'https://nested.project.supabase.co',
    'https://project.supabase.co:8443',
    'https://user:pass@project.supabase.co',
    'https://project.supabase.co/rest/v1',
    'https://project.supabase.co/?key=x',
    'https://project.supabase.co/#x',
    'https://localhost',
    'https://127.0.0.1',
    'file:///x',
  ]) {
    assert.throws(() => h.platform.createSyncClient(url, 'test-key', true), undefined, url)
  }
  assert.equal(h.calls.length, 0)
})

test('Web keeps custom and local endpoint handling delegated to existing SDK', () => {
  const h = harness(false)
  h.platform.createSyncClient('http://localhost:54321/custom', 'web-key', false)
  assert.deepEqual(h.calls, [{ url: 'http://localhost:54321/custom', key: 'web-key' }])
})

test('invalid persisted desktop URL disables sync before any client or request is created', () => {
  const h = harness()
  h.setConfig({ url: 'http://localhost:54321', key: 'test-key', status: 'success' })
  assert.equal(h.Supabase.check(), false)
  assert.equal(h.Supabase.getStatus().status, 'idle')
  assert.notEqual(h.runtime.isError, true)
  assert.throws(() => h.Supabase.getInstance())
  assert.equal(h.calls.length, 0)
})

test('unconfigured desktop never constructs a fake successful sync client', () => {
  const h = harness()
  assert.equal(h.Supabase.check(), false)
  assert.throws(() => h.Supabase.getInstance(), /暂不提供云同步/)
  assert.equal(h.calls.length, 0)
})

test('saved Web clients are reused only for the same URL and key', () => {
  const h = harness(false)
  h.setConfig({ url: 'https://one.supabase.co', key: 'one', status: 'success' })
  assert.equal(h.Supabase.check(), true)
  const first = h.Supabase.getInstance()
  assert.equal(h.Supabase.getInstance(), first)
  h.setConfig({ url: 'https://two.supabase.co', key: 'two', status: 'success' })
  assert.equal(h.Supabase.check(), true)
  const second = h.Supabase.getInstance()
  assert.notEqual(second, first)
  assert.equal(second.url, 'https://two.supabase.co')
  h.Supabase.saveConfig('https://two.supabase.co', 'rotated')
  assert.equal(h.Supabase.getInstance().key, 'rotated')
  h.Supabase.removeConfig()
  assert.equal(h.Supabase.instance, null)
  assert.equal(h.Supabase.check(), false)
  assert.equal(h.calls.length, 3)
})

test('desktop SDK creation error is not replaced with a successful stub', () => {
  const h = harness()
  assert.throws(() => h.platform.createSyncClient('https://one.supabase.co', '', true), /key required/)
})

test('Web read retry never enables ordinary sync or idle configuration', () => {
  const h = harness(false)
  h.setConfig({ url: 'https://one.supabase.co', key: 'test-key', status: 'error' })
  assert.equal(h.Supabase.check(), false)
  assert.equal(h.Supabase.check(true), true)
  assert.equal(h.Supabase.getStatus().status, 'error')
  h.setConfig({ status: 'idle' })
  assert.equal(h.Supabase.check(true), false)
  assert.equal(h.calls.length, 0)
})

for (const status of ['success', 'error', 'syncing', 'idle']) {
  test(`local desktop ignores retained ${status} configuration without deleting or rewriting it`, () => {
    const h = harness()
    h.setConfig({ url: 'https://fixture.supabase.co', key: 'synthetic-key', status, statusMessage: 'old status' })
    const before = [...h.storage]
    assert.equal(h.Supabase.isEnabled(), false)
    assert.equal(h.Supabase.check(), false)
    assert.equal(h.Supabase.check(true), false)
    assert.equal(h.Supabase.getStatus().status, 'idle')
    h.Supabase.setStatus('success')
    h.Supabase.setStatus('error', 'ignored')
    assert.throws(() => h.Supabase.getInstance(), /暂不提供云同步/)
    assert.deepEqual([...h.storage], before)
    assert.deepEqual(h.calls, [])
  })
}
