// English → Serbian lookup for song words: local CET-4 dictionary first, then the MyMemory API (cached in IndexedDB).
import { get, set } from 'idb-keyval'
import nlp from 'compromise/three'
import type { Word } from '@/core/types/types.ts'
import { resourceWrap } from '@/core/utils'

const CACHE_KEY = 'SongsTranslateCache'
let localDict: Promise<Map<string, Word>> | null = null
let cache: Record<string, string> | null = null

function loadLocalDict() {
  localDict ??= fetch(resourceWrap('/dicts/en/word/CET4_T.json'))
    .then(r => r.json())
    .then((list: Word[]) => new Map(list.map(w => [w.word.toLowerCase(), w])))
    .catch(() => new Map())
  return localDict
}

async function loadCache() {
  if (!cache) {
    try {
      cache = JSON.parse((await get(CACHE_KEY)) || '{}')
    } catch {
      cache = {}
    }
  }
  return cache!
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function saveCache() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => set(CACHE_KEY, JSON.stringify(cache)), 500)
}

/** Base form of a word ("running" → "run", "hearts" → "heart"). */
export function lemma(word: string): string {
  const w = word.toLowerCase().replace(/’/g, "'").replace(/'s$/, '')
  if (w.includes("'")) return w
  try {
    const doc = nlp(w)
    if (doc.verbs().found) return doc.verbs().toInfinitive().text().toLowerCase() || w
    if (doc.nouns().found) return doc.nouns().toSingular().text().toLowerCase() || w
  } catch {}
  return w
}

export async function findLocalWord(word: string): Promise<Word | null> {
  const dict = await loadLocalDict()
  const w = word.toLowerCase()
  return dict.get(w) || dict.get(lemma(w)) || null
}

function shortTrans(w: Word) {
  return w.trans
    .slice(0, 2)
    .map(t => `${t.pos ? t.pos + ' ' : ''}${t.cn.split(';')[0].trim()}`)
    .join('; ')
}

async function myMemory(text: string): Promise<string> {
  const res = await fetch(`https://api.mymemory.translated.net/get?${new URLSearchParams({ q: text, langpair: 'en|sr-Latn' })}`)
  if (!res.ok) throw new Error('Translation service unavailable')
  const data = await res.json()
  if (data.responseStatus && Number(data.responseStatus) !== 200) throw new Error(data.responseDetails || 'Translation failed')
  const out = String(data.responseData?.translatedText || '').trim()
  if (/MYMEMORY WARNING/i.test(out)) throw new Error('Daily translation limit reached')
  return out
}

/** Short Serbian meaning for a single word. */
export async function translateWord(word: string): Promise<{ text: string; source: 'dict' | 'web' | 'none' }> {
  const local = await findLocalWord(word)
  if (local) return { text: shortTrans(local), source: 'dict' }
  const c = await loadCache()
  const key = 'w:' + lemma(word)
  if (c[key]) return { text: c[key], source: 'web' }
  try {
    const text = await myMemory(lemma(word))
    if (text && text.toLowerCase() !== lemma(word)) {
      c[key] = text
      saveCache()
      return { text, source: 'web' }
    }
  } catch {}
  return { text: '', source: 'none' }
}

/** Serbian translation of a whole lyric line (on demand). */
export async function translateLine(line: string): Promise<string> {
  const c = await loadCache()
  const key = 'l:' + line
  if (c[key]) return c[key]
  const text = await myMemory(line)
  c[key] = text
  saveCache()
  return text
}
