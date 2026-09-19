// Explicit installed-candidate runner. Not part of the default Node suite.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { backupSeedScript } from './backup-browser-seed.mjs'

const [mode, evidencePath] = process.argv.slice(2)
assert.ok(
  ['prepare', 'before-upgrade', 'after-upgrade', 'retain-before', 'retain-after'].includes(mode),
  'Use prepare, before-upgrade, after-upgrade, retain-before or retain-after'
)
assert.ok(evidencePath, 'An explicit evidence directory is required')
const evidence = resolve(evidencePath)
const launchName = existsSync(resolve(evidence, 'restart.json')) ? 'restart.json' : 'launch.json'
const launch = JSON.parse(readFileSync(resolve(evidence, launchName), 'utf8').replace(/^\uFEFF/, ''))
assert.equal(resolve(launch.profile), resolve(evidence, 'isolated-profile'))
assert.equal(createHash('sha256').update(readFileSync(launch.exe)).digest('hex'), launch.sha256.toLowerCase())
assert.ok(process.env.TYPEWORDS_PLAYWRIGHT_MODULE, 'Set TYPEWORDS_PLAYWRIGHT_MODULE')
const { chromium } = await import(pathToFileURL(process.env.TYPEWORDS_PLAYWRIGHT_MODULE).href)

async function connect() {
  const deadline = Date.now() + 30000
  let last
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${launch.port}`)
    } catch (error) {
      last = error
      await new Promise(resolveWait => setTimeout(resolveWait, 250))
    }
  }
  throw last
}

const browser = await connect()
const context = browser.contexts()[0]
const deadline = Date.now() + 30000
let page
while (Date.now() < deadline) {
  page = context.pages().find(item => item.url().startsWith('http://tauri.localhost'))
  if (page) break
  await new Promise(resolveWait => setTimeout(resolveWait, 250))
}
assert.ok(page, 'Expected the isolated installed Tauri page')
const external = []
const errors = []
page.on('pageerror', error => errors.push(error.message))
await context.route(/^https:\/\//, route => {
  external.push(route.request().url())
  return route.abort()
})
const pause = ms => new Promise(resolveWait => setTimeout(resolveWait, ms))
async function ready() {
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$pinia
    return pinia?._s.get('base')?.load && pinia?._s.get('setting')?.load
  })
}
async function snapshot() {
  return page.evaluate(async () => {
    const request = indexedDB.open('keyval-store')
    const db = await new Promise((resolveDb, reject) => {
      request.onsuccess = () => resolveDb(request.result)
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
            new Promise((resolveKey, reject) => {
              const get = tx.objectStore('keyval').get(key)
              get.onsuccess = () => {
                disk[key] = get.result ?? null
                resolveKey()
              }
              get.onerror = () => reject(get.error)
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
      href: location.href,
    }
  })
}
const save = (name, value) => writeFileSync(resolve(evidence, name), JSON.stringify(value, null, 2))
try {
  await page.goto('http://tauri.localhost/setting?index=5')
  await ready()
  const identity = await page.evaluate(() => ({
    origin: location.origin,
    href: location.href,
    desktop: window.__NUXT__?.config?.public?.isDesktop,
    ipc: typeof window.__TAURI_INTERNALS__?.invoke === 'function',
    ua: navigator.userAgent,
  }))
  assert.equal(identity.origin, 'http://tauri.localhost')
  assert.equal(identity.desktop, true)
  assert.equal(identity.ipc, true)
  if (mode === 'prepare') {
    const seeded = await page.evaluate(`(${backupSeedScript()})()`)
    assert.equal(seeded.audioBytes, 2943)
    await pause(1800)
    const baseline = await snapshot()
    for (const [key, value] of Object.entries(baseline.disk)) {
      assert.notEqual(value, null, `Seed must populate ${key}`)
    }
    assert.equal(baseline.base.noteData.fixture, 'ZIP semantic round-trip')
    assert.equal(baseline.setting.wordSoundVolume, 0.37)
    assert.equal(baseline.disk['typing-word-files'][0].bytes.length, 2943)
    save('before-upgrade.json', { identity, productVersion: launch.productVersion, baseline, external, errors })
    console.log('PASS: installed 0.1.0 seeded five keys and 2943-byte audio in the isolated profile.')
  } else if (mode === 'retain-before') {
    const baseline = await snapshot()
    for (const [key, value] of Object.entries(baseline.disk)) {
      assert.notEqual(value, null, `Retain snapshot must include ${key}`)
    }
    assert.equal(baseline.disk['typing-word-files'][0].bytes.length, 2943)
    save('failed-upgrade-before.json', {
      identity,
      productVersion: launch.productVersion,
      sha256: launch.sha256,
      baseline,
      external,
      errors,
    })
    await page.screenshot({ path: resolve(evidence, 'failed-upgrade-before.png') })
    console.log(`PASS: recorded isolated retain snapshot before failed upgrade on ${launch.productVersion}.`)
  } else if (mode === 'retain-after') {
    const expected = JSON.parse(readFileSync(resolve(evidence, 'failed-upgrade-before.json'), 'utf8'))
    const actual = await snapshot()
    assert.equal(
      launch.productVersion,
      expected.productVersion,
      'Failed upgrade must not change the installed product version'
    )
    assert.equal(actual.base.noteData.fixture, expected.baseline.base.noteData.fixture)
    assert.equal(actual.setting.wordSoundVolume, expected.baseline.setting.wordSoundVolume)
    assert.deepEqual(actual.disk['typing-word-files'], expected.baseline.disk['typing-word-files'])
    assert.equal(
      JSON.parse(actual.disk['typing-word-setting']).val.wordSoundVolume,
      expected.baseline.setting.wordSoundVolume
    )
    assert.equal(
      JSON.parse(actual.disk['typing-word-dict']).val.noteData.fixture,
      expected.baseline.base.noteData.fixture
    )
    save('failed-upgrade-after.json', {
      identity,
      productVersion: launch.productVersion,
      sha256: launch.sha256,
      fiveKeysRetained: true,
      audioBytes: actual.disk['typing-word-files'][0].bytes.length,
      external,
      errors,
    })
    await page.screenshot({ path: resolve(evidence, 'failed-upgrade-after.png') })
    console.log(
      `PASS: isolated profile retained five keys and audio after failed upgrade; still ${launch.productVersion}.`
    )
  } else {
    const expected = JSON.parse(readFileSync(resolve(evidence, 'before-upgrade.json'), 'utf8'))
    const actual = await snapshot()
    assert.equal(actual.base.noteData.fixture, expected.baseline.base.noteData.fixture)
    assert.equal(actual.setting.wordSoundVolume, expected.baseline.setting.wordSoundVolume)
    assert.deepEqual(actual.disk['typing-word-files'], expected.baseline.disk['typing-word-files'])
    assert.equal(JSON.parse(actual.disk['typing-word-setting']).val.wordSoundVolume, 0.37)
    assert.equal(JSON.parse(actual.disk['typing-word-dict']).val.noteData.fixture, 'ZIP semantic round-trip')
    save(`${mode}.json`, {
      identity,
      productVersion: launch.productVersion,
      fiveKeysRetained: true,
      audioBytes: actual.disk['typing-word-files'][0].bytes.length,
      external,
      errors,
    })
    await page.screenshot({ path: resolve(evidence, `${mode}.png`) })
    console.log(`PASS: ${mode} retained five keys and audio after ${launch.productVersion}.`)
  }
  assert.deepEqual(errors, [])
} finally {
  await context.unrouteAll({ behavior: 'wait' }).catch(() => {})
  await browser.close()
}
