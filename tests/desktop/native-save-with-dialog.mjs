// Drive the real Save As dialog while an explicit native runner waits.
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const [evidencePath, mode] = process.argv.slice(2)
if (!evidencePath || !['save-failure', 'save-retry', 'cache-errors', 'source-errors'].includes(mode)) {
  throw new Error('Usage: native-save-with-dialog.mjs <evidence> save-failure|save-retry|cache-errors|source-errors')
}
const evidence = resolve(evidencePath)
const target =
  mode === 'save-failure'
    ? resolve(evidence, 'selected-readonly.zip')
    : mode === 'cache-errors'
      ? resolve(evidence, 'cache-ui-unlock.zip')
      : mode === 'source-errors'
        ? resolve(evidence, 'source-ui-unlock.zip')
        : resolve(evidence, 'retry-backup.zip')
const dialog = spawn(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    resolve('tests/desktop/native-save-dialog.ps1'),
    '-Path',
    target,
    '-Seconds',
    '90',
  ],
  { windowsHide: true }
)
const dialogOut = []
const dialogErr = []
dialog.stdout.on('data', chunk => dialogOut.push(chunk))
dialog.stderr.on('data', chunk => dialogErr.push(chunk))
const runner = spawn(process.execPath, [resolve('tests/desktop/native-local-recovery.mjs'), mode, evidence], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: process.env,
})
const [dialogCode, runnerCode] = await Promise.all([
  new Promise((resolveDone, reject) => {
    dialog.on('error', reject)
    dialog.on('exit', code => resolveDone(code ?? 1))
  }),
  new Promise((resolveDone, reject) => {
    runner.on('error', reject)
    runner.on('exit', code => resolveDone(code ?? 1))
  }),
])
if (runnerCode !== 0) process.exit(runnerCode)
if (dialogCode !== 0) {
  console.log(
    `Dialog helper exited ${dialogCode} after runner passed: ${Buffer.concat(dialogErr).toString('utf8') || Buffer.concat(dialogOut).toString('utf8')}`
  )
} else {
  console.log(`Dialog selected ${target}: ${Buffer.concat(dialogOut).toString('utf8').trim()}`)
}
