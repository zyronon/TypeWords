import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
test('internal installer keeps stable identity and uses per-user NSIS with explicit online WebView setup', () => {
  const base = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json')))
  const config = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.internal.conf.json')))
  assert.equal(config.identifier, undefined)
  assert.equal(config.app, undefined)
  assert.equal(config.version, undefined)
  assert.equal(base.identifier, 'io.github.zyronon.typewords')
  assert.equal(config.bundle.active, true)
  assert.deepEqual(config.bundle.targets, ['nsis'])
  assert.equal(config.bundle.windows.nsis.installMode, 'currentUser')
  assert.equal(config.bundle.windows.allowDowngrades, false)
  assert.deepEqual(config.bundle.windows.webviewInstallMode, { type: 'downloadBootstrapper', silent: true })
  assert.equal(config.bundle.createUpdaterArtifacts, false)
})
test('failed-upgrade runner refuses 0.1.2 through invoke-setup instead of launching raw NSIS', () => {
  const script = readFileSync(resolve(root, 'tests/desktop/native-failed-upgrade.ps1'), 'utf8')
  assert.match(script, /invoke-setup\.ps1/)
  assert.match(script, /TypeWords_0\.1\.2_x64-setup\.exe/)
  assert.match(script, /TypeWords_0\.1\.3_x64-setup\.exe/)
  assert.match(script, /allowDowngrades=false/)
  assert.match(script, /0\.1\.3/)
  assert.match(script, /io\.github\.zyronon\.typewords/)
  assert.match(script, /restored/)
  assert.match(script, /wrapperBlockedSilentDowngrade/)
  assert.doesNotMatch(script, /Start-Process -FilePath \$setup/)
  assert.doesNotMatch(script, /Get-NetTCPConnection/)
})
test('invoke-setup compares DisplayVersion and refuses older setups before Start-Process', () => {
  const script = readFileSync(resolve(root, 'scripts/invoke-setup.ps1'), 'utf8')
  assert.match(script, /DisplayVersion/)
  assert.match(script, /TypeWords_<version>_x64-setup\.exe/)
  assert.match(script, /installed DisplayVersion/)
  assert.match(script, /Write-TypeWordsSetupResult \$record 2/)
  assert.match(script, /Start-Process/)
  assert.ok(script.indexOf('Write-TypeWordsSetupResult $record 2') < script.indexOf('Start-Process'))
  assert.doesNotMatch(script, /Get-NetTCPConnection/)
})
test('install lifecycle helpers probe CDP over HTTP instead of Get-NetTCPConnection', () => {
  const helper = readFileSync(resolve(root, 'tests/desktop/cdp-port.ps1'), 'utf8')
  assert.match(helper, /json\/version/)
  assert.doesNotMatch(helper, /Get-NetTCPConnection/)
  for (const name of ['close-installed.ps1', 'launch-existing.ps1']) {
    const script = readFileSync(resolve(root, `tests/desktop/${name}`), 'utf8')
    assert.match(script, /cdp-port\.ps1/)
    assert.match(script, /Wait-TypeWordsCdp|Test-TypeWordsCdp/)
    assert.doesNotMatch(script, /Get-NetTCPConnection/)
  }
})
test('internal build launches native Windows x64 and explicitly disables signing, rejecting other hosts', async () => {
  const { internalBuildCommand } = await import(pathToFileURL(resolve(root, 'scripts/desktop-internal.mjs')))
  const cmd = internalBuildCommand('win32', 'x64')
  assert.equal(cmd.command, process.execPath)
  assert.deepEqual(cmd.args.slice(1), [
    'build',
    '--target',
    'x86_64-pc-windows-msvc',
    '--config',
    'src-tauri/tauri.internal.conf.json',
    '--bundles',
    'nsis',
    '--no-sign',
    '--ci',
  ])
  assert.throws(() => internalBuildCommand('linux', 'x64'), /Windows x64/)
  assert.throws(() => internalBuildCommand('win32', 'arm64'), /Windows x64/)
})
