import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const read = path => readFileSync(resolve(root, path), 'utf8')
const config = () => JSON.parse(read('src-tauri/tauri.conf.json'))

test('native commands reuse the existing desktop frontend and preserve Web commands', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.scripts['desktop:dev'], 'tauri dev')
  assert.equal(pkg.scripts['desktop:build'], 'tauri build --no-bundle')
  assert.equal(pkg.scripts.build, 'nuxt build')
  assert.equal(pkg.scripts.dev, 'nuxt dev')
  assert.equal(pkg.devDependencies['@tauri-apps/cli'], '2.11.4')
})

test('native build consumes the audited static frontend and exact development port', () => {
  const { build } = config()
  assert.equal(build.beforeDevCommand, 'pnpm run desktop:frontend:dev')
  assert.equal(build.beforeBuildCommand, 'pnpm run desktop:frontend:build')
  assert.equal(build.devUrl, 'http://127.0.0.1:5567')
  assert.equal(build.frontendDist, '../.output/public')
})

test('native host uses one local window with no installer or global API', () => {
  const { app, bundle } = config()
  assert.equal(app.windows.length, 1)
  assert.equal(app.windows[0].label, 'main')
  assert.equal(app.windows[0].url, 'index.html')
  assert.equal(app.withGlobalTauri, false)
  assert.equal(bundle.active, false)
  assert.equal(bundle.externalBin, undefined)
  assert.equal(app.windows[0].dataDirectory, undefined)
  assert.equal(app.windows[0].useHttpsScheme, false)
})

test('native permissions select local-only save and scoped opener commands', () => {
  assert.deepEqual(config().app.security.capabilities, ['main'])
  const capability = JSON.parse(read('src-tauri/capabilities/main.json'))
  assert.equal(capability.identifier, 'main')
  assert.deepEqual(capability.windows, ['main'])
  assert.deepEqual(capability.permissions.slice(0, 2), ['dialog:allow-save', 'fs:allow-write-file'])
  assert.equal(capability.permissions[2].identifier, 'opener:allow-open-url')
  assert.equal(capability.permissions.length, 3)
  assert.equal(capability.remote, undefined)
})

test('native production CSP is explicit and keeps development exceptions separate', () => {
  const { csp, devCsp } = config().app.security
  assert.equal(csp['default-src'], "'self'")
  assert.equal(csp['script-src'], "'self'")
  assert.equal(csp['object-src'], "'none'")
  assert.equal(csp['base-uri'], "'self'")
  assert.match(csp['media-src'], /blob:/)
  assert.match(csp['media-src'], /https:\/\/dict\.youdao\.com/)
  assert.doesNotMatch(JSON.stringify(csp), /unsafe-eval|ws:\/\/|https:\/\/\*(?!\.supabase\.co)/)
  assert.equal(
    csp['connect-src']
      .split(' ')
      .filter(value => value.includes('*'))
      .join(' '),
    'https://*.supabase.co'
  )
  assert.match(devCsp['connect-src'], /https:\/\/\*\.supabase\.co/)
  assert.match(devCsp['connect-src'], /ws:\/\/127\.0\.0\.1:24678/)
})

test('Rust host pins Tauri 2 and only approved native plugins', () => {
  const manifest = read('src-tauri/Cargo.toml')
  assert.match(manifest, /tauri = \{ version = "=2\.11\.5"/)
  assert.match(manifest, /tauri-build = \{ version = "=2\.6\.3"/)
  assert.match(manifest, /custom-protocol = \["tauri\/custom-protocol"\]/)
  assert.match(manifest, /tauri-plugin-dialog = "=2\.7\.3"/)
  assert.match(manifest, /tauri-plugin-fs = "=2\.5\.2"/)
  assert.match(manifest, /tauri-plugin-opener = "=2\.5\.5"/)
  assert.doesNotMatch(manifest, /tauri-plugin-(shell|updater)/)
  assert.equal(config().app.windows[0].create, false)
  assert.match(read('src-tauri/src/lib.rs'), /on_navigation\(local_navigation\)/)
  assert.match(read('src-tauri/src/lib.rs'), /NewWindowResponse::Deny/)
  assert.match(read('src-tauri/src/lib.rs'), /tauri::generate_context!\(\)/)
  assert.match(read('src-tauri/build.rs'), /tauri_build::build\(\)/)
})
