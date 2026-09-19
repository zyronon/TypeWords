// Independent source tree + lockfile install + regression.
// Does not reuse the originating checkout's node_modules.
// Not a clean Git commit of the dirty worktree, release build, or EXE/NSIS rebuild.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SKIP_SOURCE = /^(?:docs\/plans|node_modules|\.git|\.nuxt|\.output|src-tauri\/target)(?:\/|$)/
const LOCKFILE = 'pnpm-lock.yaml'
const root = fileURLToPath(new URL('../', import.meta.url))

export function inside(base, path) {
  const rel = relative(base, path)
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
}

export function isSecretSource(name) {
  const base = name.split('/').pop()
  if (base === '.env.example') return false
  if (base === '.env' || base.startsWith('.env.')) return true
  if (/\.(?:pem|pfx|p12)$/i.test(base)) return true
  return false
}

export function parseNodeTestCounts(text) {
  const read = label => {
    const match = String(text).match(new RegExp(`^(?:# |ℹ |info )?${label} (\\d+)`, 'm'))
    return match ? Number(match[1]) : null
  }
  return {
    tests: read('tests'),
    pass: read('pass'),
    fail: read('fail'),
    skipped: read('skipped'),
    cancelled: read('cancelled'),
    todo: read('todo'),
  }
}

export function listCleanSourceFiles(origin = root) {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: origin,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (listed.status !== 0) throw new Error(listed.stderr || 'Cannot enumerate source files')
  return [...new Set(listed.stdout.split('\0').filter(Boolean))]
    .filter(name => !SKIP_SOURCE.test(name) && !isSecretSource(name))
    .sort()
}

function flag(args, name) {
  return args.includes(name)
}

function opt(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function resolveTool(names) {
  for (const name of names) {
    const found =
      process.platform === 'win32'
        ? spawnSync('where.exe', [name], { encoding: 'utf8' })
        : spawnSync('command', ['-v', name], { encoding: 'utf8' })
    if (found.status !== 0) continue
    const path = found.stdout.split(/\r?\n/).find(Boolean)
    if (path) return { name, path }
  }
  return null
}

function runCaptured(command, args, { cwd, env, shell = false }) {
  const started = Date.now()
  const useShell = shell || /\.(cmd|bat)$/i.test(command)
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: useShell,
    windowsHide: true,
  })
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    signal: result.signal,
    error: result.error ? result.error.message : null,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    durationMs: Date.now() - started,
  }
}

function writeLog(path, captured) {
  if (!path) return
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    [
      `$ ${captured.command}`,
      `exit ${captured.status}`,
      captured.signal ? `signal ${captured.signal}` : '',
      captured.error ? `error ${captured.error}` : '',
      '',
      captured.stdout,
      captured.stderr,
    ]
      .filter(line => line !== undefined)
      .join('\n')
  )
}

export function copyCleanTree(origin, dest) {
  assert.ok(!inside(origin, dest), `Destination is inside the origin tree: ${dest}`)
  assert.ok(!inside(dest, origin), `Origin is inside the destination tree: ${origin}`)
  mkdirSync(dest, { recursive: true })
  const files = []
  for (const name of listCleanSourceFiles(origin)) {
    const source = resolve(origin, name)
    const target = resolve(dest, name)
    assert.ok(inside(origin, source) && inside(dest, target), `Unsafe source path: ${name}`)
    if (!existsSync(source)) continue
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
    const buf = readFileSync(source)
    files.push({
      name,
      size: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
    })
  }
  const absent = {
    'docs/plans': !existsSync(resolve(dest, 'docs/plans')),
    '.nuxt': !existsSync(resolve(dest, '.nuxt')),
    '.output': !existsSync(resolve(dest, '.output')),
    node_modules: !existsSync(resolve(dest, 'node_modules')),
    '.env': !existsSync(resolve(dest, '.env')),
  }
  assert.equal(absent['docs/plans'], true)
  assert.equal(absent['.nuxt'], true)
  assert.equal(absent['.output'], true)
  assert.equal(absent.node_modules, true)
  assert.ok(existsSync(resolve(dest, LOCKFILE)), `Missing ${LOCKFILE}`)
  assert.ok(existsSync(resolve(dest, 'package.json')), 'Missing package.json')
  return { fileCount: files.length, files, absent }
}

function cleanEnv(env = process.env) {
  const next = { ...env }
  delete next.TYPEWORDS_TEST_ROOT
  return next
}

export function buildCleanInstallPlan(args = process.argv.slice(2), origin = root) {
  const dest = opt(args, '--dest')
    ? resolve(opt(args, '--dest'))
    : mkdtempSync(resolve(tmpdir(), 'typewords-clean-install-'))
  return {
    origin: resolve(origin),
    dest,
    keep: flag(args, '--keep'),
    copyOnly: flag(args, '--copy-only'),
    skipResources: flag(args, '--skip-resources'),
    skipRust: flag(args, '--skip-rust'),
    withDualBuild: flag(args, '--with-dual-build'),
    report: opt(args, '--report'),
    installLog: opt(args, '--install-log'),
    testLog: opt(args, '--test-log'),
    resourcesLog: opt(args, '--resources-log'),
    rustLog: opt(args, '--rust-log'),
    dualBuildLog: opt(args, '--dual-build-log'),
  }
}

function recordGit(origin) {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: origin, encoding: 'utf8' })
  const porcelain = spawnSync('git', ['status', '--porcelain'], { cwd: origin, encoding: 'utf8' })
  return {
    head: head.status === 0 ? head.stdout.trim() : null,
    dirty: porcelain.status === 0 ? porcelain.stdout.split(/\r?\n/).filter(Boolean).length : null,
    committed: false,
    method:
      'Independent copy of git ls-files --cached --others --exclude-standard from the current worktree; excluded docs/plans, .nuxt, .output, node_modules, .git, src-tauri/target and local env/key files. Not a git clone of HEAD and not a commit of the dirty worktree.',
  }
}

function runPnpm(dest, args, env) {
  const pnpm = resolveTool(['pnpm.exe', 'pnpm.cmd', 'pnpm'])
  if (!pnpm) throw new Error('pnpm is not on PATH; cannot install from lockfile')
  return {
    tool: pnpm,
    ...runCaptured(pnpm.path, args, { cwd: dest, env }),
  }
}

export function runCleanInstall(plan) {
  const env = cleanEnv()
  const report = {
    createdAt: new Date().toISOString(),
    git: recordGit(plan.origin),
    origin: plan.origin,
    dest: plan.dest,
    lockfile: LOCKFILE,
    copy: null,
    install: null,
    test: null,
    resources: null,
    rust: null,
    dualBuild: null,
  }
  report.copy = copyCleanTree(plan.origin, plan.dest)
  if (plan.copyOnly) return report

  const version = runPnpm(plan.dest, ['--version'], env)
  const store = runPnpm(plan.dest, ['store', 'path'], env)
  const install = runPnpm(plan.dest, ['install', '--frozen-lockfile'], env)
  writeLog(plan.installLog, install)
  report.install = {
    command: 'pnpm install --frozen-lockfile',
    tool: version.tool,
    pnpmVersion: version.stdout.trim(),
    storePath: store.status === 0 ? store.stdout.trim() : null,
    reusedOriginNodeModules: false,
    status: install.status,
    signal: install.status === 0 ? null : install.signal,
    error: install.error,
    durationMs: install.durationMs,
    log: plan.installLog || null,
  }
  if (install.status !== 0) {
    report.install.stderrTail = install.stderr.slice(-4000)
    return report
  }

  const test = runPnpm(plan.dest, ['run', 'test:desktop'], env)
  writeLog(plan.testLog, test)
  const counts = parseNodeTestCounts(`${test.stdout}\n${test.stderr}`)
  report.test = {
    command: 'pnpm run test:desktop',
    status: test.status,
    signal: test.signal,
    error: test.error,
    durationMs: test.durationMs,
    counts,
    log: plan.testLog || null,
  }
  if (test.status !== 0) return report

  if (!plan.skipResources) {
    const resources = runPnpm(plan.dest, ['run', 'desktop:check-resources'], env)
    writeLog(plan.resourcesLog, resources)
    report.resources = {
      command: 'pnpm run desktop:check-resources',
      status: resources.status,
      signal: resources.signal,
      error: resources.error,
      durationMs: resources.durationMs,
      log: plan.resourcesLog || null,
    }
    if (resources.status !== 0) return report
  }

  if (!plan.skipRust) {
    const cargo = resolveTool(['cargo.exe', 'cargo'])
    if (!cargo) {
      report.rust = { skipped: true, reason: 'cargo is not on PATH' }
    } else {
      const checks = [
        ['fmt', ['fmt', '--manifest-path', 'src-tauri/Cargo.toml', '--check']],
        ['check', ['check', '--locked', '--manifest-path', 'src-tauri/Cargo.toml']],
        ['test', ['test', '--locked', '--manifest-path', 'src-tauri/Cargo.toml']],
        [
          'clippy',
          ['clippy', '--locked', '--manifest-path', 'src-tauri/Cargo.toml', '--all-targets', '--', '-D', 'warnings'],
        ],
      ]
      const rustEnv = { ...env }
      delete rustEnv.CARGO_TARGET_DIR
      const results = []
      let rustLog = ''
      for (const [name, args] of checks) {
        const captured = runCaptured(cargo.path, args, { cwd: plan.dest, env: rustEnv })
        rustLog += `$ ${captured.command}\nexit ${captured.status}\n${captured.stdout}\n${captured.stderr}\n`
        results.push({
          name,
          command: `cargo ${args.join(' ')}`,
          status: captured.status,
          signal: captured.signal,
          error: captured.error,
          durationMs: captured.durationMs,
        })
        if (captured.status !== 0) break
      }
      if (plan.rustLog) {
        mkdirSync(dirname(plan.rustLog), { recursive: true })
        writeFileSync(plan.rustLog, rustLog)
      }
      report.rust = { tool: cargo, results, log: plan.rustLog || null }
    }
  }

  if (plan.withDualBuild) {
    const web = runPnpm(plan.dest, ['run', 'build'], env)
    const desktop = web.status === 0 ? runPnpm(plan.dest, ['run', 'desktop:frontend:build'], env) : null
    writeLog(
      plan.dualBuildLog,
      desktop
        ? {
            command: `${web.command}\n${desktop.command}`,
            status: desktop.status,
            signal: desktop.signal,
            stdout: `${web.stdout}\n${desktop.stdout}`,
            stderr: `${web.stderr}\n${desktop.stderr}`,
          }
        : web
    )
    report.dualBuild = {
      commands: ['pnpm run build', 'pnpm run desktop:frontend:build'],
      web: { status: web.status, durationMs: web.durationMs, error: web.error },
      desktop: desktop ? { status: desktop.status, durationMs: desktop.durationMs, error: desktop.error } : null,
      log: plan.dualBuildLog || null,
    }
  }

  return report
}

function exitFrom(report) {
  if (!report.copy) return 1
  if (report.install && report.install.status !== 0) return report.install.status ?? 1
  if (report.test && report.test.status !== 0) return report.test.status ?? 1
  if (report.resources && report.resources.status !== 0) return report.resources.status ?? 1
  if (report.rust && !report.rust.skipped && report.rust.results.some(item => item.status !== 0)) return 1
  if (
    report.dualBuild &&
    (report.dualBuild.web.status !== 0 || (report.dualBuild.desktop && report.dualBuild.desktop.status !== 0))
  )
    return 1
  return 0
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  const plan = buildCleanInstallPlan()
  let created = false
  try {
    if (!existsSync(plan.dest)) {
      mkdirSync(dirname(plan.dest), { recursive: true })
      created = true
    } else {
      assert.equal(readdirSync(plan.dest).length, 0, `Refusing to reuse a non-empty destination: ${plan.dest}`)
    }
    const report = runCleanInstall(plan)
    const json = JSON.stringify(
      {
        ...report,
        copy: {
          fileCount: report.copy.fileCount,
          absent: report.copy.absent,
          files: report.copy.files,
        },
      },
      null,
      2
    )
    if (plan.report) {
      mkdirSync(dirname(plan.report), { recursive: true })
      writeFileSync(plan.report, json)
    }
    console.log(
      [
        `Clean tree: ${report.copy.fileCount} files at ${plan.dest}`,
        `Absent before install: docs/plans=${report.copy.absent['docs/plans']} .nuxt=${report.copy.absent['.nuxt']} .output=${report.copy.absent['.output']} node_modules=${report.copy.absent.node_modules}`,
        report.install
          ? `Install: ${report.install.command} exit ${report.install.status} (${report.install.durationMs}ms) reusedOriginNodeModules=${report.install.reusedOriginNodeModules}`
          : 'Install: skipped (--copy-only)',
        report.test
          ? `Tests: ${report.test.command} exit ${report.test.status} tests=${report.test.counts.tests} pass=${report.test.counts.pass} fail=${report.test.counts.fail}`
          : '',
        report.resources ? `Resources: ${report.resources.command} exit ${report.resources.status}` : '',
        report.rust
          ? report.rust.skipped
            ? `Rust: skipped (${report.rust.reason})`
            : `Rust: ${report.rust.results.map(item => `${item.name}=${item.status}`).join(' ')}`
          : '',
        report.dualBuild
          ? `Dual-build: web=${report.dualBuild.web.status} desktop=${report.dualBuild.desktop && report.dualBuild.desktop.status}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
    process.exitCode = exitFrom(report)
  } finally {
    if (!plan.keep && (created || plan.dest.includes('typewords-clean-install-'))) {
      assert.ok(
        inside(resolve(tmpdir()), plan.dest) || !inside(root, plan.dest),
        'Refusing to delete an unexpected tree'
      )
      if (!inside(root, plan.dest)) rmSync(plan.dest, { recursive: true, force: true })
    }
  }
}
