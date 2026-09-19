import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const root = resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd())
const script = resolve(root, 'scripts/compare-typecheck.mjs')
const baselinePath = resolve(root, 'tests/desktop/fixtures/typecheck/baseline.json')
const { compareTypecheck, extractDiagnostics, loadBaseline, buildBaseline, difference } = await import(
  pathToFileURL(script)
)

const sample = [
  "app/base/form/FormItem.vue(13,26): error TS2749: 'ref' refers to a value, but is being used as a type here. Did you mean 'typeof ref'?",
  "app/core/hooks/sound.ts(211,7): error TS2322: Type 'Timeout' is not assignable to type 'number'.",
].join('\n')

test('trackable typecheck baseline freezes 62 diagnostics and exit 2 as failure', () => {
  const baseline = loadBaseline(baselinePath)
  assert.equal(baseline.schema, 'typewords-typecheck-baseline-v1')
  assert.equal(baseline.expectedExit, 2)
  assert.equal(baseline.count, 62)
  assert.equal(baseline.diagnostics.length, 62)
  assert.ok(baseline.diagnostics.every(line => /error TS\d+:/.test(line)))
  assert.match(baseline.note, /not a passing typecheck/i)
})

test('comparer treats line and column movement as the same diagnostic', () => {
  const baseline = buildBaseline({ text: sample, expectedExit: 2 })
  const moved = sample.replace('(13,26)', '(99,1)').replace('(211,7)', '(1,1)')
  const result = compareTypecheck({ currentText: moved, baseline, currentExit: 2 })
  assert.deepEqual(result.added, [])
  assert.deepEqual(result.removed, [])
  assert.equal(result.noNewDiagnostics, true)
  assert.equal(result.typecheckFailed, true)
  assert.equal(result.typecheckPassed, false)
})

test('comparer reports an added diagnostic and does not call that a passing typecheck', () => {
  const baseline = buildBaseline({ text: sample, expectedExit: 2 })
  const current = sample + '\napp/new.ts(1,1): error TS0000: invented'
  const result = compareTypecheck({ currentText: current, baseline, currentExit: 2 })
  assert.equal(result.added.length, 1)
  assert.match(result.added[0], /error TS0000/)
  assert.equal(result.noNewDiagnostics, false)
  assert.equal(result.typecheckPassed, false)
})

test('reconstructed baseline headlines compare with no added or removed diagnostics', () => {
  const baseline = loadBaseline(baselinePath)
  const result = compareTypecheck({
    currentText: baseline.diagnostics.join('\n'),
    baseline,
    currentExit: baseline.expectedExit,
  })
  assert.equal(result.baselineCount, 62)
  assert.equal(result.currentCount, 62)
  assert.deepEqual(result.added, [])
  assert.deepEqual(result.removed, [])
  assert.equal(result.typecheckFailed, true)
  assert.equal(result.typecheckPassed, false)
})

test('comparer CLI writes a baseline and fails only when diagnostics are added', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tw-typecheck-'))
  try {
    const log = join(dir, 'current.log')
    const written = join(dir, 'baseline.json')
    const out = join(dir, 'compare.json')
    writeFileSync(log, sample + '\n')
    const extracted = spawnSync(
      process.execPath,
      [script, '--current', log, '--exit', '2', '--write-baseline', written],
      {
        encoding: 'utf8',
      }
    )
    assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout)
    const stable = spawnSync(
      process.execPath,
      [script, '--current', log, '--baseline', written, '--exit', '2', '--out', out],
      { encoding: 'utf8' }
    )
    assert.equal(stable.status, 0, stable.stderr || stable.stdout)
    const stableResult = JSON.parse(readFileSync(out, 'utf8'))
    assert.deepEqual(stableResult.added, [])
    assert.equal(stableResult.typecheckFailed, true)
    writeFileSync(log, sample + '\napp/extra.ts(2,2): error TS1111: extra\n')
    const grown = spawnSync(process.execPath, [script, '--current', log, '--baseline', written, '--exit', '2'], {
      encoding: 'utf8',
    })
    assert.equal(grown.status, 1, grown.stderr || grown.stdout)
    assert.match(grown.stdout, /error TS1111/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('extract and difference helpers keep a multiset, not a unique set', () => {
  const text = 'a.ts(1,1): error TS1: one\na.ts(2,2): error TS1: one\n'
  assert.equal(extractDiagnostics(text).length, 2)
  assert.deepEqual(difference(['x', 'x'], ['x']), ['x'])
})
