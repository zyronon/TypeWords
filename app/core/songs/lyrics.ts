// Lyrics fetching (LRCLIB), LRC parsing, YouTube link parsing and gap generation for the Songs feature.

export type LyricLine = {
  time: number | null // seconds; null when lyrics are not synced
  text: string
}

export type LyricsCandidate = {
  id: number
  artist: string
  track: string
  album: string
  duration: number
  synced: boolean
  syncedLyrics: string
  plainLyrics: string
}

const LRCLIB = 'https://lrclib.net/api'

export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const url = new URL(s.startsWith('http') ? s : 'https://' + s)
    const host = url.hostname.replace(/^www\.|^m\.|^music\./, '')
    if (host === 'youtu.be') return url.pathname.slice(1, 12) || null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v')
      if (v) return v.slice(0, 11)
      const m = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/)
      if (m) return m[1]
    }
  } catch {}
  return null
}

const NOISE =
  /\s*[([][^)\]]*(official|video|audio|lyric|lyrics|visuali[sz]er|remaster|hd|hq|4k|mv|m\/v|live|explicit|clean|color coded|performance)[^)\]]*[)\]]/gi

/** Remove the artist and "(Official Video)"-style noise from a track name ("Drake - Song" → "Song"). */
export function cleanTrackName(track: string, artist: string): string {
  let t = track.replace(NOISE, '').trim()
  const a = artist.trim().toLowerCase()
  if (a) {
    const m = t.toLowerCase()
    for (const sep of [' - ', ' – ', ' — ']) {
      if (m.startsWith(a + sep)) t = t.slice(a.length + sep.length)
      else if (m.endsWith(sep + a)) t = t.slice(0, -(a.length + sep.length))
    }
  }
  return t.trim() || track
}

/** Turn a YouTube title like "Artist - Song (Official Video)" into artist/track guesses. */
export function guessArtistTrack(videoTitle: string, channel = ''): { artist: string; track: string } {
  let t = videoTitle.replace(NOISE, '').replace(/\s*\|.*$/, '').replace(/["“”]/g, '').trim()
  t = t.replace(/\s+(ft\.?|feat\.?|featuring)\s+.*$/i, '').trim()
  const parts = t.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) return { artist: parts[0].trim(), track: parts.slice(1).join(' - ').trim() }
  const artist = channel
    .replace(/VEVO$/i, '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*Official.*$/i, '')
    .trim()
  return { artist, track: t }
}

function toCandidate(x: any): LyricsCandidate {
  return {
    id: x.id,
    artist: x.artistName || '',
    track: x.trackName || '',
    album: x.albumName || '',
    duration: Number(x.duration) || 0,
    synced: !!x.syncedLyrics,
    syncedLyrics: x.syncedLyrics || '',
    plainLyrics: x.plainLyrics || '',
  }
}

export async function searchLyrics(artist: string, track: string, freeText = ''): Promise<LyricsCandidate[]> {
  const queries: string[] = []
  if (track) {
    const p = new URLSearchParams({ track_name: track })
    if (artist) p.set('artist_name', artist)
    queries.push(`${LRCLIB}/search?${p}`)
  }
  const q = freeText || [artist, track].filter(Boolean).join(' ')
  if (q) queries.push(`${LRCLIB}/search?${new URLSearchParams({ q })}`)

  const seen = new Set<number>()
  const out: LyricsCandidate[] = []
  for (const url of queries) {
    const res = await fetch(url)
    if (!res.ok) continue
    const list = await res.json()
    for (const x of list || []) {
      if (x.instrumental || seen.has(x.id) || (!x.syncedLyrics && !x.plainLyrics)) continue
      seen.add(x.id)
      out.push(toCandidate(x))
    }
    if (out.some(c => c.synced)) break
  }
  return out
}

/** Prefer synced lyrics whose length is closest to the video length. */
export function rankCandidates(list: LyricsCandidate[], videoDuration: number): LyricsCandidate[] {
  const score = (c: LyricsCandidate) => {
    const diff = videoDuration && c.duration ? Math.abs(c.duration - videoDuration) : 30
    return (c.synced ? 0 : 1000) + diff
  }
  return [...list].sort((a, b) => score(a) - score(b))
}

export function parseLyrics(c: Pick<LyricsCandidate, 'syncedLyrics' | 'plainLyrics'>): LyricLine[] {
  if (c.syncedLyrics) {
    const lines: LyricLine[] = []
    for (const raw of c.syncedLyrics.split(/\r?\n/)) {
      const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
      if (!stamps.length) continue
      const text = raw.replace(/\[[^\]]*\]/g, '').trim()
      for (const s of stamps) lines.push({ time: Number(s[1]) * 60 + Number(s[2]), text })
    }
    return lines.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
  }
  return c.plainLyrics
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(text => ({ time: null, text }))
}

// ─── Tokenizing & gaps ─────────────────────────────────────────────

export type Token = { text: string; isWord: boolean }

const INVISIBLE = /[­​-‍⁠﻿]/g
// Cyrillic letters that look like Latin ones; user-submitted lyrics sometimes mix them into English words
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', һ: 'h', ԁ: 'd',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y', І: 'I', Ј: 'J', Ѕ: 'S',
}

/** Remove invisible characters and replace look-alike Cyrillic letters inside Latin words. */
export function cleanLyricText(s: string): string {
  return s
    .replace(INVISIBLE, '')
    .normalize('NFC')
    .replace(/[\p{L}\p{M}]+/gu, w => (/[A-Za-z]/.test(w) ? w.replace(/[Ѐ-ӿԀ-ԯ]/g, ch => HOMOGLYPHS[ch] ?? ch) : w))
}

export function tokenize(line: string): Token[] {
  line = cleanLyricText(line)
  const out: Token[] = []
  const re = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu
  let last = 0
  for (const m of line.matchAll(re)) {
    if (m.index! > last) out.push({ text: line.slice(last, m.index), isWord: false })
    out.push({ text: m[0], isWord: true })
    last = m.index! + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last), isWord: false })
  return out
}

/** Case-, apostrophe- and accent-insensitive form used to compare typed answers ("Café" = "cafe"). */
export function normalizeAnswer(s: string) {
  return s.toLowerCase().replace(/’/g, "'").normalize('NFD').replace(/\p{M}/gu, '')
}

export const STOP_WORDS = new Set(
  (
    "a an the and or but if so of to in on at by for from with as is am are was were be been being do does did " +
    "i me my mine you your yours he him his she her hers it its we us our ours they them their theirs " +
    "this that these those there here what which who whom whose when where why how not no yes oh ooh ah uh yeah " +
    "hey la na da i'm you're he's she's it's we're they're i've you've we've they've i'll you'll he'll she'll " +
    "we'll they'll i'd you'd he'd she'd we'd they'd don't doesn't didn't can't won't isn't aren't wasn't weren't " +
    "ain't gonna wanna gotta can will just all up out then than too very"
  ).split(' ')
)

export const LEVELS = [
  { key: 'beginner', label: 'Beginner', ratio: 0.1 },
  { key: 'intermediate', label: 'Intermediate', ratio: 0.25 },
  { key: 'advanced', label: 'Advanced', ratio: 0.5 },
  { key: 'expert', label: 'Expert', ratio: 1 },
] as const
export type LevelKey = (typeof LEVELS)[number]['key']

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Returns a set of "lineIndex:tokenIndex" keys to hide. Content words are hidden before stop words. */
export function pickGaps(lines: Token[][], ratio: number, seed: string): Set<string> {
  const rnd = seededRandom(seed)
  const content: string[] = []
  const stop: string[] = []
  lines.forEach((tokens, li) =>
    tokens.forEach((t, ti) => {
      if (!t.isWord) return
      const key = `${li}:${ti}`
      if (STOP_WORDS.has(normalizeAnswer(t.text)) || t.text.length < 3) stop.push(key)
      else content.push(key)
    })
  )
  const total = content.length + stop.length
  const want = ratio >= 1 ? total : Math.max(1, Math.round(total * ratio))
  const shuffle = (a: string[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  return new Set([...shuffle(content), ...shuffle(stop)].slice(0, want))
}

// ─── Word timing (karaoke highlight) ───────────────────────────────
// LRCLIB only has a timestamp per line, so word times inside a line are estimated:
// the line's singing time is split between its words by syllable count, with short pauses at punctuation.

export type WordTime = { start: number; end: number }

export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length <= 3) return 1
  w = w
    .replace(/([^td])ed$/, '$1')
    .replace(/([^sxzhgc])es$/, '$1')
    .replace(/([^aeiouyl])e$/, '$1')
    .replace(/^y/, '')
  return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length)
}

const SEC_PER_UNIT = 0.3 // average singing time per syllable
const WORD_UNITS = 0.35 // extra weight per word (consonants, word boundary)
const PAUSE_UNITS = 0.6 // pause after , . ! ? etc.

/**
 * Estimated start/end (seconds, lyric time) of every word token.
 * `starts[i]` is the timestamp of line i, `end` the end of the song.
 */
export function estimateWordTimings(lines: Token[][], starts: number[], end: number): (WordTime | null)[][] {
  return lines.map((tokens, li) => {
    const out: (WordTime | null)[] = tokens.map(() => null)
    const units: { ti: number; w: number }[] = []
    tokens.forEach((t, ti) => {
      if (t.isWord) units.push({ ti, w: countSyllables(t.text) + WORD_UNITS })
      else if (units.length && /[,.;:!?—–]/.test(t.text)) units[units.length - 1].w += PAUSE_UNITS
    })
    if (!units.length) return out

    const start = starts[li]
    const next = li + 1 < starts.length ? starts[li + 1] : Math.max(end, start + 1)
    const gap = Math.max(0.3, next - start)
    const total = units.reduce((a, u) => a + u.w, 0)
    const natural = total * SEC_PER_UNIT + 0.3
    // Dense lines (rap) fill the whole gap; lines before a break get a little of the extra time.
    const dur = natural >= gap * 0.95 ? gap * 0.95 : natural + Math.min((gap * 0.95 - natural) * 0.4, 2)

    let acc = 0
    for (const u of units) {
      const s = start + (dur * acc) / total
      acc += u.w
      out[u.ti] = { start: s, end: start + (dur * acc) / total }
    }
    return out
  })
}
