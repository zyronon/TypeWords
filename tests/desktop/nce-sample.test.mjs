import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(process.env.TYPEWORDS_TEST_ROOT || '.')
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
for (const name of ['article', 'recommend_article']) {
  test(`${name} advertises the existing NCE1 content as a five-article sample`, () => {
    const book = read(`public/list/${name}.json`).find(book => book.id === 246)
    assert.ok(book)
    assert.equal(book.name, '新概念英语1（示例，5篇）')
    assert.match(book.description, /仅含 5 篇示例文章，非完整教材/)
    assert.equal(book.enName, 'nce1')
    assert.equal(book.url, 'NCE_1.json')
    assert.equal(book.version, 1)
    const rows = read('public/dicts/en/article/NCE_1.json')
    assert.equal(rows.length, 5)
    assert.equal(book.length, rows.length)
  })
}
