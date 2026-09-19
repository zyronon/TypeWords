import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { desktopCommand } from '../../scripts/desktop.mjs'

test('Build launches local Nuxt generate without shell or environment mutation', () => {
  const env = { TYPEWORDS_TARGET: 'web', NUXT_APP_BASE_URL: '/web/', PATH: 'preserved' }
  const command = desktopCommand('build', env)
  assert.equal(command.command, process.execPath)
  assert.match(command.args[0], /nuxt\.mjs$/)
  assert.equal(command.args[1], 'generate')
  assert.equal(command.options.shell, false)
  assert.equal(command.options.env.TYPEWORDS_TARGET, 'desktop')
  assert.equal(command.options.env.NUXT_APP_BASE_URL, '/')
  assert.equal(command.options.env.PATH, 'preserved')
  assert.equal(env.TYPEWORDS_TARGET, 'web')
})

test('Dev uses the exact loopback host and port', () => {
  assert.deepEqual(desktopCommand('dev').args.slice(1), ['dev', '--host', '127.0.0.1', '--port', '5567', '--no-fork'])
})

test('Invalid command fails before launching Nuxt', () => {
  assert.throws(() => desktopCommand('preview'), /Usage:/)
  const result = spawnSync(process.execPath, ['scripts/desktop.mjs', 'invalid'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Usage:/)
})
