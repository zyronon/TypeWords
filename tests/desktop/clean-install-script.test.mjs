import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const root = resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd())
const script = resolve(root, 'scripts/check-desktop-clean-install.mjs')
const snapshot = resolve(root, 'scripts/check-desktop-test-snapshot.mjs')
const { SKIP_SOURCE, copyCleanTree, isSecretSource, parseNodeTestCounts } = await import(pathToFileURL(script))

test('clean-install script installs from the lockfile and does not reuse origin node_modules', () => {
  const source = readFileSync(script, 'utf8')
  const snapshotSource = readFileSync(snapshot, 'utf8')
  assert.match(source, /pnpm install --frozen-lockfile/)
  assert.match(source, /reusedOriginNodeModules: false/)
  assert.match(source, /pnpm\.exe/)
  assert.match(source, /\(cmd\|bat\)/)
  assert.doesNotMatch(source, /symlinkSync/)
  assert.match(snapshotSource, /symlinkSync/)
  assert.match(snapshotSource, /existing node_modules reused/)
})

test('clean source filters drop plans, caches, and local env or key files', () => {
  assert.equal(SKIP_SOURCE.test('docs/plans/tauri2-desktop-migration-plan.md'), true)
  assert.equal(SKIP_SOURCE.test('.nuxt/index.mjs'), true)
  assert.equal(SKIP_SOURCE.test('.output/public/index.html'), true)
  assert.equal(SKIP_SOURCE.test('node_modules/nuxt/package.json'), true)
  assert.equal(SKIP_SOURCE.test('app/pages/setting.vue'), false)
  assert.equal(isSecretSource('.env'), true)
  assert.equal(isSecretSource('.env.local'), true)
  assert.equal(isSecretSource('.env.example'), false)
  assert.equal(isSecretSource('certs/dev.pem'), true)
  assert.equal(isSecretSource('package.json'), false)
})

test('node test summary parser reads official # and ℹ count lines', () => {
  assert.deepEqual(parseNodeTestCounts('# tests 655\n# pass 655\n# fail 0\n# skipped 0\n'), {
    tests: 655,
    pass: 655,
    fail: 0,
    skipped: 0,
    cancelled: null,
    todo: null,
  })
  assert.deepEqual(parseNodeTestCounts('ℹ tests 659\nℹ pass 659\nℹ fail 0\nℹ skipped 0\n'), {
    tests: 659,
    pass: 659,
    fail: 0,
    skipped: 0,
    cancelled: null,
    todo: null,
  })
})

test(
  'copy-only tree has the lockfile and no docs/plans, .nuxt, .output, or node_modules',
  { skip: !existsSync(join(root, '.git')) },
  () => {
    const dest = mkdtempSync(join(tmpdir(), 'tw-clean-copy-'))
    try {
      const copy = copyCleanTree(root, dest)
      assert.ok(copy.fileCount > 400, `expected a full source copy, got ${copy.fileCount}`)
      assert.equal(copy.absent['docs/plans'], true)
      assert.equal(copy.absent['.nuxt'], true)
      assert.equal(copy.absent['.output'], true)
      assert.equal(copy.absent.node_modules, true)
      assert.equal(existsSync(join(dest, 'pnpm-lock.yaml')), true)
      assert.equal(existsSync(join(dest, 'package.json')), true)
      assert.equal(existsSync(join(dest, 'node_modules')), false)
      assert.equal(existsSync(join(dest, 'docs/plans')), false)
      assert.equal(existsSync(join(dest, '.nuxt')), false)
      assert.equal(existsSync(join(dest, '.output')), false)
      assert.ok(copy.files.some(file => file.name === 'pnpm-lock.yaml' && file.sha256))
    } finally {
      rmSync(dest, { recursive: true, force: true })
    }
  }
)
