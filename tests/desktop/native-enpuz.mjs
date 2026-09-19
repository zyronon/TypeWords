// Explicit installed-WebView check: article practice context menu → enpuz.com.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const evidence = resolve(process.argv[2] || '')
assert.ok(process.argv[2], 'Supply an evidence directory with an isolated launch.json')
const launch = JSON.parse(readFileSync(resolve(evidence, 'launch.json'), 'utf8').replace(/^\uFEFF/, ''))
assert.equal(resolve(launch.profile), resolve(evidence, 'isolated-profile'))
assert.equal(createHash('sha256').update(readFileSync(launch.exe)).digest('hex'), launch.sha256.toLowerCase())
assert.ok(process.env.TYPEWORDS_PLAYWRIGHT_MODULE, 'Set TYPEWORDS_PLAYWRIGHT_MODULE')
const { chromium } = await import(pathToFileURL(process.env.TYPEWORDS_PLAYWRIGHT_MODULE).href)
const url = 'https://enpuz.com/'
const observeScript = resolve('tests/desktop/native-external-observe.ps1')
const observeFile = resolve(evidence, 'native-enpuz-observe.json')
const hostPattern = /enpuz\.com/i
const extraMarkers = ['enpuz', '英语语法', '语法分析']
const asArray = value => (value == null ? [] : Array.isArray(value) ? value : [value])
const tabText = tab => `${tab?.name || ''} ${tab?.window || ''}`
const matchingTabs = tabs =>
  asArray(tabs).filter(tab => {
    const text = tabText(tab)
    return hostPattern.test(text) || extraMarkers.some(marker => text.includes(marker))
  })
const report = { sha256: launch.sha256, url, webviewRequests: [], errors: [] }

function powershell(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ...args], {
      windowsHide: true,
    })
    const stdout = []
    const stderr = []
    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))
    child.on('error', reject)
    child.on('exit', code => {
      const result = {
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }
      if (code === 0) resolvePromise(result)
      else reject(new Error(`powershell ${args[0]} exited ${code}: ${result.stderr || result.stdout}`))
    })
  })
}

function startWatch() {
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      observeScript,
      '-Mode',
      'Watch',
      '-Url',
      url,
      '-OutFile',
      observeFile,
      '-Seconds',
      '20',
    ],
    { windowsHide: true }
  )
  const stderr = []
  child.stderr.on('data', chunk => stderr.push(chunk))
  const done = new Promise((resolvePromise, reject) => {
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolvePromise()
      else reject(new Error(`observe watch exited ${code}: ${Buffer.concat(stderr).toString('utf8')}`))
    })
  })
  return { child, done }
}

async function ready(page) {
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$pinia
    return pinia?._s.get('base')?.load && pinia?._s.get('setting')?.load
  })
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${launch.port}`)
const context = browser.contexts()[0]
const page = context.pages().find(item => item.url().startsWith('http://tauri.localhost'))
assert.ok(page, 'Expected a production Tauri page')
const createdPages = []
const onPage = opened => createdPages.push(opened.url())
context.on('page', onPage)
let watch
try {
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('request', request => {
    if (hostPattern.test(request.url())) report.webviewRequests.push(request.url())
  })
  await page.goto('http://tauri.localhost/book-list')
  await ready(page)
  await page.locator('#dict-246').waitFor({ state: 'visible', timeout: 15000 })
  await page.locator('#dict-246').click()
  await page.waitForURL(/\/book\/246\b/, { timeout: 15000 })
  await ready(page)
  await page.getByText('Excuse me!').first().waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('.dict-actions').getByText('学习', { exact: true }).click()
  await page.waitForURL(/\/practice-articles\//, { timeout: 15000 })
  await ready(page)
  await page.evaluate(() => {
    const pinia = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia
    const setting = pinia._s.get('setting')
    if (setting) {
      setting.showPanel = false
      setting.conflictNotice = false
    }
    document.querySelectorAll('.modal-root').forEach(node => node.remove())
  })
  await page.waitForTimeout(300)
  const word = page.locator('.word-wrap').first()
  await word.waitFor({ state: 'visible', timeout: 15000 })
  report.identity = await page.evaluate(() => ({
    origin: location.origin,
    href: location.href,
    desktop: window.__NUXT__?.config?.public?.isDesktop,
    ipc: typeof window.__TAURI_INTERNALS__?.invoke === 'function',
  }))
  assert.equal(report.identity.desktop, true)
  assert.equal(report.identity.ipc, true)
  await page.evaluate(() => {
    window.__externalDocumentMarker = 'native-enpuz'
    const internals = window.__TAURI_INTERNALS__
    const originalFetch = window.fetch
    const opener = internals.convertFileSrc('plugin:opener|open_url', 'ipc')
    window.__externalOpenProbe = { fetches: [] }
    window.fetch = async function (input, init) {
      const href = String(input)
      const response = await originalFetch.call(this, input, init)
      if (href === opener || /plugin:opener\|open_url/.test(href)) {
        window.__externalOpenProbe.fetches.push({
          url: href,
          ok: response.headers.get('Tauri-Response') === 'ok',
        })
      }
      return response
    }
  })
  watch = startWatch()
  const readyUntil = Date.now() + 8000
  while (Date.now() < readyUntil) {
    if (existsSync(observeFile)) {
      try {
        if (JSON.parse(readFileSync(observeFile, 'utf8').replace(/^\uFEFF/, '')).uiaReady) break
      } catch {}
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 150))
  }
  const original = page.url()
  const box = await word.boundingBox()
  assert.ok(box, 'Expected an article word box')
  await page.mouse.click(box.x + Math.min(8, box.width / 2), box.y + box.height / 2, { button: 'right' })
  const grammar = page.getByText(/语法分析|Grammar analysis/)
  await grammar.waitFor({ state: 'visible', timeout: 8000 })
  await grammar.click()
  await page.waitForFunction(() => window.__externalOpenProbe?.fetches?.some(item => item.ok), null, {
    timeout: 15000,
  })
  await watch.done
  const observe = existsSync(observeFile) ? JSON.parse(readFileSync(observeFile, 'utf8').replace(/^\uFEFF/, '')) : null
  const probe = await page.evaluate(() => window.__externalOpenProbe)
  report.probe = probe
  report.observe = observe
  assert.ok(asArray(probe.fetches).some(item => item.ok), '语法分析 must call the native opener')
  assert.match(page.url(), /^http:\/\/tauri\.localhost\//)
  report.retainedHref = page.url()
  report.openedFrom = original
  if (page.url() === original) {
    assert.equal(await page.evaluate(() => window.__externalDocumentMarker), 'native-enpuz')
  }
  assert.deepEqual(createdPages, [])
  assert.deepEqual(report.webviewRequests, [])
  assert.deepEqual(report.errors, [])
  const processHits = asArray(observe?.processes)
  const tabHits = matchingTabs(observe?.newTabs)
  const retargetHits = matchingTabs(observe?.retargetedTabs)
  const windowHits = asArray(observe?.newWindows)
  const existingHits = matchingTabs(observe?.existingMatches)
  assert.ok(
    processHits.length > 0 ||
      tabHits.length > 0 ||
      retargetHits.length > 0 ||
      windowHits.length > 0 ||
      existingHits.length > 0,
    'System browser must receive enpuz.com; opener IPC success is not enough'
  )
  await page.screenshot({ path: resolve(evidence, 'native-enpuz.png') })
  report.systemBrowser = {
    httpsProgId: observe?.httpsProgId ?? null,
    processes: processHits.length,
    newTabs: tabHits.length,
    retargetedTabs: retargetHits.length,
    newWindows: windowHits.length,
    existingMatches: existingHits.length,
  }
  try {
    await powershell([observeScript, '-Mode', 'Close', '-Url', url, '-OutFile', observeFile])
    report.observe = JSON.parse(readFileSync(observeFile, 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    report.closeError = String(error)
  }
  report.passed = true
  console.log(
    `PASS: article 语法分析 opened enpuz.com; system browser evidence processes=${processHits.length} tabs=${tabHits.length} retargeted=${retargetHits.length} windows=${windowHits.length} existing=${existingHits.length}; main document retained.`
  )
} finally {
  context.off('page', onPage)
  if (watch?.child && watch.child.exitCode == null) watch.child.kill()
  writeFileSync(resolve(evidence, 'native-enpuz.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
