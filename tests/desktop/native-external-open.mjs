// Explicit release-WebView integration test; not part of the Node unit suite.
// Clicks a real in-app allowlisted link and requires OS evidence that the
// system browser received it. IPC success alone is not enough.
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
const url = process.argv[3] || 'https://github.com/zyronon/TypeWords'
const host = new URL(url).hostname
const stem =
  process.argv[3] == null ? 'native-external-open' : `native-external-${host.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`
const observeScript = resolve('tests/desktop/native-external-observe.ps1')
const observeFile = resolve(evidence, `${stem}-observe.json`)
const report = { sha256: launch.sha256, url, webviewRequests: [], errors: [] }
const asArray = value => (value == null ? [] : Array.isArray(value) ? value : [value])
const hostPattern = new RegExp(host.replace(/\./g, '\\.'), 'i')
const extraMarkers = host.includes('wjx.cn')
  ? ['问卷', '问卷星', 'ev0W7fv']
  : host.includes('youdao.com')
    ? ['有道', 'youdao', '词典', 'Youdao', new URL(url).searchParams.get('word')].filter(Boolean)
    : host.includes('enpuz.com')
      ? ['enpuz', '英语语法', '语法分析']
      : host.includes('v8l.cn')
        ? ['v8l', 'TG3sgVg']
        : []
const tabText = tab => `${tab?.name || ''} ${tab?.window || ''}`
const matchingTabs = tabs =>
  asArray(tabs).filter(tab => {
    const text = tabText(tab)
    return hostPattern.test(text) || text.includes(url) || extraMarkers.some(marker => text.includes(marker))
  })

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
      '12',
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
    if (hostPattern.test(request.url())) report.webviewRequests.push(request.url())
  })
  await page.goto('http://tauri.localhost/setting?index=9')
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$pinia
    return pinia?._s.get('base')?.load && pinia?._s.get('setting')?.load
  })
  const link = page.locator(`a[href="${url}"]`)
  await link.waitFor({ state: 'visible' })
  report.identity = await page.evaluate(() => ({
    origin: location.origin,
    href: location.href,
    desktop: window.__NUXT__?.config?.public?.isDesktop,
    ipc: typeof window.__TAURI_INTERNALS__?.invoke === 'function',
    ua: navigator.userAgent,
  }))
  assert.equal(report.identity.desktop, true)
  assert.equal(report.identity.ipc, true)
  assert.match(report.identity.href, /[?&]index=9\b/)
  const marker = 'native-external-document'
  await page.evaluate(value => {
    window.__externalDocumentMarker = value
    const internals = window.__TAURI_INTERNALS__
    const originalInvoke = internals.invoke.bind(internals)
    const originalFetch = window.fetch
    const opener = internals.convertFileSrc('plugin:opener|open_url', 'ipc')
    window.__externalOpenProbe = { invokes: [], fetches: [] }
    internals.invoke = async function (command, args, options) {
      try {
        const value = await originalInvoke(command, args, options)
        window.__externalOpenProbe.invokes.push({ command, args, ok: true })
        return value
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
  watch = startWatch()
  await new Promise(resolveWait => setTimeout(resolveWait, 400))
  const original = page.url()
  await link.click()
  await page.waitForFunction(
    expected => {
      const probe = window.__externalOpenProbe
      return (
        probe?.invokes?.some(
          item => item.command === 'plugin:opener|open_url' && item.ok && item.args?.url === expected
        ) || probe?.fetches?.some(item => item.ok)
      )
    },
    url,
    { timeout: 10000 }
  )
  await watch.done
  const observe = existsSync(observeFile) ? JSON.parse(readFileSync(observeFile, 'utf8').replace(/^\uFEFF/, '')) : null
  const probe = await page.evaluate(() => window.__externalOpenProbe)
  report.probe = probe
  report.observe = observe
  const invoke = asArray(probe.invokes).find(item => item.command === 'plugin:opener|open_url')
  const fetched = asArray(probe.fetches).find(item => item.ok)
  assert.ok(invoke || fetched, 'Product click must call the native opener')
  if (invoke) {
    assert.equal(invoke.args.url, url)
  }
  assert.equal(page.url(), original)
  assert.equal(await page.evaluate(() => window.__externalDocumentMarker), marker)
  assert.deepEqual(createdPages, [], 'Host must not open a WebView page for the product link')
  assert.deepEqual(report.webviewRequests, [], `${host} must not load inside the privileged WebView`)
  assert.deepEqual(report.errors, [])
  assert.equal(await page.locator('.message.error').count(), 0)
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
    'System browser must receive the allowlisted URL; opener IPC success is not enough'
  )
  await page.screenshot({ path: resolve(evidence, `${stem}.png`) })
  report.probe = probe
  report.observe = observe
  report.noWebViewNavigation = true
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
    `PASS: settings About ${host} link opened via opener; system browser evidence processes=${processHits.length} tabs=${tabHits.length} retargeted=${retargetHits.length} windows=${windowHits.length}; main document retained.`
  )
} finally {
  context.off('page', onPage)
  if (watch?.child && watch.child.exitCode == null) watch.child.kill()
  writeFileSync(resolve(evidence, `${stem}.json`), JSON.stringify(report, null, 2))
  await browser.close()
}
