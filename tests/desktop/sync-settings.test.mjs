import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const source = readFileSync(resolve(root, 'app/pages/setting.vue'), 'utf8')
const choice = source.slice(
  source.indexOf('async function onSbFirstSyncChoice('),
  source.indexOf('function transferOk()')
)
const save = source.slice(
  source.indexOf('async function doSaveSbConfig()'),
  source.indexOf('function removeSbConfig()')
)
function harness(options = {}) {
  const events = []
  const savedConfigs = []
  const createdConfigs = []
  let status = 'idle'
  const client = {
    from() {
      return {
        select(fields) {
          if (fields === 'type') {
            options.onCheck?.()
            return Promise.resolve({
              data: options.missingRows
                ? []
                : [{ type: 'dict' }, { type: 'setting' }, { type: 'practice_word' }, { type: 'practice_article' }],
            })
          }
          return { in: () => ({ not: async () => ({ data: options.remoteData ? [{ type: 'dict' }] : [] }) }) }
        },
        async insert() {
          events.push('insert')
          return { error: { message: 'insert denied' } }
        },
      }
    },
  }
  const create = (url, key) => {
    if (options.invalid) throw Error('invalid URL')
    createdConfigs.push({ url, key })
    return client
  }
  const sandbox = {
    exports: {},
    configLoading: false,
    showBackupGate: true,
    tempSbInstance: null,
    tempSbConfig: null,
    sbSyncChoiceLoading: false,
    showSbFirstSyncChoiceDialog: false,
    sbForm: { url: 'https://fixture.supabase.co', key: 'test-key' },
    config: { public: { isDesktop: Boolean(options.desktop) } },
    sbStatus: {},
    createClient: create,
    createSyncClient: create,
    t: value => value,
    getExportedData: async () => ({ val: {} }),
    dataSyncPersistence: {
      forcePushLocalDataToRemote: async () => {
        events.push('push')
        await options.onPush?.()
        return !options.pushFails
      },
      pullAllRemoteToLocal: async () => {
        events.push('pull')
        await options.onPull?.()
        return true
      },
    },
    Supabase: {
      setStatus: value => {
        status = value
      },
      getStatus: () => ({ status }),
      saveConfig: (url, key) => {
        events.push('save-config')
        savedConfigs.push({ url, key })
      },
    },
    Toast: { success: value => events.push(value), error: value => events.push(`error:${value}`) },
    transferOk: () => events.push('redirect'),
  }
  runInNewContext(
    ts.transpileModule(choice + save + '\nexports.save = doSaveSbConfig; exports.choose = onSbFirstSyncChoice', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    sandbox
  )
  return { sandbox, events, savedConfigs, createdConfigs, status: () => status }
}

test('local desktop config save and first-sync actions cannot create clients or transfer data', async () => {
  const h = harness({ desktop: true })
  await h.sandbox.exports.save()
  h.sandbox.tempSbInstance = {
    from: () => {
      throw Error('must not query')
    },
  }
  h.sandbox.tempSbConfig = { url: 'https://fixture.supabase.co', key: 'synthetic' }
  assert.equal(await h.sandbox.exports.choose('push_local'), false)
  assert.equal(await h.sandbox.exports.choose('pull_remote'), false)
  assert.deepEqual(h.events, [])
  assert.deepEqual(h.createdConfigs, [])
  assert.deepEqual(h.savedConfigs, [])
})

test('invalid sync client creation is caught and always resets configuration loading', async () => {
  const h = harness({ invalid: true })
  await h.sandbox.exports.save()
  assert.equal(h.sandbox.configLoading, false)
  assert.equal(h.status(), 'error')
  assert.ok(h.events.some(event => event.includes('invalid URL')))
})

test('failed first push never saves credentials, reports success or redirects', async () => {
  const h = harness({ pushFails: true })
  await h.sandbox.exports.save()
  assert.equal(h.sandbox.configLoading, false)
  assert.equal(h.status(), 'error')
  assert.ok(h.events.includes('push'))
  for (const event of ['save-config', 'save_success', 'redirect']) assert.ok(!h.events.includes(event), event)
})

test('failed table initialization does not continue to push or save credentials', async () => {
  const h = harness({ missingRows: true })
  await h.sandbox.exports.save()
  assert.equal(h.status(), 'error')
  assert.equal(h.sandbox.configLoading, false)
  for (const event of ['push', 'save-config', 'save_success', 'redirect']) assert.ok(!h.events.includes(event), event)
})

test('successful first sync saves configuration once and redirects only after push', async () => {
  const h = harness()
  await h.sandbox.exports.save()
  assert.equal(h.status(), 'success')
  assert.equal(h.sandbox.configLoading, false)
  assert.equal(h.events.filter(event => event === 'save-config').length, 1)
  assert.ok(h.events.indexOf('push') < h.events.indexOf('save-config'))
  assert.ok(h.events.indexOf('save-config') < h.events.indexOf('redirect'))
})

test('editing the form during verification never saves unverified credentials', async () => {
  const h = harness({
    onCheck() {
      h.sandbox.sbForm = { url: 'https://unverified.supabase.co', key: 'other-key' }
    },
  })
  await h.sandbox.exports.save()
  assert.deepEqual(h.savedConfigs, h.createdConfigs)
  assert.equal(h.savedConfigs[0].url, 'https://fixture.supabase.co')
})

for (const action of ['push_local', 'pull_remote']) {
  test(`delayed ${action} choice retains the verified client credentials`, async () => {
    const h = harness({ remoteData: true })
    await h.sandbox.exports.save()
    assert.equal(h.sandbox.showSbFirstSyncChoiceDialog, true)
    h.sandbox.sbForm = { url: 'https://unverified.supabase.co', key: 'other-key' }
    assert.equal(await h.sandbox.exports.choose(action), true)
    assert.deepEqual(h.savedConfigs, h.createdConfigs)
    assert.equal(h.sandbox.tempSbInstance, null)
    assert.equal(h.sandbox.tempSbConfig, null)
    assert.equal(await h.sandbox.exports.choose(action), false)
    assert.equal(h.savedConfigs.length, 1)
  })
}

test('a pending first-sync dialog cannot be replaced by another configuration attempt', async () => {
  const h = harness({ remoteData: true })
  await h.sandbox.exports.save()
  h.sandbox.sbForm = { url: 'https://other.supabase.co', key: 'other-key' }
  await h.sandbox.exports.save()
  assert.equal(h.createdConfigs.length, 1)
})

test('an active first-sync request cannot be replaced even after its dialog is dismissed', async () => {
  let finish
  const pending = new Promise(resolve => (finish = resolve))
  const h = harness({ remoteData: true, onPush: () => pending })
  await h.sandbox.exports.save()
  const choosing = h.sandbox.exports.choose('push_local')
  h.sandbox.showSbFirstSyncChoiceDialog = false
  h.sandbox.sbForm = { url: 'https://other.supabase.co', key: 'other-key' }
  try {
    await h.sandbox.exports.save()
    assert.equal(h.createdConfigs.length, 1)
  } finally {
    finish()
    await choosing
  }
})

test('a choice without a verified session never falls back to a persisted client', async () => {
  const h = harness()
  assert.equal(await h.sandbox.exports.choose('push_local'), false)
  assert.deepEqual(h.events, [])
})

test('failed first sync can retry the verified session without adopting edited credentials', async () => {
  const options = { remoteData: true, pushFails: true }
  const h = harness(options)
  await h.sandbox.exports.save()
  assert.equal(await h.sandbox.exports.choose('push_local'), false)
  assert.equal(h.sandbox.sbSyncChoiceLoading, false)
  assert.deepEqual(h.savedConfigs, [])
  h.sandbox.sbForm = { url: 'https://other.supabase.co', key: 'other-key' }
  options.pushFails = false
  assert.equal(await h.sandbox.exports.choose('push_local'), true)
  assert.deepEqual(h.savedConfigs, h.createdConfigs)
})

test('dismissing an idle choice allows a new configuration to be verified', async () => {
  const h = harness({ remoteData: true })
  await h.sandbox.exports.save()
  h.sandbox.showSbFirstSyncChoiceDialog = false
  h.sandbox.sbForm = { url: 'https://other.supabase.co', key: 'other-key' }
  await h.sandbox.exports.save()
  assert.equal(h.createdConfigs.length, 2)
  assert.equal(await h.sandbox.exports.choose('pull_remote'), true)
  assert.deepEqual(h.savedConfigs, [h.createdConfigs[1]])
})
