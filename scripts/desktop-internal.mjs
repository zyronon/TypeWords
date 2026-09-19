import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))

export function internalBuildCommand(platform = process.platform, arch = process.arch) {
  if (platform !== 'win32' || arch !== 'x64') {
    throw new Error(
      'Internal installers require a native Windows x64 Node/Rust toolchain; run this command in the Windows checkout.'
    )
  }
  return {
    command: process.execPath,
    args: [
      require.resolve('@tauri-apps/cli/tauri.js'),
      'build',
      '--target',
      'x86_64-pc-windows-msvc',
      '--config',
      'src-tauri/tauri.internal.conf.json',
      '--bundles',
      'nsis',
      '--no-sign',
      '--ci',
    ],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { command, args } = internalBuildCommand()
    console.log(
      'Building UNSIGNED internal NSIS installer; clean-machine, upgrade, offline and public-release acceptance remain separate.'
    )
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
