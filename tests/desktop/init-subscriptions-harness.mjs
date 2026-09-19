import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { createPinia, defineStore } from 'pinia'
import { nextTick } from 'vue'
import { declarations } from './migration-declarations.mjs'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const compile = source =>
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText

export function harness() {
  const timers = new Map()
  let sequence = 0
  const clock = {
    setTimeout(fn) {
      timers.set(++sequence, fn)
      return sequence
    },
    clearTimeout(id) {
      timers.delete(id)
    },
    async flush() {
      const pending = [...timers.values()]
      timers.clear()
      for (const fn of pending) await fn()
      await nextTick()
    },
  }
  const pinia = createPinia()
  const make = id =>
    defineStore(id, {
      state: () => ({ _ignoreWatch: false, marker: 'old', load: false }),
      actions: {
        init: async () => null,
        setState(value) {
          this.$patch(value)
        },
      },
    })(pinia)
  const base = make('base')
  const setting = make('setting')
  const runtime = { globalLoading: false }
  const calls = []
  const cleanup = []
  const load = (source, imports = {}) => {
    const exports = {}
    runInNewContext(compile(source), {
      exports,
      require(name) {
        assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`)
        return imports[name]
      },
      ...clock,
      console: { log() {}, time() {}, timeEnd() {} },
      document: { addEventListener() {}, removeEventListener() {} },
      window: { location: { host: 'isolated.test' } },
    })
    return exports
  }
  const utils = load(declarations(root, 'app/core/utils/index.ts', ['debounce']))
  const imports = {
    '../config/env': { APP_VERSION: { version: 5 } },
    '../utils': utils,
    '../stores': {
      useBaseStore: () => base,
      useSettingStore: () => setting,
      useRuntimeStore: () => runtime,
    },
    '../utils/supabase': { Supabase: { getStatus: () => ({ status: 'success' }) } },
    './useDataSyncPersistence': {
      ensureHashGuardBeforeInit: async () => {},
      useDataSyncPersistence: () => ({
        saveDictState: async data => calls.push({ store: 'base', marker: data.marker }),
        saveLocalAndSync: async (_, data) => calls.push({ store: 'setting', marker: data.marker }),
      }),
    },
    '../types': { SyncDataType: { setting: 'setting' } },
    vue: { onUnmounted: fn => cleanup.push(fn) },
  }
  // The full init module is executed; only its Nuxt/environment and persistence edges are replaced.
  const init = load(readFileSync(resolve(root, 'app/core/composables/useInit.ts'), 'utf8'), imports).useInit()
  return { base, setting, runtime, calls, clock, init, cleanup }
}
