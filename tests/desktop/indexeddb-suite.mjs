import * as idb from '/idb.js'
import { reactive, shallowReactive, nextTick, toRaw } from '/vue.js'
import * as vue from '/vue.js'
import { invalidSettings } from '/settings-fixtures.js'
import { invalidDictionaries } from '/dictionary-fixtures.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
const equal = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), message)
const keys = ['dict', 'setting', 'PracticeSaveWord', 'PracticeSaveArticle', 'audio']

export async function run() {
  const sources = await (await fetch('/modules.json')).json()
  function load(name, modules = {}) {
    const exports = {}
    new Function('exports', 'require', 'process', sources[name])(
      exports,
      name => {
        assert(Object.hasOwn(modules, name), `Unexpected module: ${name}`)
        return modules[name]
      },
      { env: { NODE_ENV: 'production' } }
    )
    return exports
  }
  const enums = load('enums')
  const validation = load('validation')
  const settingsValidation = load('settingsValidation')
  const dictionaryValidation = load('dictionaryValidation')
  // Production Pinia has no active devtools integration; learning state is isolated per case.
  const pinia = load('pinia', { vue, '@vue/devtools-api': {} })
  const cases = []
  for (const mode of [
    'import',
    'pull',
    'queued-before-import',
    'queued-after-abort',
    'offline-load',
    'offline-clear',
    'settings-boundary',
    'settings-abort',
    'dict-migration',
    'dict-abort',
    'watchers-import',
    'watchers-pull',
    'account-open',
    'account-migration',
    'account-logout',
    'account-refresh',
    'account-switch',
    'account-dispose',
    'desktop-local',
  ]) {
    const name = `typewords-transaction-test-${crypto.randomUUID()}`
    const events = []
    let fault = false
    let onSubmitted
    let submitted = 0
    let succeeded = 0
    let aborted = 0
    let pushes = 0
    let transactionSettled
    let status
    let queued
    let offline = mode.startsWith('offline-')
    let settingsMigrations = 0
    let dictMigrations = 0
    let repairSnapshots = 0
    let invalidateAccount
    let beforeAccountOpen
    let account
    const watcherMode = mode.startsWith('watchers-')
    const piniaRoot = watcherMode ? pinia.createPinia() : null
    const watcherSaves = []
    // Each operation opens and closes a real connection, including all verification reads.
    const store = async (txMode, callback) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('keyval')
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const tx = db.transaction('keyval', txMode)
      tx.addEventListener('complete', () => db.close())
      tx.addEventListener('abort', () => db.close())
      const objectStore = tx.objectStore('keyval')
      const inject = fault && txMode === 'readwrite'
      if (inject) {
        fault = false
        transactionSettled = new Promise(resolve => {
          tx.addEventListener('abort', () => {
            aborted++
            resolve()
          })
          tx.addEventListener('complete', resolve)
        })
      }
      const observed = inject
        ? new Proxy(objectStore, {
            get(target, property) {
              if (property === 'put') {
                return (...args) => {
                  submitted++
                  const write = target.put(...args)
                  write.addEventListener('success', () => {
                    succeeded++
                    if (succeeded === 2) {
                      if (invalidateAccount) invalidateAccount()
                      else tx.abort()
                    }
                  })
                  return write
                }
              }
              const value = Reflect.get(target, property, target)
              return typeof value === 'function' ? value.bind(target) : value
            },
          })
        : objectStore
      if (txMode === 'readwrite' && beforeAccountOpen) {
        const invalidate = beforeAccountOpen
        beforeAccountOpen = null
        invalidate()
      }
      const result = callback(observed)
      if (inject) onSubmitted?.()
      return result
    }
    const storage = {
      get: key => idb.get(key, store),
      set: (key, value) => idb.set(key, value, store),
      del: key => idb.del(key, store),
      setMany: entries => idb.setMany(entries, store),
    }
    const oldState = () => ({
      word: { studyIndex: -1, bookList: [] },
      article: { studyIndex: -1, bookList: [] },
      due: new Date('2026-09-15T00:00:00Z'),
      marker: 'old',
    })
    const makeStore = merge => {
      if (watcherMode) {
        return pinia.defineStore(merge ? 'setting' : 'base', {
          state: () => ({ ...oldState(), _ignoreWatch: false }),
          actions: {
            init: async () => null,
            setState(value) {
              this.$patch(state => {
                if (!merge) {
                  for (const key of Object.keys(state)) delete state[key]
                }
                Object.assign(state, value)
              })
            },
          },
        })(piniaRoot)
      }
      const state = reactive({ value: oldState() })
      return {
        get $state() {
          return state.value
        },
        get word() {
          return state.value.word
        },
        get article() {
          return state.value.article
        },
        get sdict() {
          return state.value.word.bookList[state.value.word.studyIndex]
        },
        get sbook() {
          return state.value.article.bookList[state.value.article.studyIndex]
        },
        setState(value) {
          if (merge) Object.assign(state.value, value)
          else state.value = value
        },
        $patch(fn) {
          fn(state.value)
        },
      }
    }
    const base = makeStore(false)
    const setting = makeStore(true)
    const cache = load('cache', { '../types/enum': enums, 'idb-keyval': storage })
    const data = {
      dict: { val: { ...oldState(), marker: 'new' } },
      setting: { val: { marker: 'new', added: true, shortcutKeyMap: {} } },
      PracticeSaveWord: { val: { taskWordsStr: { new: ['hello'], review: [] } } },
      PracticeSaveArticle: { val: null },
    }
    const rows = [
      { type: enums.SyncDataType.dict, data: data.dict.val, data_version: 4 },
      { type: enums.SyncDataType.setting, data: data.setting.val, data_version: 23 },
      { type: enums.SyncDataType.practice_word, data: data.PracticeSaveWord.val, data_version: 1 },
      { type: enums.SyncDataType.practice_article, data: null, data_version: 1 },
    ]
    const client = {
      from: () => {
        if (mode === 'desktop-local') throw new Error('Desktop reached remote client')
        return {
          select: () => ({
            in: (_, types) => {
              const result = offline
                ? Promise.reject(new Error('isolated network failure'))
                : Promise.resolve({ data: structuredClone(rows.filter(row => types.includes(row.type))) })
              result.not = async () => ({ data: structuredClone(rows) })
              return result
            },
          }),
          upsert: async incoming => {
            pushes++
            events.push('remote')
            const saved = JSON.parse(await storage.get('setting'))
            if (watcherMode) {
              for (const row of incoming) {
                const key =
                  row.type === enums.SyncDataType.practice_word
                    ? 'PracticeSaveWord'
                    : row.type === enums.SyncDataType.practice_article
                      ? 'PracticeSaveArticle'
                      : row.type
                equal(JSON.parse(await storage.get(key)).val, row.data, 'Watcher push preceded local commit')
              }
            } else {
              assert(saved.val.marker === 'new', 'Remote push preceded local commit')
            }
            return {}
          },
        }
      },
    }
    const config = load('supabase', {
      '@supabase/supabase-js': { createClient: () => client },
      '@/base': { Toast: { error() {} } },
      '../stores': { useRuntimeStore: () => ({}) },
      '../platform/sync': { validatedSyncUrl: value => value, createSyncClient: () => client },
    })
    globalThis.useRuntimeConfig = () => ({ public: { isDesktop: mode === 'desktop-local' } })
    config.setConfig({ url: 'https://fixture.supabase.co', key: 'fixture-key', status: 'success', statusMessage: '' })
    const setStatus = config.Supabase.setStatus.bind(config.Supabase)
    config.Supabase.setStatus = (value, message) => {
      setStatus(value, message)
      status = config.Supabase.getStatus().status
    }
    const settingsMigration = load('settingsMigration', {
      '../types/enum': enums,
      'idb-keyval': storage,
      '../composables/useDataSyncPersistence': {
        saveHashSnapshot: async () => {
          repairSnapshots++
          throw new Error('Unexpected legacy repair snapshot')
        },
      },
    })
    const dictMigration = load('dictMigration', {
      '../types/enum': enums,
      vue: { shallowReactive },
      '../composables/useDataSyncPersistence': {
        saveHashSnapshot: async () => {
          repairSnapshots++
          throw new Error('Unexpected dictionary repair snapshot')
        },
      },
    })
    const persistence = load('persistence', {
      '../platform/accountPersistence': {
        setManyForAccount: (entries, scope) =>
          load('accountPersistence', { 'idb-keyval': idb }).setManyForAccount(entries, scope, store),
      },
      '../utils': {
        shakeCommonDict: value => value,
        shouldFetchRemote: () => enums.CompareResult.LocalNewer,
        checkAndUpgradeSaveDict: async envelope => {
          dictMigrations++
          return mode.startsWith('dict-') ? dictMigration.checkAndUpgradeSaveDict(envelope) : envelope.val
        },
        checkAndUpgradeSaveSetting: async envelope => {
          settingsMigrations++
          if (mode === 'account-migration' && invalidateAccount) {
            const invalidate = invalidateAccount
            invalidateAccount = null
            await Promise.resolve()
            invalidate()
          }
          return mode.startsWith('settings-') || mode.startsWith('dict-')
            ? settingsMigration.checkAndUpgradeSaveSetting(envelope)
            : envelope.val
        },
      },
      '../utils/cache': cache,
      '../config/env': {
        SAVE_DICT_KEY: { key: 'dict', version: 4 },
        SAVE_SETTING_KEY: { key: 'setting', version: 23 },
        LOCAL_FILE_KEY: 'audio',
      },
      '../stores': { useBaseStore: () => base, useSettingStore: () => setting },
      '../types/enum': enums,
      '../utils/supabase': config,
      'idb-keyval': storage,
      '@/base': {},
      vue: { nextTick, toRaw },
      './remotePracticeValidation': validation,
      './settingsValidation': settingsValidation,
      './dictionaryValidation': dictionaryValidation,
    })
    const api = persistence.useDataSyncPersistence()
    let stopInit
    if (watcherMode) {
      const lifecycle = []
      const init = load('init', {
        '../config/env': { APP_VERSION: { version: 5 } },
        '../utils': load('debounce'),
        '../stores': {
          useBaseStore: () => base,
          useSettingStore: () => setting,
          useRuntimeStore: () => ({}),
        },
        '../utils/supabase': config,
        './useDataSyncPersistence': {
          ensureHashGuardBeforeInit: async () => {},
          useDataSyncPersistence: () => ({
            ...api,
            saveDictState: async value => {
              watcherSaves.push('dict')
              return api.saveDictState(value)
            },
            saveLocalAndSync: async (type, value) => {
              watcherSaves.push(type)
              return api.saveLocalAndSync(type, value)
            },
          }),
        },
        '../types': enums,
        vue: { onUnmounted: fn => lifecycle.push(fn) },
      }).useInit()
      await init()
      stopInit = () => {
        for (const fn of lifecycle) fn()
        pinia.disposePinia(piniaRoot)
      }
    }
    const audio = text => [{ id: 'synthetic-tone', file: new Blob([text], { type: 'audio/mpeg' }) }]
    async function snapshot() {
      const values = await idb.getMany(keys, store)
      values[4] = await Promise.all(
        values[4].map(async item => ({ id: item.id, bytes: [...new Uint8Array(await item.file.arrayBuffer())] }))
      )
      return values
    }
    try {
      await storage.setMany([
        ...keys.slice(0, 4).map(key => [key, JSON.stringify({ val: `old-${key}` })]),
        ['audio', audio('old audio bytes')],
      ])
      if (mode === 'desktop-local') {
        const beforeConfig = localStorage.getItem(config.SUPABASE_CONFIG_KEY)
        const before = await snapshot()
        assert(!config.Supabase.check() && !config.Supabase.check(true), 'Desktop enabled retained cloud config')
        assert(config.Supabase.getStatus().status === 'idle', 'Desktop exposed stale sync status')
        assert((await api.getRemoteData(enums.SyncDataType.dict, client)) === null, 'Explicit client bypassed policy')
        assert((await api.getRemoteMeta(enums.SyncDataType.dict, client)) === null, 'Metadata bypassed policy')
        assert((await api.pullAllRemoteToLocal(client)) === false, 'Desktop pulled remote records')
        assert((await api.pullIfRemoteNewer(enums.SyncDataType.dict, client)) === null, 'Desktop pulled newer data')
        await api.syncData({ dict: { val: data.dict.val, version: 4 } })
        let captured = false
        await api
          .pullAccountRemoteToLocal({
            capture() {
              captured = true
            },
          })
          .then(
            () => {
              throw Error('Account pull should reject on desktop')
            },
            () => {}
          )
        assert(!captured, 'Desktop captured an account session')
        equal(await snapshot(), before, 'Desktop remote reads changed disk')
        await api.saveLocalAndSync(enums.SyncDataType.setting, { marker: 'local edit' }, { client })
        assert(JSON.parse(await storage.get('setting')).val.marker === 'local edit', 'Desktop local save failed')
        assert(
          (await api.forcePushLocalDataToRemote(data, client, audio('local imported audio'))) === false,
          'Desktop import reported remote upload'
        )
        const imported = await snapshot()
        assert(JSON.parse(imported[0]).val.marker === 'new', 'Desktop local import failed')
        assert(base.$state.marker === 'new', 'Desktop local import did not hydrate')
        equal(
          imported[4][0].bytes,
          [...new TextEncoder().encode('local imported audio')],
          'Desktop audio import failed'
        )
        assert(pushes === 0, 'Desktop performed remote writes')
        equal(localStorage.getItem(config.SUPABASE_CONFIG_KEY), beforeConfig, 'Desktop rewrote retained config')
        cases.push({
          mode,
          retainedConfig: true,
          explicitClientBlocked: true,
          localSave: true,
          localImport: true,
          reopened: true,
          pushes,
        })
        continue
      }
      if (mode.startsWith('account-')) {
        const before = await snapshot()
        const memory = JSON.stringify([base.$state, setting.$state])
        let authEvent
        const session = (user = 'synthetic-a', token = 'synthetic-token') => ({
          user: { id: user, email: 'fixture@example.invalid', is_anonymous: false },
          access_token: token,
        })
        const accountModule = load('account', {
          './sync': { validatedSyncUrl: value => value },
          '@supabase/supabase-js': {
            createClient: (_url, _key, options) =>
              options?.accessToken
                ? {
                    from: () => ({
                      select: () => ({
                        eq: (_field, userId) => ({
                          in: async () => {
                            await options.accessToken()
                            return { data: structuredClone(rows).map(row => ({ ...row, user_id: userId })) }
                          },
                        }),
                      }),
                    }),
                  }
                : {
                    auth: {
                      onAuthStateChange: callback => {
                        authEvent = callback
                        return { data: { subscription: { unsubscribe() {} } } }
                      },
                      getSession: async () => ({ data: { session: null } }),
                      signInWithPassword: async () => ({ data: { session: session() } }),
                      signOut: async () => ({}),
                      stopAutoRefresh: async () => {},
                    },
                  },
          },
        })
        account = accountModule.createAccountSync('https://synthetic.supabase.co', 'synthetic-key', true)
        await account.ready
        await account.signIn('fixture@example.invalid', 'synthetic-password')
        config.Supabase.setStatus('idle')
        invalidateAccount = () => {
          equal(JSON.stringify([base.$state, setting.$state]), memory, 'Speculative account data reached memory')
          if (mode === 'account-logout') void account.signOut()
          else if (mode === 'account-dispose') account.dispose()
          else if (mode === 'account-switch') authEvent('SIGNED_IN', session('synthetic-b', 'other-account-token'))
          else authEvent('TOKEN_REFRESHED', session('synthetic-a', 'replacement-token'))
        }
        if (mode === 'account-open') beforeAccountOpen = invalidateAccount
        if (['account-logout', 'account-refresh', 'account-switch', 'account-dispose'].includes(mode)) fault = true
        let rejected = false
        try {
          await api.pullAccountRemoteToLocal(account)
        } catch {
          rejected = true
        }
        assert(rejected, 'Stale account pull reported success')
        await transactionSettled
        equal(await snapshot(), before, 'Stale account transaction changed disk/audio')
        equal(JSON.stringify([base.$state, setting.$state]), memory, 'Stale account transaction changed memory')
        assert(status === 'idle', 'Stale account request changed UI status')
        assert(!account.getState().active && pushes === 0, 'Stale account pull activated or uploaded')
        if (mode !== 'account-migration' && mode !== 'account-open') {
          assert(submitted === 4 && succeeded === 2 && aborted === 1, 'Account invalidation did not abort real writes')
        }
        invalidateAccount = null
        if (mode !== 'account-dispose') {
          await account.signIn('fixture@example.invalid', 'synthetic-password')
          assert(await api.pullAccountRemoteToLocal(account), 'Current account retry failed')
          assert(account.getState().active && status === 'idle', 'Account pull activation changed legacy status')
          account.capture('automatic').assertCurrent()
          const retry = await snapshot()
          assert(JSON.parse(retry[0]).val.marker === 'new', 'Account retry lost dictionary')
          assert(JSON.parse(retry[1]).val.marker === 'new', 'Account retry lost settings')
          equal(JSON.parse(retry[2]).val.taskWordsStr.new, ['hello'], 'Account retry lost cache')
          assert(JSON.parse(retry[3]).val === null, 'Account retry lost empty article cache')
          equal(retry[4], before[4], 'Account retry changed local audio')
        }
        cases.push({ mode, submitted, succeeded, aborted, pushes, reopened: true, retry: mode !== 'account-dispose' })
        continue
      }
      if (watcherMode) {
        const before = await snapshot()
        // A pending pre-import edit must not echo either the failed import or its rollback.
        setting.marker = 'pending edit'
        await nextTick()
        fault = true
        if (mode === 'watchers-pull') {
          assert((await api.pullAllRemoteToLocal()) === false, 'Watcher pull abort reported success')
        } else {
          let rejected = false
          try {
            await api.forcePushLocalDataToRemote(data, client, audio('new audio bytes'))
          } catch {
            rejected = true
          }
          assert(rejected, 'Watcher import abort did not reject')
        }
        await transactionSettled
        await new Promise(resolve => setTimeout(resolve, 1150))
        equal(await snapshot(), before, 'Watcher wrote after transaction rollback')
        equal(watcherSaves, [], 'Import or rollback scheduled an autosave')
        assert(pushes === 0 && aborted === 1 && succeeded === 2, 'Watcher abort/push mismatch')
        assert(setting.marker === 'pending edit' && base.marker === 'old', 'Watcher rollback lost memory')
        assert(!base._ignoreWatch && !setting._ignoreWatch, 'Rollback suppression not consumed')
        if (mode === 'watchers-pull') {
          assert(await api.pullAllRemoteToLocal(), 'Watcher pull retry failed')
        } else {
          assert(await api.forcePushLocalDataToRemote(data, client, audio('new audio bytes')), 'Watcher retry failed')
        }
        const committed = await snapshot()
        // Both edits occur inside the real 1000ms debounce window after successful import.
        base.marker = 'dict user edit'
        setting.marker = 'setting user edit'
        await nextTick()
        const deadline = Date.now() + 5000
        let saved
        do {
          await new Promise(resolve => setTimeout(resolve, 30))
          saved = await snapshot()
        } while (
          (JSON.parse(saved[0]).val.marker !== 'dict user edit' ||
            JSON.parse(saved[1]).val.marker !== 'setting user edit') &&
          Date.now() < deadline
        )
        assert(JSON.parse(saved[0]).val.marker === 'dict user edit', 'First dictionary edit was swallowed')
        assert(JSON.parse(saved[1]).val.marker === 'setting user edit', 'First settings edit was swallowed')
        equal(saved.slice(2), committed.slice(2), 'Watcher edit changed practice caches or audio')
        equal([...watcherSaves].sort(), ['dict', 'setting'], 'Unexpected watcher writes')
        // Local commits precede the two explicit user edits' stub remote writes.
        const pushDeadline = Date.now() + 2000
        while (pushes < (mode === 'watchers-pull' ? 2 : 3) && Date.now() < pushDeadline) {
          await new Promise(resolve => setTimeout(resolve, 20))
        }
        assert(pushes === (mode === 'watchers-pull' ? 2 : 3), 'Unexpected watcher remote write count')
        cases.push({
          mode,
          realPinia: true,
          productionPinia: true,
          fullInitSubscriptions: true,
          debounceMs: 1000,
          submitted,
          succeeded,
          aborted,
          pushes,
          watcherSaves,
          reopened: true,
          retry: true,
        })
        continue
      }
      if (mode.startsWith('dict-')) {
        const before = await snapshot()
        const oldMemory = JSON.stringify(base.$state)
        const fixture = () => {
          const value = dictMigration.getDefaultBaseState()
          delete value.word.bookList[0].system
          value.word.bookList.push({
            id: 42,
            en_name: 'legacy-custom',
            name: 'Migration fixture',
            custom: true,
            words: [
              { word: 'hello', trans: ['greeting'] },
              { word: 'world', trans: [] },
            ],
            articles: [],
            length: 99,
            lastLearnIndex: 1,
            perDayStudyNumber: 7,
            statistics: [{ total: 2, correct: 1 }],
          })
          value.word.studyIndex = 3
          value.article.bookList.push({
            id: 'custom-article',
            custom: true,
            words: [],
            length: 99,
            lastLearnIndex: 0,
            articles: [{ text: 'Hello world.', textTranslate: 'Fixture', audioFileId: 'synthetic-tone' }],
          })
          value.article.studyIndex = 1
          value.simpleWords = ['a']
          value.noteData = { hello: 'Keep this note' }
          value.fsrsData = {
            hello: {
              due: '2026-09-16T00:00:00.000Z',
              stability: 2,
              difficulty: 5,
              elapsed_days: 1,
              scheduled_days: 2,
              reps: 2,
              lapses: 0,
              state: 2,
              last_review: '2026-09-14T00:00:00.000Z',
            },
          }
          return JSON.parse(JSON.stringify(value))
        }
        const checkSaved = async () => {
          const saved = JSON.parse(await storage.get('dict'))
          const value = saved.val
          assert(saved.version === 4 && value.load === true, 'Dictionary version/load not normalized')
          assert(value.word.studyIndex === 3 && value.article.studyIndex === 1, 'Study selection lost')
          assert(value.word.bookList[0].system === true, 'Legacy system book not normalized')
          const word = value.word.bookList[3]
          assert(word.id === 42 && word.enName === 'legacy-custom', 'Legacy dictionary identity lost')
          assert(word.length === 2 && word.lastLearnIndex === 1 && word.perDayStudyNumber === 7, 'Word progress lost')
          equal(word.words, fixture().word.bookList[3].words, 'Word contents lost')
          equal(word.statistics, fixture().word.bookList[3].statistics, 'Statistics lost')
          const article = value.article.bookList[1]
          assert(article.enName === 'custom-article' && article.length === 1, 'Article identity/length lost')
          equal(article.articles, fixture().article.bookList[1].articles, 'Article/audio reference lost')
          for (const key of ['simpleWords', 'noteData', 'fsrsData']) {
            equal(value[key], fixture()[key], `Dictionary ${key} lost`)
          }
          equal(JSON.parse(JSON.stringify(base.$state)), value, 'Committed memory differs from reopened dictionary')
          assert(JSON.parse(await storage.get('setting')).val.wordSoundVolume === 37, 'Real setting migration lost')
          equal(JSON.parse(await storage.get('PracticeSaveWord')).val.taskWordsStr.new, ['hello'], 'Cache lost')
          assert(JSON.parse(await storage.get('PracticeSaveArticle')).val === null, 'Article cache lost')
        }
        rows[0].data = fixture()
        rows[1].data = { shortcutKeyMap: {}, wordSoundVolume: 37 }
        if (mode === 'dict-migration') {
          for (const [label, mutate] of invalidDictionaries) {
            rows[0].data = fixture()
            mutate(rows[0].data)
            // The fixture has four word books; use an actually out-of-range selection.
            if (label === 'invalid selection') rows[0].data.word.studyIndex = 99
            assert((await api.pullAllRemoteToLocal()) === false, `Invalid dictionary accepted: ${label}`)
            equal(await snapshot(), before, `Invalid dictionary changed database/audio: ${label}`)
            assert(JSON.stringify(base.$state) === oldMemory, `Invalid dictionary changed memory: ${label}`)
            assert(dictMigrations === 0 && settingsMigrations === 0, `Invalid dictionary migrated: ${label}`)
            assert(pushes === 0 && repairSnapshots === 0, `Invalid dictionary wrote remotely: ${label}`)
            assert(status === 'error' && !config.Supabase.check(), `Invalid dictionary unlocked writes: ${label}`)
          }
          rows[0].data = fixture()
        }
        if (mode === 'dict-abort') {
          rows[0].data_version = 1
          fault = true
          assert((await api.pullAllRemoteToLocal()) === false, 'Dictionary abort reported success')
          await transactionSettled
          assert(submitted === 4 && succeeded === 2 && aborted === 1, 'Expected dictionary transaction abort')
          equal(await snapshot(), before, 'Dictionary abort changed persistent data/audio')
          equal(
            JSON.parse(JSON.stringify(base.$state)),
            { ...JSON.parse(oldMemory), _ignoreWatch: true },
            'Dictionary abort changed old memory beyond the watcher suppression flag'
          )
          assert(base.$state.due instanceof Date, 'Dictionary rollback lost Date')
          assert(!Object.hasOwn(base.$state, 'noteData'), 'Dictionary rollback retained new fields')
          assert(status === 'error' && !config.Supabase.check(), 'Dictionary abort unlocked writes')
        }
        const versions = mode === 'dict-migration' ? [1, 2, 3, 4] : [1]
        for (const version of versions) {
          rows[0].data_version = version
          rows[0].data = fixture()
          const pulled = await api.pullAllRemoteToLocal()
          assert(pulled, `Real dictionary v${version} pull failed: ${config.Supabase.getStatus().statusMessage}`)
          await checkSaved()
          assert(status === 'success' && config.Supabase.getStatus().statusMessage === '', 'Retry status stale')
        }
        assert(dictMigrations === (mode === 'dict-abort' ? 2 : 4), 'Dictionary migrator not exercised')
        assert(settingsMigrations === dictMigrations, 'Real settings migration not exercised')
        assert(pushes === 0 && repairSnapshots === 0, 'Dictionary test wrote remote/repair snapshots')
        equal((await snapshot())[4], before[4], 'Dictionary migration changed audio bytes')
        cases.push({
          mode,
          realDictMigrator: true,
          invalidCases: mode === 'dict-migration' ? invalidDictionaries.length : 0,
          realSettingsMigrator: true,
          legacyVersions: versions,
          dictMigrations,
          settingsMigrations,
          repairSnapshots,
          submitted,
          succeeded,
          aborted,
          pushes,
          reopened: true,
          retry: mode === 'dict-abort',
        })
        continue
      }
      if (mode.startsWith('settings-')) {
        const before = await snapshot()
        const oldMemory = JSON.stringify(setting.$state)
        if (mode === 'settings-boundary') {
          for (const [label, mutate] of invalidSettings) {
            rows[1].data = { shortcutKeyMap: {} }
            mutate(rows[1].data)
            assert((await api.pullAllRemoteToLocal()) === false, `Accepted ${label}`)
            equal(await snapshot(), before, `Invalid ${label} changed database/audio`)
            assert(JSON.stringify(setting.$state) === oldMemory, `Invalid ${label} changed memory`)
            assert(settingsMigrations === 0 && dictMigrations === 0, `Invalid ${label} reached migration`)
            assert(status === 'error' && !config.Supabase.check(), `Invalid ${label} unlocked writes`)
          }
          for (const version of [1, 17, 19, 23]) {
            rows[1].data_version = version
            rows[1].data = { shortcutKeyMap: { [enums.ShortcutKey.Next]: 'Alt+N' }, wordSoundVolume: 37 }
            assert(await api.pullAllRemoteToLocal(), `Historical settings v${version} failed`)
            const saved = JSON.parse(await storage.get('setting'))
            assert(saved.version === 23 && saved.val.wordSoundVolume === 37, 'Settings migration lost value')
            assert(saved.val.fontSize.wordForeignFontSize === 48, 'Missing legacy font default')
            equal(saved.val.ttsVoiceMap, [], 'Missing legacy voice default')
            assert(
              saved.val.shortcutKeyMap[enums.ShortcutKey.Next] ===
                (version <= 20 ? settingsMigration.DefaultShortcutKeyMap[enums.ShortcutKey.Next] : 'Alt+N'),
              'Historical shortcut migration changed'
            )
            assert(status === 'success' && config.Supabase.getStatus().statusMessage === '', 'Retry status stale')
          }
        } else {
          rows[1].data = { shortcutKeyMap: {}, wordSoundVolume: 37 }
          fault = true
          assert((await api.pullAllRemoteToLocal()) === false, 'Real settings abort reported success')
          await transactionSettled
          assert(submitted === 4 && succeeded === 2 && aborted === 1, 'Expected multi-key transaction abort')
          equal(await snapshot(), before, 'Real settings abort changed database/audio')
          assert(setting.$state.marker === 'old', 'Real settings abort lost old memory')
          assert(!Object.hasOwn(setting.$state, 'wordSoundVolume'), 'Real settings abort retained imported values')
          assert(setting.$state.due instanceof Date, 'Real settings rollback lost Date')
          assert(status === 'error' && !config.Supabase.check(), 'Aborted settings unlocked writes')
          assert(await api.pullAllRemoteToLocal(), 'Real settings retry failed')
          assert(JSON.parse(await storage.get('setting')).val.wordSoundVolume === 37, 'Retry lost setting')
          assert(status === 'success' && config.Supabase.getStatus().statusMessage === '', 'Retry status stale')
        }
        assert(pushes === 0 && repairSnapshots === 0, 'Settings test wrote remote or repair snapshots')
        const after = await snapshot()
        equal(after[4], before[4], 'Settings retry changed audio')
        cases.push({
          mode,
          realSettingsMigrator: true,
          settingsMigrations,
          dictMigrations,
          repairSnapshots,
          submitted,
          succeeded,
          aborted,
          pushes,
          reopened: true,
          retry: true,
          invalidCases: mode === 'settings-boundary' ? invalidSettings.length : 0,
          legacyVersions: mode === 'settings-boundary' ? [1, 17, 19, 23] : [],
        })
        continue
      }
      if (mode.startsWith('offline-')) {
        await storage.set(
          cache.PRACTICE_WORD_CACHE.key,
          JSON.stringify({
            val: mode === 'offline-clear' ? null : { taskWords: { new: [{ word: 'hello' }], review: [] } },
            version: 1,
            updated_at: '2020-01-01T00:00:00Z',
          })
        )
        const before = await snapshot()
        const session = load('session', {
          '@/core/stores/base.ts': { useBaseStore: () => ({ sdict: { words: [{ word: 'hello' }] } }) },
          '@/core/stores/setting.ts': { useSettingStore: () => setting },
          '@/core/types/enum.ts': enums,
          '@/core/utils/cache.ts': cache,
          '@/core/composables/useDataSyncPersistence.ts': { ...persistence, useDataSyncPersistence: () => api },
          '@/core/composables/remotePracticeValidation': validation,
          '@/core/utils/index.ts': { shouldFetchRemote: () => enums.CompareResult.RemoteNewer },
        }).usePracticeWordPersistence()
        const restored = await session.load()
        equal(
          restored,
          mode === 'offline-clear' ? null : { taskWords: { new: [{ word: 'hello' }], review: [] } },
          'Offline legacy cache was not restored in memory'
        )
        equal(await snapshot(), before, 'Offline load changed persistent records or audio')
        assert(status === 'error' && pushes === 0, 'Offline load hid the error or pushed')
        offline = false
        rows[2].data_version = 2
        const retry = await session.load()
        assert(retry.taskWords.new[0].word === 'hello', 'Read recovery did not restore remote cache')
        assert(status === 'success' && pushes === 0, 'Read recovery status/push incorrect')
        equal(await snapshot(), before, 'Read recovery implicitly wrote current cache')
        cases.push({ mode, reopened: true, retry: true, pushes, legacyVersion: 1, persistedUnchanged: true })
        continue
      }
      const before = await snapshot()
      if (mode === 'queued-before-import') {
        queued = api.saveLocalAndSync(enums.SyncDataType.setting, { marker: 'stale' }, { canSyncRemote: false })
      }
      if (mode === 'queued-after-abort') {
        onSubmitted = () => {
          queued = api.saveLocalAndSync(enums.SyncDataType.setting, { marker: 'newer-edit' }, { canSyncRemote: false })
        }
      }
      fault = true
      let rejected = false
      if (mode === 'pull') {
        assert((await api.pullAllRemoteToLocal()) === false, 'Aborted pull reported success')
        assert(status === 'error', 'Aborted pull did not set error status')
      } else {
        try {
          await api.forcePushLocalDataToRemote(data, client, audio('new audio bytes'))
        } catch {
          rejected = true
        }
        assert(rejected, 'Aborted import did not reject')
      }
      await transactionSettled
      assert(submitted === (mode === 'pull' ? 4 : 5), 'Not all writes were submitted')
      assert(succeeded === 2 && aborted === 1, 'Abort did not follow two real successful requests')
      assert(pushes === 0, 'Failed transaction reached remote push')
      assert(base.$state.marker === 'old' && setting.$state.marker === 'old', 'In-memory state not restored')
      assert(!Object.hasOwn(setting.$state, 'added'), 'Rollback retained an imported setting')
      assert(base.$state.due instanceof Date && setting.$state.due instanceof Date, 'Rollback lost Date values')
      await queued
      const after = await snapshot()
      if (mode === 'queued-after-abort') {
        assert(JSON.parse(after[1]).val.marker === 'newer-edit', 'Queued newer save was lost')
        after[1] = before[1]
      }
      equal(after, before, 'Reopened database retained partial transaction writes')
      events.push('abort-reopened-and-verified')
      if (mode === 'pull') {
        assert(!config.Supabase.check(), 'Failed pull still authorizes automatic writes')
        assert(await api.pullAllRemoteToLocal(), 'Pull retry failed')
        assert(status === 'success', 'Pull retry did not clear error')
        assert(config.Supabase.getStatus().statusMessage === '', 'Pull retry retained stale error message')
      } else {
        assert(await api.forcePushLocalDataToRemote(data, client, audio('new audio bytes')), 'Import retry failed')
      }
      const retry = await snapshot()
      assert(JSON.parse(retry[0]).val.marker === 'new', 'Retry lost dictionary')
      assert(JSON.parse(retry[1]).val.marker === 'new', 'Retry lost settings')
      equal(JSON.parse(retry[2]).val.taskWordsStr.new, ['hello'], 'Retry lost word cache')
      assert(JSON.parse(retry[2]).version === 2, 'Cache migration/current version not persisted')
      assert(JSON.parse(retry[3]).val === null, 'Retry lost null article cache')
      equal(
        retry[4][0].bytes,
        [...new TextEncoder().encode(mode === 'pull' ? 'old audio bytes' : 'new audio bytes')],
        'Audio bytes not preserved'
      )
      assert(pushes === (mode === 'pull' ? 0 : 1), 'Unexpected remote push count')
      cases.push({ mode, submitted, succeeded, aborted, pushes, reopened: true, retry: true, events })
    } finally {
      account?.dispose()
      stopInit?.()
      localStorage.removeItem(config.SUPABASE_CONFIG_KEY)
      delete globalThis.useRuntimeConfig
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = resolve
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error('Integration database cleanup blocked'))
      })
    }
  }
  return {
    cases,
    boundaries: [
      'Real Chromium IndexedDB, installed idb-keyval, Vue reactivity and word-cache migrator',
      'Settings boundary/abort cases run real settings migration, defaults, shortcut map and cloneDeep declarations',
      'Dictionary migration/abort cases run real dictionary and settings migrators with source defaults',
      'Other cases dictionary migrator, non-settings/non-dictionary cases settings migrator, store methods and cloud client are test doubles',
      'Watcher cases execute full useInit subscriptions with production Pinia and real timers; minimal store schemas/actions, migration and cloud edges remain test doubles',
      'Account cases execute real account lifetime, shared persistence queue and cancellable four-key transactions; Auth/REST and store actions remain test doubles',
      'Explicit transaction abort, not quota exhaustion, crash recovery or native WebView UI',
      'Synthetic Blob bytes, not decodable audio or a ZIP/UI end-to-end test',
    ],
  }
}
