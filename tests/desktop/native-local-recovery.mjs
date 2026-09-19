// Explicit native integration runner. Never included in the default Node suite.
// The caller must launch the current EXE with a fresh, recorded isolated profile.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { backupSeedScript } from './backup-browser-seed.mjs'

const [mode, evidencePath] = process.argv.slice(2)
assert.ok(
  [
    'prepare',
    'cancelled',
    'gate',
    'save-failure',
    'save-retry',
    'matrix',
    'cache-errors',
    'source-errors',
    'restart',
  ].includes(mode),
  'Use prepare, cancelled, gate, save-failure, save-retry, matrix, cache-errors, source-errors or restart and an evidence directory'
)
assert.ok(evidencePath, 'An explicit evidence directory is required')
const evidence = resolve(evidencePath)
const launch = JSON.parse(
  readFileSync(
    resolve(evidence, existsSync(resolve(evidence, 'restart.json')) ? 'restart.json' : 'launch.json'),
    'utf8'
  ).replace(/^\uFEFF/, '')
)
assert.equal(resolve(launch.profile), resolve(evidence, 'isolated-profile'))
assert.equal(createHash('sha256').update(readFileSync(launch.exe)).digest('hex'), launch.sha256.toLowerCase())
const modulePath = process.env.TYPEWORDS_PLAYWRIGHT_MODULE
assert.ok(modulePath, 'Set TYPEWORDS_PLAYWRIGHT_MODULE to the installed Playwright module')
const { chromium } = await import(pathToFileURL(modulePath).href)
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${launch.port}`)
const context = browser.contexts()[0]
const page = context.pages().find(page => page.url().startsWith('http://tauri.localhost'))
assert.ok(page, 'Expected the isolated production Tauri page')
const external = []
const errors = []
page.on('pageerror', error => errors.push(error.message))
await context.route(/^https:\/\//, route => {
  external.push(route.request().url())
  return route.abort()
})
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function ready() {
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$pinia
    return pinia?._s.get('base')?.load && pinia?._s.get('setting')?.load
  })
}
async function snapshot() {
  return page.evaluate(async () => {
    const request = indexedDB.open('keyval-store')
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const keys = [
      'typing-word-dict',
      'typing-word-setting',
      'PracticeSaveWord',
      'PracticeSaveArticle',
      'typing-word-files',
    ]
    const disk = {}
    try {
      const tx = db.transaction('keyval', 'readonly')
      await Promise.all(
        keys.map(
          key =>
            new Promise((resolve, reject) => {
              const request = tx.objectStore('keyval').get(key)
              request.onsuccess = () => {
                disk[key] = request.result ?? null
                resolve()
              }
              request.onerror = () => reject(request.error)
            })
        )
      )
      if (disk['typing-word-files']) {
        disk['typing-word-files'] = await Promise.all(
          disk['typing-word-files'].map(async item => ({
            id: item.id,
            bytes: Array.from(new Uint8Array(await item.file.arrayBuffer())),
          }))
        )
      }
    } finally {
      db.close()
    }
    const pinia = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia
    const clean = state => {
      const value = JSON.parse(JSON.stringify(state))
      delete value._ignoreWatch
      return value
    }
    return {
      disk,
      base: clean(pinia._s.get('base').$state),
      setting: clean(pinia._s.get('setting').$state),
      globalLoading: pinia._s.get('runtime').globalLoading,
      config: localStorage.getItem('supabase_config'),
    }
  })
}
const save = (name, value) => writeFileSync(resolve(evidence, name), JSON.stringify(value, null, 2))
const readonlyTarget = resolve(evidence, 'selected-readonly.zip')
let ownsReadonlyTarget = false
try {
  if (['prepare', 'restart', 'cache-errors', 'source-errors'].includes(mode)) {
    await page.goto('http://tauri.localhost/setting?index=5')
  }
  await ready()
  const identity = await page.evaluate(() => ({
    origin: location.origin,
    desktop: window.__NUXT__?.config?.public?.isDesktop,
    ipc: typeof window.__TAURI_INTERNALS__?.invoke === 'function',
    ua: navigator.userAgent,
  }))
  assert.equal(identity.origin, 'http://tauri.localhost')
  assert.equal(identity.desktop, true)
  assert.equal(identity.ipc, true)
  if (mode === 'prepare') {
    await page.goto('http://tauri.localhost/setting?index=5')
    await ready()
    const seeded = await page.evaluate(`(${backupSeedScript()})()`)
    assert.equal(seeded.audioBytes, 2943, 'Synthetic seed must execute, not return a function')
    await pause(1800)
    await page.evaluate(() =>
      localStorage.setItem(
        'supabase_config',
        JSON.stringify({
          url: 'https://synthetic-local-only.supabase.co',
          key: 'synthetic-not-a-secret',
          status: 'error',
          error: 'synthetic previous failure',
        })
      )
    )
    await page.reload()
    await ready()
    await pause(1600)
    const baseline = await snapshot()
    for (const [key, value] of Object.entries(baseline.disk)) {
      assert.notEqual(value, null, `Seed must populate ${key}`)
    }
    assert.equal(baseline.base.noteData.fixture, 'ZIP semantic round-trip')
    assert.equal(baseline.disk['typing-word-files'][0].bytes.length, seeded.audioBytes)
    save('baseline.json', baseline)
    await page.getByText(/^(Import Data Restore|导入数据恢复)$/).click()
    await page.getByText('数据备份', { exact: true }).last().waitFor()
    assert.equal(await page.locator('input[type=file]').count(), 0, 'Native backup must unlock import')
    save('prepare.json', { identity, external, errors })
    console.log('Prepared actual stores and audio; backup gate locked. Complete native backup before matrix.')
  } else if (mode === 'gate') {
    await page.getByText(/^(Import Data Restore|导入数据恢复)$/).click()
    await page.getByText('数据备份', { exact: true }).last().waitFor()
    assert.equal(await page.locator('input[type=file]').count(), 0)
    save('expected-restart.json', await snapshot())
    console.log('Backup gate reopened on current native candidate.')
  } else if (mode === 'cancelled') {
    assert.equal(await page.locator('input[type=file]').count(), 0)
    assert.equal(await page.locator('.message.success').count(), 0)
    assert.deepEqual(await snapshot(), JSON.parse(readFileSync(resolve(evidence, 'baseline.json'))))
    await page.screenshot({ path: resolve(evidence, 'save-cancelled.png') })
    save('cancelled.json', { identity, gateLocked: true, dataUnchanged: true, successToast: false, external, errors })
    console.log('PASS: cancelled native save keeps gate locked, with no success or data changes.')
  } else if (mode === 'save-failure' || mode === 'save-retry') {
    const failing = mode === 'save-failure'
    const target = failing ? readonlyTarget : resolve(evidence, 'retry-backup.zip')
    assert.equal(existsSync(target), false, 'Never overwrite an existing evidence file')
    const baseline = JSON.parse(readFileSync(resolve(evidence, 'baseline.json')))
    assert.deepEqual(await snapshot(), baseline)
    assert.equal(await page.locator('input[type=file]').count(), 0)
    if (!page.url().includes('/setting')) {
      await page.goto('http://tauri.localhost/setting?index=5')
      await ready()
      assert.deepEqual(await snapshot(), baseline)
    }
    if ((await page.getByText('数据备份', { exact: true }).count()) < 2) {
      await page
        .getByText(/^(Import Data Restore|导入数据恢复)$/)
        .first()
        .click()
      await page.getByText('数据备份', { exact: true }).last().waitFor()
    }
    // Observe real IPC and pause only the write, after the real picker grants its path.
    // No dialog, permission result, filesystem call or error is replaced.
    await page.evaluate(failing => {
      const originalFetch = window.fetch
      const urls = new Map(
        ['plugin:dialog|save', 'plugin:fs|write_file'].map(command => [
          window.__TAURI_INTERNALS__.convertFileSrc(command, 'ipc'),
          command,
        ])
      )
      window.__nativeSaveProbe = { calls: [], release: !failing }
      window.__nativeSaveRestore = () => {
        window.fetch = originalFetch
      }
      const observedFetch = async function (url, options) {
        const command = urls.get(String(url))
        if (!command) return originalFetch.call(this, url, options)
        const state = window.__nativeSaveProbe
        const call = { command }
        state.calls.push(call)
        if (command === 'plugin:fs|write_file') {
          call.path = decodeURIComponent(new Headers(options.headers).get('path'))
          state.waiting = true
          const deadline = Date.now() + 30000
          while (!state.release) {
            if (Date.now() > deadline) throw new Error('TEST write release timeout')
            await new Promise(resolve => setTimeout(resolve, 25))
          }
        }
        const response = await originalFetch.call(this, url, options)
        call.ok = response.headers.get('Tauri-Response') === 'ok'
        const raw = await response.clone().text()
        let value = raw
        try {
          value = JSON.parse(raw)
        } catch {}
        if (command === 'plugin:dialog|save' && call.ok) call.path = value
        if (!call.ok) call.error = String(value)
        return response
      }
      window.fetch = observedFetch
      if (window.fetch !== observedFetch) throw new Error('Cannot install native save observer')
    }, failing)
    await page.getByText('数据备份', { exact: true }).last().click()
    console.log(`Select this exact new path in the native Save dialog: ${target}`)
    await page.waitForFunction(() => window.__nativeSaveProbe.waiting, null, { timeout: 600000 })
    const selected = await page.evaluate(() => window.__nativeSaveProbe.calls)
    assert.equal(resolve(selected.find(call => call.command === 'plugin:dialog|save').path), target)
    assert.equal(resolve(selected.find(call => call.command === 'plugin:fs|write_file').path), target)
    const sentinel = 'Synthetic selected target: failed write must preserve these bytes.'
    if (failing) {
      writeFileSync(target, sentinel, { flag: 'wx' })
      ownsReadonlyTarget = true
      chmodSync(target, 0o444)
      await page.evaluate(() => (window.__nativeSaveProbe.release = true))
    }
    const toast = page.locator(failing ? '.message.error' : '.message.success')
    await toast.waitFor()
    const text = await toast.innerText()
    const probe = await page.evaluate(() => window.__nativeSaveProbe)
    assert.equal(probe.calls.length, 2)
    assert.equal(probe.calls[0].ok, true, 'Real picker returned a selected path')
    assert.equal(probe.calls[1].ok, !failing)
    if (failing) {
      assert.match(probe.calls[1].error, /os error 5|access.*denied|拒绝访问/i)
      assert.ok(text.includes(probe.calls[1].error), 'UI must display the actual native write failure')
      assert.equal(readFileSync(target, 'utf8'), sentinel)
      assert.equal(await page.locator('input[type=file]').count(), 0)
      assert.equal(await page.locator('.message.success').count(), 0)
    } else {
      await page.locator('input[type=file]').waitFor({ state: 'attached' })
      const require = createRequire(import.meta.url)
      const JSZip = require(resolve('public/libs/jszip.min.js'))
      const zip = await JSZip.loadAsync(readFileSync(target))
      const backup = JSON.parse(await zip.file('data.json').async('string'))
      assert.equal(backup.val.setting.val.wordSoundVolume, baseline.setting.wordSoundVolume)
      assert.deepEqual(backup.val.dict.val.noteData, baseline.base.noteData)
      for (const audio of baseline.disk['typing-word-files']) {
        assert.deepEqual([...(await zip.file(`mp3/${audio.id}.mp3`).async('uint8array'))], audio.bytes)
      }
    }
    await pause(1600)
    assert.deepEqual(await snapshot(), baseline, 'Save failure/retry must preserve disk, audio and actual stores')
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [])
    await page.screenshot({ path: resolve(evidence, `${mode}.png`) })
    save(`${mode}.json`, { identity, probe, text, dataUnchanged: true, gateLocked: failing, external, errors })
    console.log(
      `PASS: real native ${failing ? 'read-only write failure keeps gate locked' : 'save retry unlocks gate and produces a readable ZIP with original audio'}.`
    )
  } else if (mode === 'matrix') {
    await page.locator('input[type=file]').waitFor({ state: 'attached' })
    const before = await snapshot()
    const baseline = JSON.parse(
      readFileSync(
        resolve(
          evidence,
          existsSync(resolve(evidence, 'expected-restart.json')) ? 'expected-restart.json' : 'baseline.json'
        )
      )
    )
    assert.deepEqual(before, baseline, 'Native backup must not alter learning data')
    const require = createRequire(import.meta.url)
    const JSZip = require(resolve('public/libs/jszip.min.js'))
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/backup/backup-fixture.json', import.meta.url)))
    // The historical round-trip fixture predates complete synthetic statistics.
    for (const key of ['PracticeSaveWord', 'PracticeSaveArticle']) {
      Object.assign(fixture.val[key].val.statStoreData, { stage: 0, inputWordNumber: 3 })
    }
    fixture.val.dict.val.noteData.fixture = 'Native local recovery retry'
    fixture.val.setting.val.wordSoundVolume = 61
    const audio = readFileSync(new URL('./fixtures/backup/backup-tone.mp3', import.meta.url))
    const zip = async (data, withAudio = true) => {
      const archive = new JSZip().file('data.json', JSON.stringify(data))
      if (withAudio) archive.file('mp3/backup-tone.mp3', audio)
      return archive.generateAsync({ type: 'nodebuffer' })
    }
    const valid = await zip(fixture)
    const cases = [
      ['corrupt-zip', Buffer.from('not a zip'), "Can't find end of central directory"],
      ['unsupported-version', await zip({ ...fixture, version: 999 }), 'Invalid or unsupported backup schema'],
      ['missing-audio', await zip(fixture, false), 'Missing backup audio'],
    ]
    const results = []
    for (const [name, buffer, message] of cases) {
      await page.locator('input[type=file]').setInputFiles({ name: `${name}.zip`, mimeType: 'application/zip', buffer })
      const toast = page.locator('.message.error')
      await toast.waitFor()
      const text = await toast.innerText()
      assert.ok(text.includes(message), `${name}: expected ${message}, received ${text}`)
      await pause(1600)
      assert.deepEqual(await snapshot(), before, `${name}: disk, audio and actual store state unchanged`)
      assert.equal(await page.locator('.message.success').count(), 0, `${name}: no false success`)
      results.push({ name, text, unchanged: true })
      save('matrix-partial.json', results)
      await toast.waitFor({ state: 'detached' })
    }
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put
      window.__nativeAbortRestore = () => {
        IDBObjectStore.prototype.put = original
      }
      window.__nativeAbort = { puts: 0, successes: 0, aborts: 0 }
      IDBObjectStore.prototype.put = function (...args) {
        const result = original.apply(this, args)
        const state = window.__nativeAbort
        state.puts++
        result.addEventListener(
          'success',
          () => {
            state.successes++
            if (state.successes === 2) {
              this.transaction.addEventListener('abort', () => state.aborts++, { once: true })
              this.transaction.abort()
              IDBObjectStore.prototype.put = original
            }
          },
          { once: true }
        )
        return result
      }
    })
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'valid.zip', mimeType: 'application/zip', buffer: valid })
    await page.locator('.message.error').waitFor()
    const abortText = await page.locator('.message.error').innerText()
    assert.ok(abortText.includes('Local backup transaction failed'), abortText)
    await pause(1800)
    const abort = await page.evaluate(() => window.__nativeAbort)
    assert.deepEqual(abort, { puts: 5, successes: 2, aborts: 1 })
    assert.deepEqual(
      await snapshot(),
      before,
      'Real transaction abort restores actual memory and all five persisted keys'
    )
    assert.equal(await page.locator('.message.success').count(), 0)
    await page.screenshot({ path: resolve(evidence, 'transaction-abort.png') })
    results.push({ name: 'transaction-abort', text: abortText, ...abort, unchanged: true })
    await page.locator('.message.error').waitFor({ state: 'detached' })
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'valid.zip', mimeType: 'application/zip', buffer: valid })
    await page.locator('.message.success').waitFor()
    const successText = await page.locator('.message.success').innerText()
    const after = await snapshot()
    assert.equal(after.base.noteData.fixture, 'Native local recovery retry')
    assert.equal(after.setting.wordSoundVolume, 61)
    assert.equal(after.globalLoading, false)
    assert.equal(after.config, before.config)
    assert.deepEqual(after.disk['typing-word-files'], [{ id: 'backup-tone', bytes: [...audio] }])
    assert.equal(JSON.parse(after.disk['typing-word-setting']).val.wordSoundVolume, 61)
    assert.equal(JSON.parse(after.disk['typing-word-dict']).val.noteData.fixture, 'Native local recovery retry')
    assert.equal(await page.locator('input[type=file]').count(), 0, 'Successful import closes backup gate')
    // An edit inside the debounce window must persist through the real subscriptions.
    await page.evaluate(() => {
      const p = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia
      p._s.get('setting').wordSoundVolume = 62
      p._s.get('base').noteData.fixture = 'Native local recovery edited'
    })
    await pause(1600)
    const edited = await snapshot()
    assert.equal(JSON.parse(edited.disk['typing-word-setting']).val.wordSoundVolume, 62)
    assert.equal(JSON.parse(edited.disk['typing-word-dict']).val.noteData.fixture, 'Native local recovery edited')
    save('expected-restart.json', edited)
    assert.deepEqual(external, [], 'No external request, including retained sync config')
    assert.deepEqual(errors, [])
    save('matrix.json', { identity, results, successText, editedAfterRetry: true, external, errors })
    await page.screenshot({ path: resolve(evidence, 'retry-success.png') })
    console.log('PASS: 3 invalid ZIP cases, real five-key abort, retry, actual store autosave and local-only config.')
  } else if (mode === 'cache-errors') {
    if (!page.url().includes('/setting')) {
      await page.goto('http://tauri.localhost/setting?index=5')
      await ready()
    }
    const before = await snapshot()
    assert.ok(before.disk['typing-word-files']?.[0]?.bytes?.length === 2943, 'Isolated profile must keep custom audio')
    assert.equal(await page.locator('input[type=file]').count(), 0, 'Start with the backup gate closed')
    const unlockTarget = resolve(evidence, 'cache-ui-unlock.zip')
    assert.equal(existsSync(unlockTarget), false, 'Never overwrite an existing evidence file')
    if ((await page.getByText('数据备份', { exact: true }).count()) < 2) {
      await page
        .getByText(/^(Import Data Restore|导入数据恢复)$/)
        .first()
        .click()
      await page.getByText('数据备份', { exact: true }).last().waitFor()
    }
    await page.evaluate(() => {
      const originalFetch = window.fetch
      const urls = new Map(
        ['plugin:dialog|save', 'plugin:fs|write_file'].map(command => [
          window.__TAURI_INTERNALS__.convertFileSrc(command, 'ipc'),
          command,
        ])
      )
      window.__nativeSaveProbe = { calls: [] }
      window.__nativeSaveRestore = () => {
        window.fetch = originalFetch
      }
      const observedFetch = async function (url, options) {
        const command = urls.get(String(url))
        if (!command) return originalFetch.call(this, url, options)
        const call = { command }
        window.__nativeSaveProbe.calls.push(call)
        const response = await originalFetch.call(this, url, options)
        call.ok = response.headers.get('Tauri-Response') === 'ok'
        const raw = await response.clone().text()
        let value = raw
        try {
          value = JSON.parse(raw)
        } catch {}
        if (command === 'plugin:dialog|save' && call.ok) call.path = value
        if (command === 'plugin:fs|write_file') {
          call.path = decodeURIComponent(new Headers(options.headers).get('path') || '')
        }
        if (!call.ok) call.error = String(value)
        return response
      }
      window.fetch = observedFetch
      if (window.fetch !== observedFetch) throw new Error('Cannot install native save observer')
    })
    await page.getByText('数据备份', { exact: true }).last().click()
    console.log(`Select this exact new path in the native Save dialog: ${unlockTarget}`)
    await page.locator('input[type=file]').waitFor({ state: 'attached', timeout: 120000 })
    const unlockToast = page.locator('.message.success')
    await unlockToast.waitFor()
    const unlockText = await unlockToast.innerText()
    const probe = await page.evaluate(() => window.__nativeSaveProbe)
    assert.equal(probe.calls.length, 2)
    assert.equal(probe.calls[0].ok, true, 'Real picker returned a selected path')
    assert.equal(probe.calls[1].ok, true, 'Real write_file must unlock the gate')
    assert.equal(resolve(probe.calls[0].path), unlockTarget)
    assert.equal(resolve(probe.calls[1].path), unlockTarget)
    assert.ok(existsSync(unlockTarget), 'Unlock must produce a real ZIP')
    await unlockToast.waitFor({ state: 'detached' })
    assert.deepEqual(await snapshot(), before, 'Unlock export must not change disk, audio or stores')
    const require = createRequire(import.meta.url)
    const JSZip = require(resolve('public/libs/jszip.min.js'))
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/backup/backup-fixture.json', import.meta.url)))
    for (const key of ['PracticeSaveWord', 'PracticeSaveArticle']) {
      Object.assign(fixture.val[key].val.statStoreData, { stage: 0, inputWordNumber: 3 })
    }
    const audio = readFileSync(new URL('./fixtures/backup/backup-tone.mp3', import.meta.url))
    const zip = async data => {
      const archive = new JSZip().file('data.json', JSON.stringify(data))
      archive.file('mp3/backup-tone.mp3', audio)
      return archive.generateAsync({ type: 'nodebuffer' })
    }
    const clone = () => JSON.parse(JSON.stringify(fixture))
    const emptyWord = clone()
    emptyWord.val.PracticeSaveWord.val.taskWordsStr.new = ['']
    const negativeIndex = clone()
    negativeIndex.val.PracticeSaveWord.val.practiceData.index = -1
    const shortcut = clone()
    shortcut.val.setting.val.shortcutKeyMap = { ShowWord: 1 }
    const emptyBooks = clone()
    emptyBooks.val.dict.val.word.bookList = []
    const cases = [
      ['empty-cache-word', await zip(emptyWord), 'Invalid backup practice cache'],
      ['negative-word-index', await zip(negativeIndex), 'Invalid backup practice cache'],
      ['invalid-shortcut-map', await zip(shortcut), 'Invalid backup settings'],
      ['empty-word-booklist', await zip(emptyBooks), 'Invalid backup dictionary'],
    ]
    const results = []
    for (const [name, buffer, message] of cases) {
      await page.locator('input[type=file]').setInputFiles({
        name: `${name}.zip`,
        mimeType: 'application/zip',
        buffer,
      })
      const toast = page.locator('.message.error')
      await toast.waitFor()
      const text = await toast.innerText()
      assert.ok(text.includes(message), `${name}: expected ${message}, received ${text}`)
      await pause(1600)
      assert.deepEqual(await snapshot(), before, `${name}: disk, audio and actual store state unchanged`)
      assert.equal(await page.locator('.message.success').count(), 0, `${name}: no false success`)
      results.push({ name, text, unchanged: true })
      save('cache-errors-partial.json', results)
      await toast.waitFor({ state: 'detached' })
    }
    await page.keyboard.press('Escape')
    await page.locator('input[type=file]').waitFor({ state: 'detached' })
    assert.deepEqual(
      await snapshot(),
      before,
      'Rejected cache/settings/dictionary ZIPs must leave isolated data intact'
    )
    assert.deepEqual(external, [], 'No external request, including retained sync config')
    assert.deepEqual(errors, [])
    const tabs = await page.locator('.tab').allTextContents()
    assert.equal(tabs.length, 9)
    assert.ok(!tabs.some(text => /sync|同步/i.test(text)))
    await page.screenshot({ path: resolve(evidence, 'cache-errors.png') })
    save('cache-errors.json', {
      identity,
      probe,
      unlockText,
      unlockBytes: readFileSync(unlockTarget).length,
      results,
      tabs,
      note: before.base.noteData.fixture,
      volume: before.setting.wordSoundVolume,
      external,
      errors,
    })
    console.log('PASS: native cache/settings/dictionary reject UI on isolated 0.1.3; data unchanged.')
  } else if (mode === 'source-errors') {
    if (!page.url().includes('/setting')) {
      await page.goto('http://tauri.localhost/setting?index=5')
      await ready()
    }
    const before = await snapshot()
    assert.ok(before.disk['typing-word-files']?.[0]?.bytes?.length === 2943, 'Isolated profile must keep custom audio')
    assert.equal(await page.locator('input[type=file]').count(), 0, 'Start with the backup gate closed')
    const unlockTarget = resolve(evidence, 'source-ui-unlock.zip')
    assert.equal(existsSync(unlockTarget), false, 'Never overwrite an existing evidence file')
    if ((await page.getByText('数据备份', { exact: true }).count()) < 2) {
      await page
        .getByText(/^(Import Data Restore|导入数据恢复)$/)
        .first()
        .click()
      await page.getByText('数据备份', { exact: true }).last().waitFor()
    }
    await page.evaluate(() => {
      const originalFetch = window.fetch
      const urls = new Map(
        ['plugin:dialog|save', 'plugin:fs|write_file'].map(command => [
          window.__TAURI_INTERNALS__.convertFileSrc(command, 'ipc'),
          command,
        ])
      )
      window.__nativeSaveProbe = { calls: [] }
      window.__nativeSaveRestore = () => {
        window.fetch = originalFetch
      }
      const observedFetch = async function (url, options) {
        const command = urls.get(String(url))
        if (!command) return originalFetch.call(this, url, options)
        const call = { command }
        window.__nativeSaveProbe.calls.push(call)
        const response = await originalFetch.call(this, url, options)
        call.ok = response.headers.get('Tauri-Response') === 'ok'
        const raw = await response.clone().text()
        let value = raw
        try {
          value = JSON.parse(raw)
        } catch {}
        if (command === 'plugin:dialog|save' && call.ok) call.path = value
        if (command === 'plugin:fs|write_file') {
          call.path = decodeURIComponent(new Headers(options.headers).get('path') || '')
        }
        if (!call.ok) call.error = String(value)
        return response
      }
      window.fetch = observedFetch
      if (window.fetch !== observedFetch) throw new Error('Cannot install native save observer')
    })
    await page.getByText('数据备份', { exact: true }).last().click()
    console.log(`Select this exact new path in the native Save dialog: ${unlockTarget}`)
    await page.locator('input[type=file]').waitFor({ state: 'attached', timeout: 120000 })
    const unlockToast = page.locator('.message.success')
    await unlockToast.waitFor()
    const unlockText = await unlockToast.innerText()
    const probe = await page.evaluate(() => window.__nativeSaveProbe)
    assert.equal(probe.calls.length, 2)
    assert.equal(probe.calls[0].ok, true, 'Real picker returned a selected path')
    assert.equal(probe.calls[1].ok, true, 'Real write_file must unlock the gate')
    assert.equal(resolve(probe.calls[0].path), unlockTarget)
    assert.equal(resolve(probe.calls[1].path), unlockTarget)
    assert.ok(existsSync(unlockTarget), 'Unlock must produce a real ZIP')
    await unlockToast.waitFor({ state: 'detached' })
    assert.deepEqual(await snapshot(), before, 'Unlock export must not change disk, audio or stores')
    const require = createRequire(import.meta.url)
    const JSZip = require(resolve('public/libs/jszip.min.js'))
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/backup/backup-fixture.json', import.meta.url)))
    for (const key of ['PracticeSaveWord', 'PracticeSaveArticle']) {
      Object.assign(fixture.val[key].val.statStoreData, { stage: 0, inputWordNumber: 3 })
    }
    const audio = readFileSync(new URL('./fixtures/backup/backup-tone.mp3', import.meta.url))
    const zip = async data => {
      const archive = new JSZip().file('data.json', JSON.stringify(data))
      archive.file('mp3/backup-tone.mp3', audio)
      return archive.generateAsync({ type: 'nodebuffer' })
    }
    const clone = () => JSON.parse(JSON.stringify(fixture))
    const emptyWord = clone()
    const custom = emptyWord.val.dict.val.word.bookList.find(book => book.enName === 'backup-custom')
    assert.ok(custom, 'Fixture must include the backup-custom word book')
    custom.words = [{ word: '' }]
    const inverted = clone()
    inverted.val.setting.val.fsrsEasyLimit = 4
    inverted.val.setting.val.fsrsGoodLimit = 2
    const question = clone()
    question.val.PracticeSaveWord.val.practiceData.question = {
      candidates: [
        { word: { word: 'hello' }, similarity: 1 },
        { word: { word: 'world' }, similarity: 0.2 },
      ],
      correctIndex: 1,
    }
    const loop = clone()
    loop.val.PracticeSaveWord.val.sessionSnapshot.cursor.loop = { startIndex: 0, endIndex: 6, subStepIndex: 1 }
    const cases = [
      ['empty-word-identifier', await zip(emptyWord), 'Invalid backup dictionary'],
      ['inverted-fsrs-limits', await zip(inverted), 'Invalid backup settings'],
      ['question-correct-mismatch', await zip(question), 'Invalid backup practice cache'],
      ['cursor-loop-past-list', await zip(loop), 'Invalid backup practice cache'],
    ]
    const results = []
    for (const [name, buffer, message] of cases) {
      await page.locator('input[type=file]').setInputFiles({
        name: `${name}.zip`,
        mimeType: 'application/zip',
        buffer,
      })
      const toast = page.locator('.message.error')
      await toast.waitFor()
      const text = await toast.innerText()
      assert.ok(text.includes(message), `${name}: expected ${message}, received ${text}`)
      await pause(1600)
      assert.deepEqual(await snapshot(), before, `${name}: disk, audio and actual store state unchanged`)
      assert.equal(await page.locator('.message.success').count(), 0, `${name}: no false success`)
      results.push({ name, text, unchanged: true })
      save('source-errors-partial.json', results)
      await toast.waitFor({ state: 'detached' })
    }
    await page.keyboard.press('Escape')
    await page.locator('input[type=file]').waitFor({ state: 'detached' })
    assert.deepEqual(await snapshot(), before, 'Rejected source-boundary ZIPs must leave isolated data intact')
    assert.deepEqual(external, [], 'No external request, including retained sync config')
    assert.deepEqual(errors, [])
    const tabs = await page.locator('.tab').allTextContents()
    assert.equal(tabs.length, 9)
    assert.ok(!tabs.some(text => /sync|同步/i.test(text)))
    await page.screenshot({ path: resolve(evidence, 'source-errors.png') })
    save('source-errors.json', {
      identity,
      probe,
      unlockText,
      unlockBytes: readFileSync(unlockTarget).length,
      results,
      tabs,
      note: before.base.noteData.fixture,
      volume: before.setting.wordSoundVolume,
      productVersion: launch.productVersion,
      exeSha256: launch.sha256,
      external,
      errors,
    })
    console.log('PASS: native source-boundary ZIP/settings/dictionary reject UI; data unchanged.')
  } else {
    await page.goto('http://tauri.localhost/setting?index=6')
    await ready()
    await pause(1600)
    const expected = JSON.parse(readFileSync(resolve(evidence, 'expected-restart.json')))
    const actual = await snapshot()
    assert.deepEqual(actual.disk, expected.disk, 'All five keys retained after normal native restart')
    assert.equal(actual.setting.wordSoundVolume, 62)
    assert.equal(actual.base.noteData.fixture, 'Native local recovery edited')
    assert.equal(actual.config, expected.config)
    const tabs = await page.locator('.tab').allTextContents()
    assert.equal(tabs.length, 9)
    assert.ok(!tabs.some(text => /sync|同步/i.test(text)))
    await page.getByText(/^(Export Data Backup \(ZIP\)|导出数据备份\(ZIP\))$/).waitFor()
    assert.deepEqual(external, [])
    assert.deepEqual(errors, [])
    save('restart-result.json', { identity, fiveKeysUnchanged: true, tabs, external, errors })
    await page.screenshot({ path: resolve(evidence, 'restart.png') })
    console.log('PASS: native restart, five persisted keys/audio, old sync link and retained config.')
  }
} finally {
  if (ownsReadonlyTarget) chmodSync(readonlyTarget, 0o666)
  await page.evaluate(() => window.__nativeSaveRestore?.()).catch(() => {})
  await page.evaluate(() => window.__nativeAbortRestore?.()).catch(() => {})
  await context.unrouteAll({ behavior: 'wait' })
  await browser.close()
}
