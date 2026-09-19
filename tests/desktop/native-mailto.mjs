// Explicit release-WebView check for the product feedback mailbox.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const evidence = resolve(process.argv[2] || '')
assert.ok(process.argv[2], 'Supply an evidence directory with an isolated launch.json')
const launch = JSON.parse(readFileSync(resolve(evidence, 'launch.json'), 'utf8').replace(/^\uFEFF/, ''))
assert.equal(resolve(launch.profile), resolve(evidence, 'isolated-profile'))
assert.equal(createHash('sha256').update(readFileSync(launch.exe)).digest('hex'), launch.sha256.toLowerCase())
assert.ok(process.env.TYPEWORDS_PLAYWRIGHT_MODULE, 'Set TYPEWORDS_PLAYWRIGHT_MODULE')
const { chromium } = await import(pathToFileURL(process.env.TYPEWORDS_PLAYWRIGHT_MODULE).href)
const url = 'mailto:zyronon@163.com'
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${launch.port}`)
const context = browser.contexts()[0]
const page = context.pages().find(item => item.url().startsWith('http://tauri.localhost'))
assert.ok(page, 'Expected a production Tauri page')
const createdPages = []
const report = { sha256: launch.sha256, url, webviewRequests: [], errors: [] }
const onPage = opened => createdPages.push(opened.url())
context.on('page', onPage)
try {
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('request', request => {
    if (/163\.com|mailto:/i.test(request.url())) report.webviewRequests.push(request.url())
  })
  await page.goto('http://tauri.localhost/setting?index=9')
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$pinia
    return pinia?._s.get('base')?.load && pinia?._s.get('setting')?.load
  })
  const link = page.locator(`a[href="${url}"]`)
  await link.waitFor({ state: 'visible' })
  await page.evaluate(() => {
    const internals = window.__TAURI_INTERNALS__
    const originalFetch = window.fetch
    const opener = internals.convertFileSrc('plugin:opener|open_url', 'ipc')
    window.__externalOpenProbe = { fetches: [] }
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
  })
  const original = page.url()
  await link.click()
  await page.waitForFunction(
    () => window.__externalOpenProbe?.fetches?.some(item => item.ok),
    null,
    { timeout: 10000 }
  )
  const probe = await page.evaluate(() => window.__externalOpenProbe)
  report.probe = probe
  report.identity = { href: page.url() }
  assert.equal(page.url(), original)
  assert.deepEqual(createdPages, [])
  assert.deepEqual(report.webviewRequests, [])
  assert.deepEqual(report.errors, [])
  assert.equal(await page.locator('.message.error').count(), 0)
  await page.screenshot({ path: resolve(evidence, 'native-mailto.png') })
  report.passed = true
  console.log('PASS: About mailto opened via scoped opener; main document retained; no WebView mail page.')
} finally {
  context.off('page', onPage)
  writeFileSync(resolve(evidence, 'native-mailto.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
