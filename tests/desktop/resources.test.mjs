import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkDesktopResources, LIST_FILES, STATIC_RESOURCES } from '../../scripts/check-desktop-resources.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'typewords-resources-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (path, value) => {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
  }
  for (const path of STATIC_RESOURCES) put(path, 'fixture')
  for (const name of LIST_FILES) {
    const type = name.includes('article') ? 'article' : 'word'
    put(`/list/${name}`, [{ language: 'en', type, url: 'sample.json', length: 1 }])
    put(
      `/dicts/en/${type}/sample.json`,
      type === 'word' ? [{ word: 'hello' }] : [{ title: 'Hello', text: 'Hello', audioSrc: '/sound/sample.mp3' }]
    )
  }
  put('/sound/sample.mp3', 'fixture')
  return { root, put }
}

test('complete explicit resource set and matching dictionary counts pass', t => {
  const { root } = fixture(t)
  const report = checkDesktopResources(root)
  assert.equal(report.ok, true)
  assert.deepEqual(report.errors, [])
  assert.equal(report.counts.length, 4)
  assert.deepEqual(report.staticResources, STATIC_RESOURCES)
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../../scripts/check-desktop-resources.mjs', import.meta.url)), root],
    { encoding: 'utf8' }
  )
  assert.equal(result.status, 0)
  assert.equal(JSON.parse(result.stdout).ok, true)
})

test('missing nested article audio fails, including CLI exit status', t => {
  const { root } = fixture(t)
  rmSync(join(root, 'sound/sample.mp3'))
  const report = checkDesktopResources(root)
  assert.equal(report.ok, false)
  assert.ok(report.errors.some(e => e.code === 'MISSING_FILE' && e.path === '/sound/sample.mp3'))
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../../scripts/check-desktop-resources.mjs', import.meta.url)), root],
    { encoding: 'utf8' }
  )
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).ok, false)
})

test('declared content count mismatch fails without changing catalogues', t => {
  const { root, put } = fixture(t)
  put('/list/article.json', [{ language: 'en', type: 'article', url: 'sample.json', length: 72 }])
  assert.ok(
    checkDesktopResources(root).errors.some(
      e => e.code === 'COUNT_MISMATCH' && e.message.includes('declared 72, actual 1')
    )
  )
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../../scripts/check-desktop-resources.mjs', import.meta.url)), root],
    { encoding: 'utf8' }
  )
  assert.equal(result.status, 1)
})

test('missing catalogue, malformed JSON, invalid metadata and invalid dictionary rows fail', t => {
  const { root, put } = fixture(t)
  rmSync(join(root, 'list/recommend_article.json'))
  put('/list/word.json', '{bad')
  put('/list/recommend_word.json', [{}])
  put('/dicts/en/article/sample.json', [null])
  const report = checkDesktopResources(root)
  for (const code of ['MISSING_FILE', 'INVALID_JSON', 'INVALID_DICTIONARY', 'INVALID_ROW']) {
    assert.ok(
      report.errors.some(e => e.code === code),
      code
    )
  }
})

test('non-array JSON and traversal references fail', t => {
  const { root, put } = fixture(t)
  put('/list/word.json', {})
  put('/dicts/en/article/sample.json', [{ title: 'Hello', text: 'Hello', audioSrc: '/../outside.mp3' }])
  const report = checkDesktopResources(root)
  assert.ok(report.errors.some(e => e.code === 'INVALID_JSON'))
  assert.ok(report.errors.some(e => e.code === 'INVALID_PATH'))
})
