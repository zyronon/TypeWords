import { spawn } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkDesktopResources } from './check-desktop-resources.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)

export function desktopCommand(mode, env = process.env) {
  if (!['dev', 'build'].includes(mode)) throw new Error('Usage: node scripts/desktop.mjs <dev|build>')
  const nuxtRoot = dirname(require.resolve('nuxt/package.json'))
  return {
    command: process.execPath,
    args: [
      resolve(nuxtRoot, 'bin/nuxt.mjs'),
      mode === 'build' ? 'generate' : 'dev',
      ...(mode === 'dev' ? ['--host', '127.0.0.1', '--port', '5567', '--no-fork'] : []),
    ],
    options: {
      cwd: root,
      env: { ...env, TYPEWORDS_TARGET: 'desktop', NUXT_APP_BASE_URL: '/' },
      stdio: 'inherit',
      shell: false,
    },
  }
}

function checkDesktopEntry(directory) {
  const entry = resolve(directory, 'index.html')
  try {
    if (statSync(entry).isFile() && readFileSync(entry, 'utf8').trim()) return
  } catch (error) {
    throw new Error(`[desktop] Invalid desktop SPA entry ${entry}: ${error.message}`)
  }
  throw new Error(`[desktop] Invalid desktop SPA entry ${entry}: expected a non-empty file`)
}

export function runDesktop(
  mode,
  { spawnProcess = spawn, checkResources = checkDesktopResources, checkEntry = checkDesktopEntry } = {}
) {
  const { command, args, options } = desktopCommand(mode)
  const audit = directory => {
    const report = checkResources(resolve(root, directory))
    if (!report.ok) {
      throw new Error(
        `[desktop] Resource audit failed (${directory})\n` +
          report.errors.map(error => `${error.code} ${error.path}: ${error.message}`).join('\n')
      )
    }
  }
  // Reject incomplete inputs before generate can replace an existing output.
  if (mode === 'build') audit('public')
  const child = spawnProcess(command, args, options)
  const onInterrupt = () => child.kill('SIGINT')
  const onTerminate = () => child.kill('SIGTERM')
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)
  const cleanup = () => {
    process.off('SIGINT', onInterrupt)
    process.off('SIGTERM', onTerminate)
  }
  child.once('error', error => {
    cleanup()
    console.error(error.message)
    process.exitCode = 1
  })
  child.once('exit', (code, signal) => {
    cleanup()
    process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143)
    // Never validate stale output after a failed or interrupted generate.
    if (mode === 'build' && code === 0 && !signal) {
      try {
        audit('.output/public')
        checkEntry(resolve(root, '.output/public'))
      } catch (error) {
        console.error(error.message)
        process.exitCode = 1
      }
    }
  })
  return child
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/desktop.mjs <dev|build>')
    runDesktop(process.argv[2])
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
