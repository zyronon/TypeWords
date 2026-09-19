import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd())
const workflowPath = resolve(root, '.github/workflows/desktop.yml')
const packagePath = resolve(root, 'package.json')

const ALLOWED_RUNS = [
  'pnpm install --frozen-lockfile',
  'pnpm run test:desktop',
  'pnpm run desktop:check-resources',
  'cargo fmt --manifest-path src-tauri/Cargo.toml --check',
  'cargo check --locked --manifest-path src-tauri/Cargo.toml',
  'cargo test --locked --manifest-path src-tauri/Cargo.toml',
  'cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings',
]

const FORBIDDEN_IN_RUNS = [
  /typecheck/,
  /test:desktop:clean-install/,
  /desktop:frontend:build/,
  /desktop:build/,
  /desktop:bundle/,
  /desktop:dev/,
  /\btauri (?:build|dev|bundle)\b/,
  /nsis/i,
  /\bubuntu\b/,
  /\bmacos\b/,
]

function extractRunCommands(source) {
  const commands = []
  const lines = source.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*#/.test(line)) continue
    const oneLine = line.match(/^(\s+)run:\s+(\S.*)$/)
    if (oneLine) {
      commands.push(oneLine[2].trim())
      continue
    }
    const block = line.match(/^(\s+)run:\s*[|>]-?\s*$/)
    if (!block) continue
    const indent = block[1].length
    const parts = []
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '' || /^\s*#/.test(lines[j])) continue
      const nextIndent = lines[j].match(/^(\s*)/)[1].length
      if (nextIndent <= indent) break
      parts.push(lines[j].trim())
      i = j
    }
    if (parts.length) commands.push(parts.join(' '))
  }
  return commands
}

function pnpmRunNames(commands) {
  return commands.flatMap(command => [...command.matchAll(/\bpnpm run ([^\s]+)/g)].map(match => match[1]))
}

test('desktop workflow exists and every job uses windows-latest', () => {
  assert.equal(existsSync(workflowPath), true, 'expected .github/workflows/desktop.yml')
  const source = readFileSync(workflowPath, 'utf8')
  const runsOn = [...source.matchAll(/^\s*runs-on:\s*(\S+)/gm)].map(match => match[1])
  assert.ok(runsOn.length >= 2, `expected node and rust jobs, got runs-on=${runsOn.join(',')}`)
  assert.ok(
    runsOn.every(value => value === 'windows-latest'),
    `desktop jobs must use windows-latest, got ${runsOn.join(',')}`
  )
  assert.doesNotMatch(source, /^\s*runs-on:\s*(ubuntu|macos)/m)
  assert.match(source, /^\s+desktop-node:/m)
  assert.match(source, /^\s+desktop-rust:/m)
})

test('desktop workflow run steps only cite real lockfile, test, resource, and locked Rust commands', () => {
  const source = readFileSync(workflowPath, 'utf8')
  const scripts = JSON.parse(readFileSync(packagePath, 'utf8')).scripts
  const commands = extractRunCommands(source)
  assert.deepEqual([...commands].sort(), [...ALLOWED_RUNS].sort())
  for (const name of pnpmRunNames(commands)) {
    assert.equal(typeof scripts[name], 'string', `pnpm run ${name} is not a package.json script`)
    assert.notEqual(scripts[name].trim(), '', `pnpm run ${name} must not be an empty script`)
  }
  assert.equal(typeof scripts['test:desktop'], 'string')
  assert.equal(typeof scripts['desktop:check-resources'], 'string')
  assert.match(scripts['test:desktop'], /tests\/desktop\/\*\.test\.mjs/)
  assert.match(scripts['desktop:check-resources'], /check-desktop-resources\.mjs/)
  for (const command of commands) {
    for (const forbidden of FORBIDDEN_IN_RUNS) {
      assert.doesNotMatch(command, forbidden)
    }
  }
})

test('desktop workflow is honest about WebView, installer, typecheck, and the clean-install split', () => {
  const source = readFileSync(workflowPath, 'utf8')
  assert.match(source, /native WebView/)
  assert.match(source, /installer/)
  assert.match(source, /NSIS/)
  assert.match(source, /typecheck-green/)
  assert.match(source, /does not treat typecheck as passing/)
  assert.match(source, /exit 2 \/ 62/)
  assert.match(source, /test:desktop:clean-install/)
  assert.match(source, /not used as Windows verification/)
  const commands = extractRunCommands(source).join('\n')
  assert.doesNotMatch(commands, /typecheck/)
  assert.doesNotMatch(commands, /test:desktop:clean-install/)
  assert.doesNotMatch(commands, /desktop:frontend:build/)
  assert.doesNotMatch(commands, /desktop:build/)
  assert.doesNotMatch(commands, /desktop:bundle/)
})
