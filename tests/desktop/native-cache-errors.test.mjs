import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd())

test('native recovery runner and dialog wrapper list the cache-errors mode', () => {
  const runner = readFileSync(resolve(root, 'tests/desktop/native-local-recovery.mjs'), 'utf8')
  const wrapper = readFileSync(resolve(root, 'tests/desktop/native-save-with-dialog.mjs'), 'utf8')
  assert.match(runner, /cache-errors/)
  assert.match(wrapper, /cache-errors/)
  assert.match(wrapper, /cache-ui-unlock\.zip/)
  assert.ok(
    runner.includes("'empty-cache-word'") &&
      runner.includes("'negative-word-index'") &&
      runner.includes("'invalid-shortcut-map'") &&
      runner.includes("'empty-word-booklist'"),
    'cache-errors must keep the four 0.1.3-era reject payloads'
  )
  assert.match(runner, /Invalid backup practice cache/)
  assert.match(runner, /Invalid backup settings/)
  assert.match(runner, /Invalid backup dictionary/)
})
