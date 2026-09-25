// Saved songs, kept in IndexedDB under their own key (not part of the main dict store / sync).
import { get, set } from 'idb-keyval'
import type { LyricLine, LevelKey } from './lyrics.ts'

export type Song = {
  videoId: string
  title: string // YouTube title
  artist: string
  track: string
  lrclibId: number | null
  synced: boolean
  lines: LyricLine[]
  offset: number // seconds added to lyric timestamps
  best: Partial<Record<LevelKey, number>> // best accuracy % per level
  missed: string[] // words revealed/missed during games
  dictId?: string // custom dictionary created from this song
  addedAt: number
  playedAt?: number
}

const KEY = 'SongsLibrary'
const VERSION = 1

export async function loadSongs(): Promise<Song[]> {
  try {
    const raw = await get(KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data?.val) ? data.val : []
  } catch {
    return []
  }
}

async function saveSongs(list: Song[]) {
  await set(KEY, JSON.stringify({ val: list, version: VERSION, updated_at: Date.now() }))
}

export async function getSong(videoId: string) {
  return (await loadSongs()).find(s => s.videoId === videoId) || null
}

export async function upsertSong(song: Song) {
  const list = await loadSongs()
  const i = list.findIndex(s => s.videoId === song.videoId)
  const plain = JSON.parse(JSON.stringify(song))
  if (i > -1) list[i] = plain
  else list.unshift(plain)
  await saveSongs(list)
}

export async function removeSong(videoId: string) {
  await saveSongs((await loadSongs()).filter(s => s.videoId !== videoId))
}
