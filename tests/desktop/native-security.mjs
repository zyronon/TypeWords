// Explicit release-WebView integration test; not part of the Node unit suite.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const evidence = resolve(process.argv[2] || '')
assert.ok(process.argv[2], 'Supply an evidence directory with an isolated launch.json')
const launch = JSON.parse(readFileSync(resolve(evidence, 'launch.json'), 'utf8').replace(/^\uFEFF/, ''))
assert.equal(resolve(launch.profile), resolve(evidence, 'isolated-profile'))
assert.equal(createHash('sha256').update(readFileSync(launch.exe)).digest('hex'), launch.sha256.toLowerCase())
assert.ok(process.env.TYPEWORDS_PLAYWRIGHT_MODULE, 'Set TYPEWORDS_PLAYWRIGHT_MODULE')
const { chromium } = await import(pathToFileURL(process.env.TYPEWORDS_PLAYWRIGHT_MODULE).href)
const sentinel = resolve(evidence, 'unselected-sentinel.txt')
const directory = resolve(evidence, 'unselected-directory')
assert.equal(existsSync(directory), false)
const content = 'Synthetic native security sentinel. Must remain unchanged.'
if (existsSync(sentinel)) assert.equal(readFileSync(sentinel, 'utf8'), content)
else writeFileSync(sentinel, content, { flag: 'wx' })
const report = { sha256: launch.sha256, ipc: [], navigation: [], popups: [], requests: [], errors: [] }
const server = createServer((request, response) => {
  report.requests.push(request.url)
  response.end('<title>UNTRUSTED TEST DOCUMENT</title>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${launch.port}`)
const context = browser.contexts()[0]
const page = context.pages().find(page => page.url().startsWith('http://tauri.localhost'))
assert.ok(page, 'Expected a production Tauri page')
const client = await context.newCDPSession(page)
try {
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto('http://tauri.localhost/setting?index=5')
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$pinia
    return pinia?._s.get('base')?.load && pinia?._s.get('setting')?.load
  })
  report.identity = await page.evaluate(() => ({
    origin: location.origin,
    desktop: window.__NUXT__?.config?.public?.isDesktop,
    ipc: typeof window.__TAURI_INTERNALS__?.invoke === 'function',
    ua: navigator.userAgent,
  }))
  assert.equal(report.identity.desktop, true)
  assert.equal(report.identity.ipc, true)
  const cases = [
    ['read-unselected-file', 'plugin:fs|read_file', { path: sentinel }, /not allowed|denied/i],
    ['create-unselected-directory', 'plugin:fs|mkdir', { path: directory }, /not allowed|denied/i],
    ['open-unselected-path', 'plugin:opener|open_path', { path: sentinel }, /not allowed|denied/i],
    ['ungranted-window-command', 'plugin:window|set_title', { title: 'Must not change' }, /not allowed|denied/i],
    ...['http://github.com/', 'https://github.com.evil.invalid/', 'javascript:void(0)', 'file:///synthetic.txt'].map(
      url => [`opener-${url}`, 'plugin:opener|open_url', { url }, /not allowed|denied|forbidden/i]
    ),
    ['write-unselected-file', 'plugin:fs|write_file', null, /forbidden path|not allowed|denied/i],
  ]
  for (const [name, command, args, expected] of cases) {
    const result = await page.evaluate(
      async ({ command, args, sentinel }) => {
        try {
          const operation =
            command === 'plugin:fs|write_file'
              ? window.__TAURI_INTERNALS__.invoke(command, new Uint8Array([80, 75]), {
                  headers: { path: encodeURIComponent(sentinel), options: '{}' },
                })
              : window.__TAURI_INTERNALS__.invoke(command, args)
          let timer
          try {
            await Promise.race([
              operation,
              new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('TEST IPC TIMEOUT')), 5000)
              }),
            ])
          } finally {
            clearTimeout(timer)
          }
          return { rejected: false }
        } catch (error) {
          return { rejected: true, error: String(error) }
        }
      },
      { command, args, sentinel }
    )
    report.ipc.push({ name, command, ...result })
    assert.equal(result.rejected, true, name)
    assert.match(result.error, expected, `${name}: must be a permission/scope denial, not malformed IPC`)
    assert.equal(readFileSync(sentinel, 'utf8'), content, `${name}: sentinel intact`)
    assert.equal(existsSync(directory), false, `${name}: directory not created`)
  }
  const original = page.url()
  const marker = 'native-security-document'
  await page.evaluate(marker => (window.__securityDocumentMarker = marker), marker)
  // CDP navigation bypasses the application's anchor/window.open interception.
  for (const url of [
    `http://127.0.0.1:${server.address().port}/untrusted`,
    'data:text/html,<title>UNTRUSTED TEST DOCUMENT</title>',
    pathToFileURL(sentinel).href,
  ]) {
    const result = await client.send('Page.navigate', { url })
    await new Promise(resolve => setTimeout(resolve, 500))
    assert.equal(page.url(), original, `Host must reject ${url}`)
    assert.equal(await page.evaluate(() => window.__securityDocumentMarker), marker)
    report.navigation.push({ url, result, originalDocumentRetained: true })
  }
  // An isolated world has the browser's native window.open, not the app wrapper.
  // A user gesture and windowOpen event distinguish host denial from an untested call.
  await client.send('Page.enable')
  const { frameTree } = await client.send('Page.getFrameTree')
  const { executionContextId } = await client.send('Page.createIsolatedWorld', {
    frameId: frameTree.frame.id,
    worldName: 'typewords-native-popup-probe',
  })
  const opened = []
  const createdPages = []
  const onWindowOpen = event => opened.push(event)
  const onPage = page => createdPages.push(page.url())
  client.on('Page.windowOpen', onWindowOpen)
  context.on('page', onPage)
  try {
    for (const url of [
      'http://tauri.localhost/words',
      `http://127.0.0.1:${server.address().port}/popup`,
      'data:text/html,<title>UNTRUSTED POPUP</title>',
    ]) {
      const before = opened.length
      const result = await client.send('Runtime.callFunctionOn', {
        executionContextId,
        functionDeclaration: `function(url) {
          if (!Function.prototype.toString.call(window.open).includes('[native code]')) {
            throw new Error('Expected browser-native window.open');
          }
          return window.open(url, '_blank') === null;
        }`,
        arguments: [{ value: url }],
        returnByValue: true,
        userGesture: true,
      })
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails))
      await new Promise(resolve => setTimeout(resolve, 500))
      const events = opened.slice(before)
      assert.equal(events.length, 1, `${url}: browser must observe one real popup attempt`)
      assert.equal(events[0].url, url)
      assert.equal(events[0].userGesture, true)
      assert.equal(result.result.value, true, `${url}: no window handle returned`)
      assert.deepEqual(createdPages, [], `${url}: no new WebView page`)
      assert.equal(page.url(), original)
      assert.equal(await page.evaluate(() => window.__securityDocumentMarker), marker)
      report.popups.push({ url, event: events[0], noWindowHandle: true, originalDocumentRetained: true })
    }
  } finally {
    client.off('Page.windowOpen', onWindowOpen)
    context.off('page', onPage)
  }
  // WebView2 can initiate a request before the host cancels document navigation.
  // The security contract here is document isolation, not a network firewall.
  assert.deepEqual(report.errors, [])
  await page.reload()
  await page.waitForFunction(() => window.__TAURI_INTERNALS__ && document.querySelector('.tab'))
  assert.equal(new URL(page.url()).origin, 'http://tauri.localhost')
  report.localReload = true
  await page.screenshot({ path: resolve(evidence, 'native-security.png') })
  report.passed = true
  console.log(
    `PASS: ${report.ipc.length} real IPC denials, ${report.navigation.length} host navigation denials, ${report.popups.length} native popup denials, local reload.`
  )
} finally {
  writeFileSync(resolve(evidence, 'native-security.json'), JSON.stringify(report, null, 2))
  await client.detach().catch(() => {})
  await browser.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
