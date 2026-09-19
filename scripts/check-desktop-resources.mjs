import { readFileSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const LIST_FILES = ['word.json', 'recommend_word.json', 'article.json', 'recommend_article.json']

// Explicit audited set, not automatic discovery of every source-code asset reference.
export const STATIC_RESOURCES = [
  ...['Shepherd.14.5.1.mjs.js', 'snapdom.min.js', 'jszip.min.js', 'xlsx.full.min.js'].map(name => `/libs/${name}`),
  '/sound/beep.wav',
  '/sound/correct.wav',
  ...Array.from({ length: 4 }, (_, i) => `/sound/key-sounds/jixie/机械${i}.mp3`),
  ...['机械键盘1', '机械键盘2', '老式机械键盘', '笔记本键盘'].map(name => `/sound/key-sounds/${name}.mp3`),
  '/imgs/mini.png',
  '/imgs/empty.svg',
]

export function checkDesktopResources(root = 'public') {
  root = resolve(root)
  const errors = []
  const references = new Set()
  const counts = []
  const fail = (code, path, message) => errors.push({ code, path, message })
  function localFile(path) {
    const file = resolve(root, `.${path}`)
    const rel = relative(root, file)
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      rel === '..' ||
      rel.startsWith(`..${sep}`) ||
      isAbsolute(rel)
    ) {
      fail('INVALID_PATH', path, 'Expected a local path inside the resource root')
      return null
    }
    references.add(path)
    try {
      if (statSync(file).isFile()) return file
    } catch {}
    fail('MISSING_FILE', path, 'Required resource is not a file')
    return null
  }
  function readArray(path) {
    const file = localFile(path)
    if (!file) return null
    try {
      const value = JSON.parse(readFileSync(file, 'utf8'))
      if (!Array.isArray(value)) throw new Error('Expected a JSON array')
      return value
    } catch (error) {
      fail('INVALID_JSON', path, error.message)
      return null
    }
  }
  function inspectReferences(value) {
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (['audioSrc', 'cover', 'src'].includes(key) && typeof child === 'string' && child.startsWith('/'))
        localFile(child)
      else if (child && typeof child === 'object') inspectReferences(child)
    }
  }
  for (const name of LIST_FILES) {
    const listPath = `/list/${name}`
    const list = readArray(listPath)
    if (!list) continue
    const type = name.includes('article') ? 'article' : 'word'
    for (const dict of list) {
      if (
        !dict ||
        typeof dict !== 'object' ||
        dict.type !== type ||
        typeof dict.language !== 'string' ||
        !dict.language ||
        typeof dict.url !== 'string' ||
        !dict.url ||
        !Number.isInteger(dict.length) ||
        dict.length < 0
      ) {
        fail('INVALID_DICTIONARY', listPath, 'Expected language, url, matching type and non-negative integer length')
        continue
      }
      inspectReferences(dict)
      const dictPath = `/dicts/${dict.language}/${type}/${dict.url}`
      const rows = readArray(dictPath)
      if (!rows) continue
      counts.push({ list: listPath, path: dictPath, declared: dict.length, actual: rows.length })
      if (rows.length !== dict.length)
        fail('COUNT_MISMATCH', dictPath, `${listPath}: declared ${dict.length}, actual ${rows.length}`)
      rows.forEach((row, index) => {
        const required = type === 'word' ? ['word'] : ['title', 'text']
        if (!row || typeof row !== 'object' || required.some(key => typeof row[key] !== 'string')) {
          fail('INVALID_ROW', dictPath, `Row ${index} must contain string fields: ${required.join(', ')}`)
        }
        inspectReferences(row)
      })
    }
  }
  for (const path of STATIC_RESOURCES) localFile(path)
  return {
    ok: errors.length === 0,
    root,
    scope:
      'Four catalogues, their dictionaries and local audioSrc/cover/src references, plus the explicit staticResources set; no automatic source-code discovery',
    staticResources: STATIC_RESOURCES,
    references: [...references],
    counts,
    errors,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = checkDesktopResources(process.argv[2] || 'public')
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.ok ? 0 : 1
}
