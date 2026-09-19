// Source-only regression check, not a clean dependency installation or release build.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
if (listed.status !== 0) throw new Error(listed.stderr || 'Cannot enumerate source files')
const temp = resolve(tmpdir())
const snapshot = mkdtempSync(resolve(temp, 'typewords-test-snapshot-'))
const inside = (base, path) => {
  const rel = relative(base, path)
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
}
try {
  let count = 0
  for (const name of new Set(listed.stdout.split('\0').filter(Boolean))) {
    if (/^(?:docs\/plans|node_modules|\.git|\.nuxt|\.output|src-tauri\/target)(?:\/|$)/.test(name)) continue
    const source = resolve(root, name)
    const target = resolve(snapshot, name)
    assert.ok(inside(root, source) && inside(snapshot, target), `Unsafe source path: ${name}`)
    if (!existsSync(source)) continue // Preserve tracked deletions in the working tree.
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
    count++
  }
  assert.equal(existsSync(resolve(snapshot, 'docs/plans')), false)
  assert.equal(existsSync(resolve(snapshot, '.nuxt')), false)
  assert.equal(existsSync(resolve(snapshot, '.output')), false)
  // Dependencies are intentionally reused; no install scripts or network requests.
  symlinkSync(
    resolve(root, 'node_modules'),
    resolve(snapshot, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  console.log(`Source snapshot: ${count} files; no docs/plans, .nuxt or .output; existing node_modules reused.`)
  const env = { ...process.env }
  delete env.TYPEWORDS_TEST_ROOT
  const result = spawnSync(process.execPath, ['--test', 'tests/desktop/*.test.mjs'], {
    cwd: snapshot,
    env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  // Only remove the generated direct child of the resolved OS temp directory.
  assert.equal(dirname(snapshot), temp)
  assert.ok(inside(temp, snapshot) && snapshot.startsWith(resolve(temp, 'typewords-test-snapshot-')))
  rmSync(snapshot, { recursive: true, force: true })
}
