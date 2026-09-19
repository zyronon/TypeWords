import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { STATIC_RESOURCES, LIST_FILES } from '../../scripts/check-desktop-resources.mjs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const root = resolve(process.env.TYPEWORDS_TEST_ROOT || '.')
const { runDesktop } = await import(pathToFileURL(resolve(root, 'scripts/desktop.mjs')))

function harness(t, { reports = [], spawnError } = {}) {
  // Fail before invoking the old launcher: baseline must never start a real Nuxt process.
  assert.match(runDesktop.toString(), /checkResources/, 'launcher must wire resource validation')
  const previousExitCode = process.exitCode
  const interrupts = process.listenerCount('SIGINT')
  const terminations = process.listenerCount('SIGTERM')
  const errors = []
  t.mock.method(console, 'error', message => errors.push(message))
  const child = new EventEmitter()
  const calls = []
  const entries = []
  let spawned = 0
  child.kill = signal => calls.push(signal)
  t.after(() => {
    child.emit('exit', 1, null)
    process.exitCode = previousExitCode
    assert.equal(process.listenerCount('SIGINT'), interrupts)
    assert.equal(process.listenerCount('SIGTERM'), terminations)
  })
  return {
    child,
    calls,
    entries,
    errors,
    get spawned() {
      return spawned
    },
    run(mode = 'build') {
      return runDesktop(mode, {
        spawnProcess() {
          spawned++
          if (spawnError) throw spawnError
          return child
        },
        checkResources(path) {
          calls.push(path)
          const report = reports.shift()
          if (report instanceof Error) throw report
          return report || { ok: true, errors: [] }
        },
        checkEntry(path) {
          entries.push(path)
        },
      })
    },
  }
}
const invalid = {
  ok: false,
  errors: [{ code: 'COUNT_MISMATCH', path: '/dicts/en/article/NCE_1.json', message: 'declared 72, actual 5' }],
}

test('source audit failure prevents Nuxt launch', t => {
  const h = harness(t, { reports: [invalid] })
  assert.throws(() => h.run(), /COUNT_MISMATCH.*declared 72, actual 5/s)
  assert.equal(h.spawned, 0)
  assert.deepEqual(h.calls, [resolve(root, 'public')])
})
test('successful generate audits output before returning success', t => {
  const h = harness(t)
  assert.equal(h.run(), h.child)
  assert.deepEqual(h.calls, [resolve(root, 'public')])
  h.child.emit('exit', 0, null)
  assert.deepEqual(h.calls, [resolve(root, 'public'), resolve(root, '.output/public')])
  assert.equal(process.exitCode, 0)
  assert.deepEqual(h.entries, [resolve(root, '.output/public')])
})
test('invalid generated resources turn Nuxt success into build failure', t => {
  const h = harness(t, { reports: [{ ok: true }, invalid] })
  h.run()
  h.child.emit('exit', 0, null)
  assert.equal(process.exitCode, 1)
  assert.match(h.errors.join('\n'), /COUNT_MISMATCH/)
})
test('failed generate preserves exit status and does not audit stale output', t => {
  const h = harness(t)
  h.run()
  h.child.emit('exit', 7, null)
  assert.equal(process.exitCode, 7)
  assert.equal(h.calls.length, 1)
  assert.deepEqual(h.entries, [])
})
test('desktop dev bypasses build audits', t => {
  const h = harness(t, { reports: [invalid] })
  h.run('dev')
  h.child.emit('exit', 0, null)
  assert.deepEqual(h.calls, [])
  assert.deepEqual(h.entries, [])
  assert.equal(process.exitCode, 0)
})
test('interrupt forwards to child, preserves status and skips output audit', t => {
  const h = harness(t)
  h.run()
  process.emit('SIGINT')
  assert.equal(h.calls.at(-1), 'SIGINT')
  h.child.emit('exit', null, 'SIGINT')
  assert.equal(process.exitCode, 130)
  assert.equal(h.calls.length, 2)
})
test('spawn error returns failure without inspecting old output', t => {
  const h = harness(t)
  h.run()
  h.child.emit('error', new Error('spawn failed'))
  assert.equal(process.exitCode, 1)
  assert.deepEqual(h.errors, ['spawn failed'])
  assert.equal(h.calls.length, 1)
})
test('output audit exceptions fail the build without uncaught callback errors', t => {
  const h = harness(t, { reports: [{ ok: true }, new Error('audit read failed')] })
  h.run()
  assert.doesNotThrow(() => h.child.emit('exit', 0, null))
  assert.equal(process.exitCode, 1)
  assert.deepEqual(h.errors, ['audit read failed'])
})

// Exercise the actual launcher CLI with an explicitly fake Nuxt generator.
// These tests prove orchestration and exit codes, not framework compilation.
function cliFixture(t) {
  const dir = mkdtempSync(resolve(tmpdir(), 'typewords-build-gate-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const put = (path, content) => {
    const file = resolve(dir, path)
    mkdirSync(resolve(file, '..'), { recursive: true })
    writeFileSync(file, content)
  }
  put('package.json', '{"type":"module"}')
  put('node_modules/nuxt/package.json', '{"name":"nuxt","type":"module"}')
  put(
    'node_modules/nuxt/bin/nuxt.mjs',
    `
    import { cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
    writeFileSync('generator-ran', 'yes')
    if (process.env.FIXTURE_NUXT_FAILURE) process.exit(7)
    mkdirSync('.output', { recursive: true })
    cpSync('public', '.output/public', { recursive: true })
    writeFileSync('.output/public/index.html', '<html>fixture</html>')
    if (process.env.FIXTURE_MISSING_OUTPUT) rmSync('.output/public/sound/beep.wav')
    const entry = '.output/public/index.html'
    if (process.env.FIXTURE_ENTRY === 'missing') rmSync(entry)
    if (process.env.FIXTURE_ENTRY === 'empty') writeFileSync(entry, '')
    if (process.env.FIXTURE_ENTRY === 'whitespace') writeFileSync(entry, '   ')
    if (process.env.FIXTURE_ENTRY === 'directory') { rmSync(entry); mkdirSync(entry) }
  `
  )
  for (const name of LIST_FILES) put(`public/list/${name}`, '[]')
  for (const path of STATIC_RESOURCES) put(`public${path}`, 'fixture')
  mkdirSync(resolve(dir, 'scripts'))
  cpSync(resolve(root, 'scripts/desktop.mjs'), resolve(dir, 'scripts/desktop.mjs'))
  cpSync(resolve('scripts/check-desktop-resources.mjs'), resolve(dir, 'scripts/check-desktop-resources.mjs'))
  return {
    dir,
    put,
    run(env = {}) {
      return spawnSync(process.execPath, [resolve(dir, 'scripts/desktop.mjs'), 'build'], {
        cwd: tmpdir(),
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, ...env },
      })
    },
  }
}
test('real CLI succeeds with a complete fixture and uses project root rather than caller cwd', t => {
  const f = cliFixture(t)
  const result = f.run()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(readFileSync(resolve(f.dir, '.output/public/index.html'), 'utf8'), '<html>fixture</html>')
})
test('real CLI blocks missing source before generation and preserves existing output', t => {
  const f = cliFixture(t)
  f.put('.output/public/index.html', 'previous output')
  rmSync(resolve(f.dir, 'public/sound/beep.wav'))
  const result = f.run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /MISSING_FILE.*beep.wav/)
  assert.equal(readFileSync(resolve(f.dir, '.output/public/index.html'), 'utf8'), 'previous output')
  assert.throws(() => readFileSync(resolve(f.dir, 'generator-ran')), { code: 'ENOENT' })
})
test('real CLI fails when generator succeeds but drops a required resource', t => {
  const f = cliFixture(t)
  const result = f.run({ FIXTURE_MISSING_OUTPUT: '1' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Resource audit failed \(\.output\/public\)/)
  assert.match(result.stderr, /MISSING_FILE.*beep.wav/)
})
test('real CLI preserves generator failure without auditing absent output', t => {
  const f = cliFixture(t)
  mkdirSync(resolve(f.dir, '.output'), { recursive: true })
  cpSync(resolve(f.dir, 'public'), resolve(f.dir, '.output/public'), { recursive: true })
  f.put('.output/public/index.html', 'previous complete output')
  const result = f.run({ FIXTURE_NUXT_FAILURE: '1' })
  assert.equal(result.status, 7)
  assert.equal(readFileSync(resolve(f.dir, '.output/public/index.html'), 'utf8'), 'previous complete output')
  assert.doesNotMatch(result.stderr, /Resource audit failed/)
})

for (const entry of ['missing', 'empty', 'whitespace', 'directory']) {
  test(`real CLI rejects ${entry} SPA entry after successful generation`, t => {
    const f = cliFixture(t)
    const result = f.run({ FIXTURE_ENTRY: entry })
    assert.equal(readFileSync(resolve(f.dir, 'generator-ran'), 'utf8'), 'yes')
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /Invalid desktop SPA entry.*index\.html/)
  })
}
