// Explicit installed-WebView check: practice lookup → 有道词典.
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
const observeScript = resolve('tests/desktop/native-external-observe.ps1')
const observeFile = resolve(evidence, 'native-youdao-observe.json')
const hostPattern = /youdao\.com/i
const extraMarkers = ['有道', 'youdao', '词典', 'Youdao', '无法访问']
const asArray = value => (value == null ? [] : Array.isArray(value) ? value : [value])
const tabText = tab => `${tab?.name || ''} ${tab?.window || ''}`
const matchingTabs = tabs =>
  asArray(tabs).filter(tab => {
    const text = tabText(tab)
    return hostPattern.test(text) || extraMarkers.some(marker => text.includes(marker))
  })
const report = { sha256: launch.sha256, webviewRequests: [], errors: [] }

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

function startWatch(url) {
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

async function ready(page) {
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$pinia
    return pinia?._s.get('base')?.load && pinia?._s.get('setting')?.load
  })
}

function installProbe(page, marker) {
  return page.evaluate(value => {
    window.__externalDocumentMarker = value
    const internals = window.__TAURI_INTERNALS__
    const originalInvoke = internals.invoke.bind(internals)
    const originalFetch = window.fetch
    const opener = internals.convertFileSrc('plugin:opener|open_url', 'ipc')
    window.__externalOpenProbe = { invokes: [], fetches: [] }
    internals.invoke = async function (command, args, options) {
      try {
        const result = await originalInvoke(command, args, options)
        window.__externalOpenProbe.invokes.push({ command, args, ok: true })
        return result
      } catch (error) {
        window.__externalOpenProbe.invokes.push({ command, args, ok: false, error: String(error) })
        throw error
      }
    }
    window.fetch = async function (input, init) {
      const href = String(input)
      const response = await originalFetch.call(this, input, init)
      if (href === opener || /plugin:opener\|open_url/.test(href)) {
        const raw = await response.clone().text()
        let body = raw
        try {
          body = JSON.parse(raw)
        } catch {}
        window.__externalOpenProbe.fetches.push({
          url: href,
          ok: response.headers.get('Tauri-Response') === 'ok',
          body,
        })
      }
      return response
    }
    if (window.fetch === originalFetch) throw new Error('Cannot install opener observer')
  }, marker)
}

const browser = await connect()
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
    if (/^https:\/\/www\.youdao\.com\b/i.test(request.url())) report.webviewRequests.push(request.url())
  })
  await page.goto('http://tauri.localhost/words')
  await ready(page)
  const start = page.getByText(/^(开始学习|继续学习|开始系统练习|开始自由练习|开始自定义练习|继续自定义练习)/)
  await start.first().click()
  await page.waitForURL(/\/practice-words\//, { timeout: 15000 })
  await ready(page)
  await page.waitForSelector('.typing-word', { timeout: 15000 })
  await page.evaluate(() => {
    const pinia = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia
    const setting = pinia._s.get('setting')
    if (setting) {
      setting.showPanel = true
      setting.showToolbar = true
    }
  })
  await page.waitForTimeout(300)
  report.identity = await page.evaluate(() => ({
    origin: location.origin,
    href: location.href,
    desktop: window.__NUXT__?.config?.public?.isDesktop,
    ipc: typeof window.__TAURI_INTERNALS__?.invoke === 'function',
  }))
  assert.equal(report.identity.desktop, true)
  assert.equal(report.identity.ipc, true)
  let clickable = page.locator('.clickable-word').first()
  if ((await page.locator('.clickable-word').count()) === 0) {
    report.path = 'book-detail-lookup'
    await page.goto('http://tauri.localhost/book-list')
    await ready(page)
    await page.locator('#dict-246').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('#dict-246').click()
    await page.waitForURL(/\/book\/246\b/, { timeout: 15000 })
    await ready(page)
    await page.getByText('Excuse me!').first().waitFor({ state: 'visible', timeout: 20000 })
    await page.getByText('Excuse me!').nth(0).click()
    await page.waitForTimeout(300)
    clickable = page.locator('.clickable-word').first()
  } else {
    report.path = 'practice-lookup'
  }
  await clickable.waitFor({ state: 'visible', timeout: 15000 })
  report.identity = await page.evaluate(() => ({
    origin: location.origin,
    href: location.href,
    desktop: window.__NUXT__?.config?.public?.isDesktop,
    ipc: typeof window.__TAURI_INTERNALS__?.invoke === 'function',
  }))
  assert.equal(report.identity.desktop, true)
  assert.equal(report.identity.ipc, true)
  report.lookupWord = (await clickable.innerText()).trim()
  await clickable.click()
  const youdaoButton = page.locator('.word-lookup-popover').getByText('有道词典', { exact: true })
  await youdaoButton.waitFor({ state: 'visible', timeout: 10000 })
  report.popover = await page.evaluate(() => ({
    visible: !!document.querySelector('.word-lookup-popover'),
    text: document.querySelector('.word-lookup-popover')?.textContent || '',
  }))
  assert.match(report.popover.text, /暂未收录该单词/)
  const expectedUrl = `https://www.youdao.com/result?word=${encodeURIComponent(report.lookupWord)}&lang=en`
  report.url = expectedUrl
  const marker = 'native-youdao-document'
  await installProbe(page, marker)
  watch = startWatch(expectedUrl)
  const readyUntil = Date.now() + 8000
  while (Date.now() < readyUntil) {
    if (existsSync(observeFile)) {
      try {
        const current = JSON.parse(readFileSync(observeFile, 'utf8').replace(/^\uFEFF/, ''))
        if (current.uiaReady) break
      } catch {}
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 150))
  }
  const original = page.url()
  await youdaoButton.click()
  await page.waitForFunction(
    () => {
      const probe = window.__externalOpenProbe
      return (
        probe?.invokes?.some(item => item.command === 'plugin:opener|open_url' && item.ok) ||
        probe?.fetches?.some(item => item.ok)
      )
    },
    null,
    { timeout: 10000 }
  )
  await watch.done
  const observe = existsSync(observeFile) ? JSON.parse(readFileSync(observeFile, 'utf8').replace(/^\uFEFF/, '')) : null
  const probe = await page.evaluate(() => window.__externalOpenProbe)
  report.probe = probe
  report.observe = observe
  const invoke = asArray(probe.invokes).find(item => item.command === 'plugin:opener|open_url')
  const fetched = asArray(probe.fetches).find(item => item.ok)
  assert.ok(invoke || fetched, '有道词典 must call the native opener')
  if (invoke) {
    assert.match(String(invoke.args?.url || ''), /https:\/\/www\.youdao\.com\/result\?word=/)
  }
  assert.equal(page.url(), original)
  assert.equal(await page.evaluate(() => window.__externalDocumentMarker), marker)
  assert.deepEqual(createdPages, [], 'Host must not open a WebView page for Youdao')
  assert.deepEqual(report.webviewRequests, [], 'www.youdao.com must not load inside the privileged WebView')
  assert.deepEqual(report.errors, [])
  assert.equal(await page.locator('.message.error').count(), 0)
  if (report.lookupWord && !extraMarkers.includes(report.lookupWord)) extraMarkers.push(report.lookupWord)
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
    'System browser must receive the Youdao URL; opener IPC success is not enough'
  )
  await page.screenshot({ path: resolve(evidence, 'native-youdao.png') })
  report.systemBrowser = {
    httpsProgId: observe?.httpsProgId ?? null,
    processes: processHits.length,
    newTabs: tabHits.length,
    retargetedTabs: retargetHits.length,
    newWindows: windowHits.length,
    existingMatches: existingHits.length,
  }
  try {
    await powershell([observeScript, '-Mode', 'Close', '-Url', expectedUrl, '-OutFile', observeFile])
    report.observe = JSON.parse(readFileSync(observeFile, 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    report.closeError = String(error)
  }
  report.passed = true
  console.log(
    `PASS: practice lookup 有道词典 opened ${expectedUrl}; system browser evidence processes=${processHits.length} tabs=${tabHits.length} retargeted=${retargetHits.length} windows=${windowHits.length} existing=${existingHits.length}; main document retained.`
  )
} finally {
  context.off('page', onPage)
  if (watch?.child && watch.child.exitCode == null) watch.child.kill()
  writeFileSync(resolve(evidence, 'native-youdao.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
