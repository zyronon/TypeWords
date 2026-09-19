import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const source = readFileSync(resolve(root, 'app/components/dialog/BackupGateDialog.vue'), 'utf8')
const body = source.slice(source.indexOf('async function onBackup()'), source.indexOf('</script>'))
function harness(exportData, isDesktop = true, disabled = null) {
  const sandbox = {
    backupTriggered: false,
    backupRequest: 0,
    exportData,
    isDesktop,
    model: { value: true },
    Blob,
    localStorage: { getItem: () => disabled },
    Toast: { success() {}, error() {} },
    exports: {},
  }
  runInNewContext(
    ts.transpileModule(body + '\nexports.onBackup = onBackup', { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
      .outputText,
    sandbox
  )
  return sandbox
}
test('backup gate stays closed while pending and after native cancel', async () => {
  let finish
  const h = harness(() => new Promise(r => (finish = r)))
  const pending = h.exports.onBackup()
  assert.equal(h.backupTriggered, false)
  finish(undefined)
  await pending
  assert.equal(h.backupTriggered, false)
})
test('backup gate opens only after successful backup Blob', async () => {
  const h = harness(async () => new Blob(['zip']))
  await h.exports.onBackup()
  assert.equal(h.backupTriggered, true)
})
test('backup gate remains closed on export errors even after earlier success', async () => {
  const h = harness(async () => {
    throw Error('disk full')
  })
  h.backupTriggered = true
  await h.exports.onBackup().catch(() => {})
  assert.equal(h.backupTriggered, false)
})
test('desktop never bypasses backup through legacy disable360 setting', async () => {
  let calls = 0
  const h = harness(
    async () => {
      calls++
      return undefined
    },
    true,
    '1'
  )
  await h.exports.onBackup()
  assert.equal(calls, 1)
  assert.equal(h.backupTriggered, false)
})
test('Web retains existing explicit legacy disable360 escape hatch', async () => {
  const h = harness(
    async () => {
      throw Error('not reached')
    },
    false,
    '1'
  )
  await h.exports.onBackup()
  assert.equal(h.backupTriggered, true)
})
test('closing dialog during export does not unlock a later opening', async () => {
  let finish
  const h = harness(() => new Promise(r => (finish = r)))
  const pending = h.exports.onBackup()
  h.model.value = false
  h.backupRequest++ // Closing watch invalidates the old export completion.
  h.model.value = true
  finish(new Blob(['zip']))
  await pending
  assert.equal(h.backupTriggered, false)
})
