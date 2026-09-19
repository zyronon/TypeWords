import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
function load(path, modules = {}, globals = {}) {
  const exports = {}
  const source = readFileSync(resolve(root, path), 'utf8')
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      URL,
      Uint8Array,
      console,
      ...globals,
      require(name) {
        if (!(name in modules)) throw new Error(`Unexpected import: ${name}`)
        return modules[name]
      },
    }
  )
  return exports
}
function fixture(options = {}) {
  const calls = []
  const api = load('app/core/platform/desktop.ts', {
    'file-saver': { default: (...args) => calls.push(['web', ...args]) },
    '@tauri-apps/plugin-dialog': {
      save: async options_ => {
        calls.push(['dialog', options_])
        return options.cancel ? null : 'C:\\backup\\用户数据.zip'
      },
    },
    '@tauri-apps/plugin-fs': {
      writeFile: async (...args) => {
        calls.push(['write', ...args])
        if (options.fail) throw new Error('disk full')
      },
    },
    '@tauri-apps/plugin-opener': { openUrl: async url => calls.push(['open', url]) },
  })
  return { api, calls }
}

test('Web save retains file-saver without native commands', async () => {
  const { api, calls } = fixture()
  const blob = new Blob(['ZIP bytes'])
  assert.equal(await api.saveBackup(blob, 'backup.zip', false), true)
  assert.deepEqual(calls, [['web', blob, 'backup.zip']])
})

test('Desktop save writes exact bytes only to the user-selected path', async () => {
  const { api, calls } = fixture()
  const blob = new Blob([new Uint8Array([0, 80, 75, 255])])
  assert.equal(await api.saveBackup(blob, '备份.zip', true), true)
  assert.equal(calls[0][1].defaultPath, '备份.zip')
  assert.equal(calls[0][1].filters[0].extensions[0], 'zip')
  assert.deepEqual(calls[1], ['write', 'C:\\backup\\用户数据.zip', new Uint8Array([0, 80, 75, 255])])
  assert.equal(calls.length, 2)
})

test('Cancelled native save neither writes nor reads Blob bytes', async () => {
  const { api, calls } = fixture({ cancel: true })
  assert.equal(
    await api.saveBackup(
      {
        arrayBuffer() {
          throw new Error('should not read')
        },
      },
      'x.zip',
      true
    ),
    false
  )
  assert.equal(calls.length, 1)
})

test('Native write failure rejects instead of reporting success', async () => {
  const { api } = fixture({ fail: true })
  await assert.rejects(api.saveBackup(new Blob(['zip']), 'x.zip', true), /disk full/)
})

test('External opener accepts existing HTTPS destinations and rejects scheme/host confusion', async () => {
  const { api, calls } = fixture()
  await api.openExternal('https://github.com/zyronon/TypeWords')
  await api.openExternal('mailto:zyronon@163.com')
  for (const value of [
    'http://github.com/',
    'javascript:alert(1)',
    'file:///tmp/x',
    'mailto:a@b.com',
    'mailto:zyronon@163.com?cc=evil@example.com',
    'https://github.com.evil.test/',
    'https://user@github.com/',
    'https://github.com:8443/',
    'https://evil.test/?next=https://github.com',
    '//github.com/',
  ]) {
    await assert.rejects(api.openExternal(value))
  }
  assert.deepEqual(calls, [
    ['open', 'https://github.com/zyronon/TypeWords'],
    ['open', 'mailto:zyronon@163.com'],
  ])
})

test('Native allowlist exactly matches client host validation; no broad filesystem permission', () => {
  const { api } = fixture()
  const capability = JSON.parse(readFileSync(resolve(root, 'src-tauri/capabilities/main.json'), 'utf8'))
  assert.equal(capability.remote, undefined)
  assert.deepEqual(capability.permissions.slice(0, 2), ['dialog:allow-save', 'fs:allow-write-file'])
  assert.equal(capability.permissions.length, 3)
  assert.equal(capability.permissions[2].identifier, 'opener:allow-open-url')
  assert.deepEqual(
    capability.permissions[2].allow.map(item => item.url),
    [
      ...Array.from(api.EXTERNAL_HOSTS, host => `https://${host}/*`),
      ...Array.from(api.EXTERNAL_MAILS, mail => `mailto:${mail}`),
    ]
  )
  assert.match(readFileSync(resolve(root, 'app/core/config/env.ts'), 'utf8'), new RegExp(`EMAIL = '${api.EXTERNAL_MAILS[0]}'`))
})

test('Desktop anchors, middle-click and window.open use browser; internal links remain local', async () => {
  const { api } = fixture()
  const opened = []
  const errors = []
  const listeners = {}
  const originalOpen = () => {
    throw new Error('native popup must never run')
  }
  const assigned = []
  const win = {
    open: originalOpen,
    location: {
      href: 'http://tauri.localhost/setting',
      origin: 'http://tauri.localhost',
      protocol: 'http:',
      assign: url => assigned.push(url),
    },
  }
  const doc = {
    addEventListener: (type, fn) => {
      listeners[type] = fn
    },
    removeEventListener: type => {
      delete listeners[type]
    },
  }
  const dispose = api.installDesktopLinks(
    win,
    doc,
    async url => opened.push(url),
    error => errors.push(error)
  )
  function click(href, type = 'click', button = 0) {
    const event = {
      type,
      button,
      target: { closest: () => ({ href }) },
      preventDefault() {
        this.prevented = true
      },
      stopImmediatePropagation() {},
    }
    listeners[type](event)
    return event
  }
  assert.equal(click('https://www.youdao.com/result?word=test').prevented, true)
  assert.equal(click('mailto:zyronon@163.com').prevented, true)
  assert.equal(click('https://github.com/zyronon/TypeWords', 'auxclick', 1).prevented, true)
  assert.equal(click('http://tauri.localhost/words').prevented, undefined)
  assert.equal(click('javascript:alert(1)').prevented, true)
  assert.equal(win.open('https://enpuz.com/', '_blank'), null)
  win.open('https://evil.test/')
  win.open('/words')
  assert.deepEqual(opened, [
    'https://www.youdao.com/result?word=test',
    'mailto:zyronon@163.com',
    'https://github.com/zyronon/TypeWords',
    'https://enpuz.com/',
  ])
  assert.equal(errors.length, 2)
  assert.deepEqual(assigned, ['http://tauri.localhost/words'])
  dispose()
  assert.equal(win.open, originalOpen)
  assert.deepEqual(listeners, {})
})

test('Export consumer suppresses success on cancel/error and clears loading', async () => {
  for (const result of ['cancel', 'error', 'saved']) {
    const notices = []
    const calls = []
    class Zip {
      file() {}
      folder() {
        return this
      }
      async generateAsync() {
        return new Blob(['zip'])
      }
    }
    const { useExport } = load(
      'app/core/hooks/export.ts',
      {
        '../utils': { loadJsLib: async () => Zip, shakeCommonDict: value => value },
        '../config/env': {
          EXPORT_DATA_KEY: { version: 1 },
          SAVE_SETTING_KEY: { version: 1 },
          SAVE_DICT_KEY: { version: 1 },
          LIB_JS_URL: { JSZIP: '' },
        },
        'idb-keyval': { get: async () => [] },
        '../platform/desktop': {
          saveBackup: async (...args) => {
            calls.push(args)
            if (result === 'error') throw new Error('disk full')
            return result === 'saved'
          },
        },
        dayjs: { default: () => ({ format: () => 'today' }) },
        '@/base': {
          Toast: { success: value => notices.push(['success', value]), error: value => notices.push(['error', value]) },
        },
        '../stores/base': { useBaseStore: () => ({ $state: {} }) },
        '../stores/setting': { useSettingStore: () => ({ $state: {} }) },
        vue: { ref: value => ({ value }) },
        '../utils/cache': {
          PRACTICE_WORD_CACHE: { key: 'word', version: 1 },
          PRACTICE_ARTICLE_CACHE: { key: 'article', version: 1 },
        },
        '../composables/usePracticePersistence.ts': {
          usePracticeWordPersistence: () => ({ getLocalDataCompact: async () => ({}) }),
          usePracticeArticlePersistence: () => ({ getLocalDataCompact: async () => ({}) }),
        },
      },
      { useRuntimeConfig: () => ({ public: { isDesktop: true } }) }
    )
    const exporter = useExport()
    await exporter.exportData('saved!', 'backup.zip')
    assert.equal(calls[0][2], true)
    assert.equal(exporter.loading.value, false)
    assert.deepEqual(
      notices,
      result === 'saved' ? [['success', 'saved!']] : result === 'error' ? [['error', 'disk full']] : []
    )
  }
})
