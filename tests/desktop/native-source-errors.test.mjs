import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd())

test('native recovery runner and dialog wrapper list the source-errors mode', () => {
  const runner = readFileSync(resolve(root, 'tests/desktop/native-local-recovery.mjs'), 'utf8')
  const wrapper = readFileSync(resolve(root, 'tests/desktop/native-save-with-dialog.mjs'), 'utf8')
  assert.match(runner, /source-errors/)
  assert.match(wrapper, /source-errors/)
  assert.match(wrapper, /source-ui-unlock\.zip/)
  assert.match(runner, /cache-errors', 'source-errors'/)
  assert.match(runner, /http:\/\/tauri\.localhost\/setting\?index=5/)
  assert.ok(
    runner.includes("'empty-word-identifier'") &&
      runner.includes("'inverted-fsrs-limits'") &&
      runner.includes("'question-correct-mismatch'") &&
      runner.includes("'cursor-loop-past-list'"),
    'source-errors must exercise the batch 60-62 ZIP/settings/dictionary boundaries'
  )
  assert.match(runner, /word: ''/)
  assert.match(runner, /fsrsEasyLimit = 4/)
  assert.match(runner, /correctIndex: 1/)
  assert.match(runner, /endIndex: 6/)
  assert.match(runner, /Invalid backup dictionary/)
  assert.match(runner, /Invalid backup settings/)
  assert.match(runner, /Invalid backup practice cache/)
})
