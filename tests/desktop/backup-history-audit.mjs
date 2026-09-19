// Explicit historical evidence audit. Does not execute current browser or native UI.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import test from 'node:test'

if (!process.argv[2])
  throw new Error('Usage: node tests/desktop/backup-history-audit.mjs <historical-evidence-directory>')
const evidence = resolve(process.argv[2])
const require = createRequire(import.meta.url)
const JSZip = require('../../public/libs/jszip.min.js')
const tone = readFileSync(resolve(evidence, 'backup-tone.mp3'))

test('historical Web -> desktop browser artifacts retain practice fields and audio', async () => {
  const web = await JSZip.loadAsync(readFileSync(resolve(evidence, 'backup-web.zip')))
  const desktop = await JSZip.loadAsync(readFileSync(resolve(evidence, 'backup-desktop.zip')))
  const first = JSON.parse(await web.file('data.json').async('string'))
  const second = JSON.parse(await desktop.file('data.json').async('string'))
  assert.deepEqual(second.val.PracticeSaveWord, first.val.PracticeSaveWord)
  assert.deepEqual(second.val.PracticeSaveArticle, first.val.PracticeSaveArticle)
  assert.equal(second.val.setting.val.wordSoundVolume, 0.37)
  assert.equal(second.val.setting.val.articleSoundSpeed, 1.25)
  assert.equal(second.val.dict.val.word.bookList.find(b => b.enName === 'cet4').lastLearnIndex, 7)
  assert.deepEqual(
    second.val.dict.val.word.bookList.find(b => b.id === 'backup-custom').words,
    first.val.dict.val.word.bookList.find(b => b.id === 'backup-custom').words
  )
  assert.deepEqual(
    second.val.dict.val.article.bookList.find(b => b.id === 'backup-articles').articles,
    first.val.dict.val.article.bookList.find(b => b.id === 'backup-articles').articles
  )
  assert.deepEqual(await desktop.file('mp3/backup-tone.mp3').async('nodebuffer'), tone)
})

test('historical desktop -> fresh Web artifacts and reload reports remain consistent', async () => {
  const desktop = await JSZip.loadAsync(readFileSync(resolve(evidence, 'backup-desktop.zip')))
  const web = await JSZip.loadAsync(readFileSync(resolve(evidence, 'backup-web-restored.zip')))
  assert.deepEqual(
    JSON.parse(await web.file('data.json').async('string')),
    JSON.parse(await desktop.file('data.json').async('string'))
  )
  assert.deepEqual(await web.file('mp3/backup-tone.mp3').async('nodebuffer'), tone)
  for (const name of ['desktop', 'web-restored']) {
    const report = JSON.parse(readFileSync(resolve(evidence, `backup-${name}-browser.json`)))
    assert.equal(report.afterReload, true)
    assert.equal(report.audioDuration, 0.3)
    const sync = JSON.parse(report.sync)
    assert.equal(sync.url, '')
    assert.equal(sync.key, '')
    assert.ok(report.libs.every(url => !url.includes('/libs//')))
  }
})
