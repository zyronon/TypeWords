import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const defaultBaseline = resolve(here, '../tests/desktop/fixtures/typecheck/baseline.json')

export function extractDiagnostics(text) {
  return String(text)
    .split(/\r?\n/)
    .filter(line => /error TS\d+:/.test(line))
    .map(line => line.replace(/\(\d+,\d+\)/, '(line,column)'))
}

export function extractPreambleIssues(text) {
  const issues = []
  if (String(text).includes('vue-router/volar/sfc-route-blocks')) {
    issues.push('vue-router/volar/sfc-route-blocks')
  }
  return issues
}

export function difference(left, right) {
  const remaining = [...right]
  return left.filter(line => {
    const index = remaining.indexOf(line)
    if (index === -1) return true
    remaining.splice(index, 1)
    return false
  })
}

export function loadBaseline(path = defaultBaseline) {
  const baseline = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(baseline.diagnostics)) throw new Error('Typecheck baseline missing diagnostics')
  if (!Number.isInteger(baseline.expectedExit)) throw new Error('Typecheck baseline missing expectedExit')
  return baseline
}

export function compareTypecheck({ currentText, baseline, currentExit, baselinePath, currentPath }) {
  const current = extractDiagnostics(currentText).sort()
  const expected = [...baseline.diagnostics].sort()
  const added = difference(current, expected)
  const removed = difference(expected, current)
  const preamble = extractPreambleIssues(currentText)
  return {
    baseline: baselinePath,
    current: currentPath,
    baselineCount: expected.length,
    currentCount: current.length,
    added,
    removed,
    currentExit,
    expectedExit: baseline.expectedExit,
    preamble,
    typecheckPassed: currentExit === 0 && current.length === 0,
    typecheckFailed: currentExit !== 0,
    noNewDiagnostics: added.length === 0,
    note: 'Diagnostic headline multiset comparison ignoring source line/column; not a passing typecheck.',
  }
}

export function buildBaseline({ text, expectedExit = 2, source }) {
  return {
    schema: 'typewords-typecheck-baseline-v1',
    expectedExit,
    count: extractDiagnostics(text).length,
    diagnostics: extractDiagnostics(text).sort(),
    preamble: extractPreambleIssues(text),
    source,
    note: 'Internal no-new-diagnostics baseline. typecheck exit 2 remains failure. Not a passing typecheck.',
  }
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (!key.startsWith('--')) continue
    const name = key.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[name] = next
      i++
    } else {
      out[name] = true
    }
  }
  return out
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const currentPath = args.current
  if (!currentPath) {
    console.error(
      'Usage: node scripts/compare-typecheck.mjs --current <log> [--baseline <json>] [--exit <code>] [--out <json>] [--write-baseline <json>]'
    )
    process.exitCode = 2
    return
  }
  const text = readFileSync(currentPath, 'utf8')
  const currentExit = args.exit === undefined ? 2 : Number(args.exit)
  if (args['write-baseline']) {
    const baseline = buildBaseline({ text, expectedExit: currentExit, source: currentPath })
    writeFileSync(args['write-baseline'], `${JSON.stringify(baseline, null, 2)}\n`)
    console.log(
      JSON.stringify(
        { wrote: args['write-baseline'], count: baseline.count, expectedExit: baseline.expectedExit },
        null,
        2
      )
    )
    process.exitCode = 0
    return
  }
  const baselinePath = resolve(args.baseline || defaultBaseline)
  const result = compareTypecheck({
    currentText: text,
    baseline: loadBaseline(baselinePath),
    currentExit,
    baselinePath,
    currentPath,
  })
  const encoded = JSON.stringify(result, null, 2)
  if (args.out) writeFileSync(args.out, `${encoded}\n`)
  console.log(encoded)
  process.exitCode = result.added.length ? 1 : 0
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) runCli()
