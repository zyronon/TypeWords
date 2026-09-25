<script setup lang="ts">
import { BaseButton, BaseInput, Toast } from '@/base'
import { APP_NAME } from '@/core/config/env.ts'
import { flushStatToStore, usePracticeWordPersistence } from '@/core/composables/usePracticePersistence'
import { getCurrentStudyWord } from '@/core/hooks/dict.ts'
import { getSong, upsertSong, type Song } from '@/core/songs/library.ts'
import {
  cleanTrackName,
  estimateWordTimings,
  guessArtistTrack,
  LEVELS,
  normalizeAnswer,
  parseLyrics,
  pickGaps,
  rankCandidates,
  searchLyrics,
  STOP_WORDS,
  tokenize,
  type LevelKey,
  type LyricsCandidate,
  type Token,
} from '@/core/songs/lyrics.ts'
import { findLocalWord, translateLine, translateWord } from '@/core/songs/translate.ts'
import { createPlayer, hideCaptions, YT_STATE, youTubeErrorText } from '@/core/songs/youtube.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { DictType, WordPracticeMode } from '@/core/types/enum.ts'
import { getDefaultDict, getDefaultWord } from '@/core/types/func.ts'
import type { Word } from '@/core/types/types.ts'
import { useNav } from '@/core/utils'
import { getPracticeWordCacheLocal } from '@/core/utils/cache.ts'
import { nextTick, onBeforeUnmount, onMounted, reactive, watch } from 'vue'

useSeoMeta({ title: APP_NAME + ' Songs' })

const route = useRoute()
const router = useRouter()
const store = useBaseStore()
const settingStore = useSettingStore()
const wordPersistence = usePracticeWordPersistence()
const { nav } = useNav()
const videoId = String(route.params.id)

// ─── Player ───────────────────────────────────────────────────────
let playerEl = $ref<HTMLElement>()
let player: any = null
let playerReady = $ref(false)
let playing = $ref(false)
let ytError = $ref('')
let videoTitle = $ref('')
let channel = $ref('')
let duration = $ref(0)

// ─── Song / setup ─────────────────────────────────────────────────
let song = $ref<Song | null>(null)
let phase = $ref<'loading' | 'setup' | 'play'>('loading')
let artist = $ref('')
let track = $ref('')
let searching = $ref(false)
let searched = $ref(false)
let candidates = $ref<LyricsCandidate[]>([])

// ─── Game ─────────────────────────────────────────────────────────
const LEVEL_KEY = 'songs-level'
let level = $ref<LevelKey>(readLevel())
let tokens = $ref<Token[][]>([])
let gaps = $ref<Set<string>>(new Set())
const filled = reactive<Record<string, 'ok' | 'missed'>>({})
let typed = $ref('')
let curLine = $ref(-1)
let waitingLine = $ref<number | null>(null)
let waitingGap = $ref<string | null>(null) // the missing word the video stopped for ("word" stop mode)
let playThrough: number | null = null // line to play to its end although it has a missing word
const STOP_KEY = 'songs-stop-at'
const COVER_KEY = 'songs-video-cover'
let stopAt = $ref(readPref(STOP_KEY, ['word', 'line'] as const, 'word'))
let videoCover = $ref(readPref(COVER_KEY, ['off', 'bottom', 'full'] as const, 'off'))
const WORD_STOP_MARGIN = 0.4 // seconds after the estimated end of the word, so it is heard completely
let tab = $ref<'lyrics' | 'words'>('lyrics')
let gapInput = $ref<HTMLInputElement>()
let lyricsBox = $ref<HTMLElement>()
const lineTrans = reactive<Record<number, string>>({})
let selected = $ref<{ word: string; text: string; loading: boolean } | null>(null)
let curWord = $ref(-1) // token index sung right now in curLine; -1 none yet, -2 line already sung
let lastT = 0
let timer: ReturnType<typeof setInterval> | undefined
let raf = 0
const clock = { reported: -1, base: 0, at: 0 }

function readLevel(): LevelKey {
  try {
    const v = localStorage.getItem(LEVEL_KEY) as LevelKey
    if (LEVELS.some(l => l.key === v)) return v
  } catch {}
  return 'beginner'
}

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T
    if (allowed.includes(v)) return v
  } catch {}
  return fallback
}

function savePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {}
}

function setStopAt(v: 'word' | 'line') {
  stopAt = v
  savePref(STOP_KEY, v)
}

function setCover(v: 'off' | 'bottom' | 'full') {
  videoCover = v
  savePref(COVER_KEY, v)
}

const lines = $computed(() => song?.lines || [])
const synced = $computed(() => !!song?.synced)
const gapOrder = $computed(() =>
  [...gaps].sort((a, b) => {
    const [la, ta] = a.split(':').map(Number)
    const [lb, tb] = b.split(':').map(Number)
    return la - lb || ta - tb
  })
)
const pendingGaps = $computed(() => gapOrder.filter(k => !filled[k]))
const okCount = $computed(() => gapOrder.filter(k => filled[k] === 'ok').length)
const missedCount = $computed(() => gapOrder.filter(k => filled[k] === 'missed').length)
const finished = $computed(() => phase === 'play' && gapOrder.length > 0 && pendingGaps.length === 0)
const accuracy = $computed(() => (gapOrder.length ? Math.round((okCount / gapOrder.length) * 100) : 0))

const activeGap = $computed(() => {
  if (!pendingGaps.length) return null
  if (!synced) return pendingGaps[0]
  const from = waitingLine ?? Math.max(curLine, 0)
  return pendingGaps.find(k => Number(k.split(':')[0]) >= from) ?? pendingGaps[0]
})
const activeAnswer = $computed(() => {
  if (!activeGap) return ''
  const [l, t] = activeGap.split(':').map(Number)
  return tokens[l]?.[t]?.text || ''
})
const typedWrong = $computed(() => !!typed && !normalizeAnswer(activeAnswer).startsWith(normalizeAnswer(typed)))

function lineStart(i: number) {
  return (lines[i]?.time ?? 0) + (song?.offset || 0)
}
function lineEnd(i: number) {
  if (i + 1 < lines.length) return lineStart(i + 1)
  return duration || lineStart(i) + 6
}
function linePending(i: number) {
  return pendingGaps.some(k => k.startsWith(i + ':'))
}

// Estimated word times in lyric time (without offset)
const wordTimes = $computed(() => {
  if (!synced || !tokens.length) return []
  const starts = lines.map(l => l.time ?? 0)
  return estimateWordTimings(tokens, starts, duration - (song?.offset || 0) || starts[starts.length - 1] + 6)
})

// ─── Lifecycle ────────────────────────────────────────────────────
onMounted(async () => {
  song = await getSong(videoId)
  if (song && cleanTrackName(song.track, song.artist) !== song.track) {
    song.track = cleanTrackName(song.track, song.artist)
    upsertSong(song)
  }
  initPlayer()
  if (song) startGame()
  else phase = 'setup'
  timer = setInterval(tick, 100)
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  cancelAnimationFrame(raf)
  try {
    player?.destroy()
  } catch {}
})

function initPlayer() {
  createPlayer(playerEl!, videoId, {
    onReady: p => {
      player = p
      playerReady = true
      const data = p.getVideoData?.() || {}
      videoTitle = data.title || ''
      channel = data.author || ''
      duration = p.getDuration?.() || 0
      hideCaptions(p)
      if (phase === 'setup' && !searched) {
        const g = guessArtistTrack(videoTitle, channel)
        artist = g.artist
        track = g.track
        doSearch(true)
      }
    },
    onState: s => {
      playing = s === YT_STATE.PLAYING
      if (s === YT_STATE.PLAYING && !duration) duration = player.getDuration?.() || 0
      // The captions module is (re)loaded when playback starts, so switch subtitles off every time
      if (s === YT_STATE.PLAYING || s === YT_STATE.BUFFERING) hideCaptions(player)
    },
    onError: code => (ytError = youTubeErrorText(code)),
  }).catch(e => (ytError = e.message))
}

// ─── Lyrics search ────────────────────────────────────────────────
async function doSearch(auto = false) {
  if (!artist.trim() && !track.trim()) return Toast.warning('Enter the artist and song title')
  searching = true
  searched = true
  try {
    candidates = rankCandidates(await searchLyrics(artist.trim(), track.trim()), duration)
    const best = candidates[0]
    if (auto && best?.synced && duration && Math.abs(best.duration - duration) <= 4) await chooseLyrics(best)
  } catch (e) {
    Toast.error('Lyrics search failed. Check your internet connection.')
  } finally {
    searching = false
  }
}

async function chooseLyrics(c: LyricsCandidate) {
  const lyricLines = parseLyrics(c)
  if (!lyricLines.some(l => l.text)) return Toast.warning('These lyrics are empty, pick another result')
  song = {
    videoId,
    title: videoTitle,
    artist: c.artist,
    track: cleanTrackName(c.track, c.artist),
    lrclibId: c.id,
    synced: c.synced,
    lines: lyricLines,
    offset: song?.offset || 0,
    best: song?.best || {},
    missed: song?.missed || [],
    dictId: song?.dictId,
    addedAt: song?.addedAt || Date.now(),
  }
  await upsertSong(song)
  startGame()
}

function changeLyrics() {
  pause()
  if (song) {
    artist = song.artist
    track = song.track
  }
  phase = 'setup'
  if (!candidates.length) doSearch()
}

function durationText(sec: number) {
  if (!sec) return '?'
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`
}

// ─── Game ─────────────────────────────────────────────────────────
function startGame() {
  tokens = lines.map(l => tokenize(l.text))
  const ratio = LEVELS.find(l => l.key === level)!.ratio
  gaps = pickGaps(tokens, ratio, videoId + level)
  for (const k of Object.keys(filled)) delete filled[k]
  typed = ''
  waitingLine = null
  waitingGap = null
  playThrough = null
  curLine = -1
  phase = 'play'
  focusGap()
}

function setLevel(k: LevelKey) {
  level = k
  try {
    localStorage.setItem(LEVEL_KEY, k)
  } catch {}
  restart()
}

function restart() {
  startGame()
  if (player) {
    player.seekTo(0, true)
    player.pauseVideo()
  }
}

function setGapInput(el: any) {
  gapInput = el || undefined
}

function focusGap() {
  nextTick(() => gapInput?.focus({ preventScroll: true }))
}

/**
 * The IFrame API only reports the current time a few times per second.
 * Between reports, advance it with the real clock so the word highlight moves smoothly.
 */
function smoothTime(): number {
  const t = player.getCurrentTime?.() ?? 0
  const now = performance.now()
  if (t !== clock.reported) {
    clock.reported = t
    clock.base = t
    clock.at = now
  }
  if (!playing) return t
  const est = clock.base + ((now - clock.at) / 1000) * (player.getPlaybackRate?.() || 1)
  return Math.min(est, t + 0.6)
}

function lineIndexAt(t: number) {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lineStart(i) <= t) idx = i
    else break
  }
  return idx
}

/** Token index being sung at lyric time t in line li (-1: not started, -2: line finished). */
function wordIndexAt(li: number, t: number) {
  const times = wordTimes[li]
  if (!times) return -1
  let first = -1
  let last = -1
  for (let j = 0; j < times.length; j++) {
    const w = times[j]
    if (!w) continue
    if (first < 0) first = j
    last = j
    if (t >= w.start && t < w.end) return j
  }
  if (first < 0 || t < times[first]!.start) return -1
  return t < times[last]!.end + 1 ? last : -2
}

function setCurLine(idx: number) {
  if (idx === curLine) return
  curLine = idx
  scrollToLine(idx)
}

function updateHighlight(t: number) {
  if (waitingGap && waitingLine !== null) {
    // Stopped for a missing word: keep the highlight on that word
    setCurLine(waitingLine)
    curWord = Number(waitingGap.split(':')[1])
    return
  }
  const idx = lineIndexAt(t)
  setCurLine(idx)
  curWord = idx < 0 ? -1 : wordIndexAt(idx, t - (song?.offset || 0))
}

// Runs every frame while the page is rendered: smooth current line + word highlight.
let lastFrameAt = 0
function frame() {
  raf = requestAnimationFrame(frame)
  lastFrameAt = performance.now()
  if (!player || !playerReady || phase !== 'play' || !synced) {
    curWord = -1
    return
  }
  updateHighlight(smoothTime())
}

/** Video time at which to stop in line li: right after its first missing word, or at the end of the line. */
function stopPoint(li: number): { at: number; gap: string | null } {
  const lineStop = lineEnd(li) - 0.15
  const gap = pendingGaps.find(k => k.startsWith(li + ':')) ?? null
  if (stopAt !== 'word' || !gap || li === playThrough) return { at: lineStop, gap: null }
  const wt = wordTimes[li]?.[Number(gap.split(':')[1])]
  if (!wt) return { at: lineStop, gap: null }
  return { at: Math.min(lineStop, wt.end + (song?.offset || 0) + WORD_STOP_MARGIN), gap }
}

// Runs every 100 ms: auto-pause at missing words.
// Also keeps the highlight going when frames are throttled (background tab, hidden window).
function tick() {
  if (!player || !playerReady || phase !== 'play' || !synced) return
  const reported = player.getCurrentTime?.() ?? 0
  const seeked = Math.abs(reported - lastT) > 1.2
  lastT = reported
  const t = smoothTime()
  const idx = lineIndexAt(t)
  if (performance.now() - lastFrameAt > 300) updateHighlight(t)
  if (playThrough !== null && idx !== playThrough) playThrough = null
  if (playing && !seeked && waitingLine === null && idx >= 0 && linePending(idx)) {
    const stop = stopPoint(idx)
    if (t >= stop.at) {
      waitingLine = idx
      waitingGap = stop.gap
      player.pauseVideo()
      focusGap()
    }
  }
}

function wordState(li: number, ti: number) {
  if (li !== curLine || curWord === -1) return ''
  if (curWord === -2 || ti < curWord) return 'sung'
  return ti === curWord ? 'singing' : 'upcoming'
}

function scrollToLine(i: number) {
  if (i < 0 || !lyricsBox) return
  const el = lyricsBox.querySelector<HTMLElement>(`[data-line="${i}"]`)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function play() {
  player?.playVideo()
  focusGap()
}
function pause() {
  player?.pauseVideo()
}
function togglePlay() {
  playing ? pause() : play()
}

function replayLine() {
  const i = waitingLine ?? Math.max(curLine, 0)
  if (!player || !synced) return
  waitingLine = null
  waitingGap = null
  playThrough = null
  player.seekTo(Math.max(0, lineStart(i) - 0.3), true)
  lastT = lineStart(i)
  player.playVideo()
  focusGap()
}

function seekToLine(i: number) {
  if (!player || !synced) return
  waitingLine = null
  waitingGap = null
  playThrough = null
  player.seekTo(Math.max(0, lineStart(i) - 0.2), true)
  lastT = lineStart(i)
  player.playVideo()
  focusGap()
}

/** Stopped at a missing word: is there more of the line left to hear? */
const canPlayRest = $computed(() => {
  if (waitingLine === null || !waitingGap) return false
  const ti = Number(waitingGap.split(':')[1])
  return (tokens[waitingLine] || []).some((t, j) => j > ti && t.isWord)
})

/** Let the rest of the line play, then stop again at its end so the word can still be typed. */
function playToLineEnd() {
  if (!canPlayRest || waitingLine === null || !player) return
  playThrough = waitingLine
  waitingLine = null
  waitingGap = null
  player.playVideo()
  focusGap()
}

function afterGapDone() {
  typed = ''
  if (waitingLine !== null) {
    const blocked = waitingGap ? !filled[waitingGap] : linePending(waitingLine)
    if (!blocked) {
      waitingLine = null
      waitingGap = null
      player?.playVideo()
    }
  }
  if (finished) onFinished()
  focusGap()
}

function onType(e: Event) {
  typed = (e.target as HTMLInputElement).value
  if (activeGap && normalizeAnswer(typed.trim()) === normalizeAnswer(activeAnswer)) {
    filled[activeGap] = 'ok'
    afterGapDone()
  }
}

function reveal() {
  if (!activeGap) return
  filled[activeGap] = 'missed'
  const w = activeAnswer.toLowerCase()
  if (song && !song.missed.includes(w)) song.missed.push(w)
  afterGapDone()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    reveal()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    replayLine()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    togglePlay()
  } else if (e.key === ' ') {
    // Answers are single words, so Space is free for "play the rest of the line"
    e.preventDefault()
    playToLineEnd()
  }
}

async function onFinished() {
  if (!song) return
  const prev = song.best[level]
  if (prev == null || accuracy > prev) song.best[level] = accuracy
  song.playedAt = Date.now()
  await upsertSong(song)
}

async function changeOffset(d: number) {
  if (!song) return
  song.offset = Math.round((song.offset + d) * 100) / 100
  await upsertSong(song)
}

function nextLevel() {
  const i = LEVELS.findIndex(l => l.key === level)
  setLevel(LEVELS[Math.min(i + 1, LEVELS.length - 1)].key)
}

async function showLineTrans(i: number) {
  if (lineTrans[i]) return delete lineTrans[i]
  lineTrans[i] = '…'
  try {
    lineTrans[i] = await translateLine(lines[i].text)
  } catch (e: any) {
    lineTrans[i] = e?.message || 'Translation failed'
  }
}

async function lookup(word: string) {
  selected = { word, text: '', loading: true }
  const r = await translateWord(word)
  if (selected?.word === word) selected = { word, text: r.text || 'No translation found', loading: false }
}

watch($$(pendingGaps), () => {
  if (activeGap && waitingLine === null) scrollToGapIfIdle()
})
function scrollToGapIfIdle() {
  if (!synced && activeGap) scrollToLine(Number(activeGap.split(':')[0]))
}

// ─── Song words → dictionary ──────────────────────────────────────
type SongWord = { key: string; count: number; line: string; trans: string; source: string; loading: boolean; selected: boolean; missed: boolean; local: Word | null }
let words = $ref<SongWord[]>([])
let wordsLoaded = $ref(false)
let creating = $ref(false)

async function loadWords() {
  if (wordsLoaded || !song) return
  wordsLoaded = true
  const map = new Map<string, SongWord>()
  for (const l of lines) {
    for (const t of tokenize(l.text)) {
      if (!t.isWord) continue
      const raw = normalizeAnswer(t.text)
      if (raw.length < 3 || STOP_WORDS.has(raw) || raw.includes("'")) continue
      const local = await findLocalWord(raw)
      const key = local?.word.toLowerCase() || raw
      const w = map.get(key)
      if (w) w.count++
      else
        map.set(key, {
          key,
          count: 1,
          line: l.text,
          trans: '',
          source: '',
          loading: true,
          selected: true,
          missed: song.missed.includes(raw),
          local,
        })
      if (song.missed.includes(raw)) map.get(key)!.missed = true
    }
  }
  words = [...map.values()].sort((a, b) => Number(b.missed) - Number(a.missed) || b.count - a.count)
  const queue = [...words]
  const worker = async () => {
    while (queue.length) {
      const w = queue.shift()!
      const r = await translateWord(w.key)
      w.trans = r.text
      w.source = r.source
      w.loading = false
      words = [...words]
    }
  }
  await Promise.all([worker(), worker(), worker()])
}

watch($$(tab), t => t === 'words' && loadWords())

const selectedCount = $computed(() => words.filter(w => w.selected).length)

function toggleAll(v: boolean) {
  words.forEach(w => (w.selected = v))
  words = [...words]
}

async function practiceWords() {
  if (!song) return
  const list = words.filter(w => w.selected)
  if (!list.length) return Toast.warning('Select at least one word')
  creating = true
  try {
    const dictWords: Word[] = list.map(w => {
      const sentence = { c: w.line, cn: '' }
      if (w.local) {
        const copy = JSON.parse(JSON.stringify(w.local)) as Word
        return getDefaultWord({ ...copy, custom: true, sentences: [sentence, ...(copy.sentences || [])].slice(0, 4) })
      }
      return getDefaultWord({ word: w.key, custom: true, trans: [{ pos: '', cn: w.trans }], sentences: [sentence] })
    })
    const id = 'custom-dict-song-' + videoId
    const name = `♪ ${song.track}${song.artist ? ' – ' + song.artist : ''}`
    const existing = store.word.bookList.find(d => d.id === id)
    const dict = getDefaultDict({
      ...(existing ? JSON.parse(JSON.stringify({ ...existing, words: [] })) : {}),
      id,
      name,
      description: `Words from the song "${song.track}" by ${song.artist}`,
      custom: true,
      type: DictType.word,
      words: dictWords,
      length: dictWords.length,
      perDayStudyNumber: existing?.perDayStudyNumber || Math.min(20, dictWords.length),
    })
    if (existing) Object.assign(existing, { name, description: dict.description })
    song.dictId = id
    await upsertSong(song)

    if (![WordPracticeMode.Free, WordPracticeMode.System].includes(settingStore.wordPracticeMode)) {
      settingStore.wordPracticeMode = WordPracticeMode.System
    }
    const cache = await getPracticeWordCacheLocal()
    if (cache) {
      flushStatToStore((cache as any)?.statStoreData)
      await wordPersistence.clear()
    }
    await store.changeDict(dict)
    const task = getCurrentStudyWord()
    if (!task.new.length && !task.review.length) {
      Toast.info('The dictionary was saved. All of its words are already learned or marked as known.')
      return router.push('/words')
    }
    nav('/practice-words/' + store.sdict.id, {}, { taskWords: task })
  } finally {
    creating = false
  }
}
</script>

<template>
  <div class="songs-page">
    <div class="flex items-center gap-3 mb-3">
      <BaseButton type="text" @click="router.push('/songs')">
        <div class="flex items-center gap-1"><IconFluentArrowLeft20Regular />Songs</div>
      </BaseButton>
      <div class="font-bold text-lg truncate flex-1">
        <template v-if="song">{{ song.track }} <span class="color-sub font-normal">– {{ song.artist }}</span></template>
        <template v-else>{{ videoTitle || 'Loading…' }}</template>
      </div>
    </div>

    <div class="layout">
      <!-- Left: video + controls -->
      <div class="left">
        <div class="video">
          <div class="player-host"><div ref="playerEl"></div></div>
          <div v-if="videoCover !== 'off' && !ytError" class="video-cover" :class="videoCover">
            <template v-if="videoCover === 'full'">
              <IconPhMusicNotes class="text-4xl" />
              <div>Video hidden — just listen</div>
            </template>
          </div>
          <div v-if="ytError" class="yt-error">{{ ytError }}</div>
        </div>

        <template v-if="phase === 'play'">
          <div class="controls card-white">
            <div class="flex gap-2 flex-wrap">
              <BaseButton v-for="l in LEVELS" :key="l.key" size="small" :type="level === l.key ? 'primary' : 'info'" @click="setLevel(l.key)">
                {{ l.label }}
              </BaseButton>
            </div>
            <div class="flex gap-2 flex-wrap mt-3">
              <BaseButton size="small" @click="togglePlay" keyboard="Esc">
                <div class="flex items-center gap-1">
                  <IconFluentPause20Filled v-if="playing" /><IconFluentPlay20Filled v-else />{{ playing ? 'Pause' : 'Play' }}
                </div>
              </BaseButton>
              <BaseButton size="small" type="info" @click="replayLine" :disabled="!synced" keyboard="Tab">
                <div class="flex items-center gap-1"><IconFluentArrowCounterclockwise20Regular />Replay line</div>
              </BaseButton>
              <BaseButton v-if="stopAt === 'word' && synced" size="small" type="info" @click="playToLineEnd" :disabled="!canPlayRest" keyboard="Space">
                <div class="flex items-center gap-1"><IconFluentPlay20Filled />Rest of line</div>
              </BaseButton>
              <BaseButton size="small" type="info" @click="reveal" :disabled="!activeGap" keyboard="Enter">
                <div class="flex items-center gap-1"><IconFluentEye20Regular />Show word</div>
              </BaseButton>
              <BaseButton size="small" type="info" @click="restart">Restart</BaseButton>
            </div>
            <div class="stats mt-3">
              <span class="ok">✓ {{ okCount }}</span>
              <span class="bad">✗ {{ missedCount }}</span>
              <span class="color-sub">{{ pendingGaps.length }} left of {{ gapOrder.length }}</span>
            </div>
            <div v-if="synced" class="flex items-center gap-2 mt-3 text-sm color-sub">
              Lyrics timing:
              <BaseButton size="small" type="info" @click="changeOffset(-0.25)">−0.25s</BaseButton>
              <span class="w-14 text-center">{{ (song?.offset || 0) > 0 ? '+' : '' }}{{ (song?.offset || 0).toFixed(2) }}s</span>
              <BaseButton size="small" type="info" @click="changeOffset(0.25)">+0.25s</BaseButton>
            </div>
            <div v-else class="text-sm color-sub mt-3">These lyrics have no timing, so the video won't pause automatically.</div>
            <div v-if="synced" class="opt-row mt-3">
              <span class="opt-label">Stop the video</span>
              <BaseButton size="small" :type="stopAt === 'word' ? 'primary' : 'info'" @click="setStopAt('word')">After the missing word</BaseButton>
              <BaseButton size="small" :type="stopAt === 'line' ? 'primary' : 'info'" @click="setStopAt('line')">At the end of the line</BaseButton>
            </div>
            <div class="opt-row mt-2">
              <span class="opt-label">Lyrics in the video</span>
              <BaseButton size="small" :type="videoCover === 'off' ? 'primary' : 'info'" @click="setCover('off')">Subtitles off</BaseButton>
              <BaseButton size="small" :type="videoCover === 'bottom' ? 'primary' : 'info'" @click="setCover('bottom')">Cover bottom</BaseButton>
              <BaseButton size="small" :type="videoCover === 'full' ? 'primary' : 'info'" @click="setCover('full')">Hide video</BaseButton>
            </div>
            <div class="text-xs color-sub mt-1">
              YouTube subtitles are always switched off. If the words are part of the picture (lyric videos), cover the bottom or hide the video.
            </div>
            <div class="text-sm color-sub mt-3 leading-5">
              Type the missing word — it fills in when correct. The video stops
              {{ stopAt === 'word' && synced ? 'right after a missing word is sung' : 'at the end of a line with missing words' }}.
              <b>Enter</b> shows the word, <b>Tab</b> replays the line,
              <template v-if="stopAt === 'word' && synced"><b>Space</b> plays the rest of the line, </template><b>Esc</b> plays/pauses. Click a word to see its Serbian meaning.
            </div>
            <div class="mt-2">
              <span class="link text-sm" @click="changeLyrics">Wrong lyrics? Choose others</span>
            </div>
          </div>

          <div v-if="selected" class="card-white mt-3 lookup">
            <div class="font-bold text-lg">{{ selected.word }}</div>
            <div v-if="selected.loading"><IconEosIconsLoading /></div>
            <div v-else>{{ selected.text }}</div>
          </div>
        </template>
      </div>

      <!-- Right: setup / lyrics / words -->
      <div class="right card-white">
        <!-- Setup: find lyrics -->
        <div v-if="phase === 'setup' || phase === 'loading'">
          <div class="title mb-3">Find the lyrics</div>
          <div class="flex gap-2 flex-wrap">
            <BaseInput v-model="artist" placeholder="Artist" class="flex-1 min-w-40" @enter="doSearch()" />
            <BaseInput v-model="track" placeholder="Song title" class="flex-1 min-w-40" @enter="doSearch()" />
            <BaseButton :loading="searching" @click="doSearch()">Search</BaseButton>
          </div>
          <div class="text-sm color-sub mt-2">Video length: {{ durationText(duration) }}. Results with timing (synced) and a similar length work best.</div>
          <div v-if="searching" class="py-10 center"><IconEosIconsLoading /></div>
          <div v-else-if="searched && !candidates.length" class="py-8 color-sub text-center">
            No lyrics found. Try fixing the artist or title (without "Official Video" etc.).
          </div>
          <div v-else class="mt-3 flex flex-col gap-2">
            <div v-for="c in candidates" :key="c.id" class="candidate" @click="chooseLyrics(c)">
              <div class="flex-1 min-w-0">
                <div class="font-bold truncate">{{ c.track }}</div>
                <div class="text-sm color-sub truncate">{{ c.artist }}{{ c.album ? ' · ' + c.album : '' }}</div>
              </div>
              <div class="text-sm text-right shrink-0">
                <div :class="c.synced ? 'ok' : 'color-sub'">{{ c.synced ? 'synced' : 'text only' }}</div>
                <div class="color-sub">
                  {{ durationText(c.duration) }}
                  <template v-if="duration && c.duration">({{ c.duration - duration >= 0 ? '+' : '' }}{{ Math.round(c.duration - duration) }}s)</template>
                </div>
              </div>
            </div>
          </div>
          <div class="text-xs color-sub mt-4">Lyrics are provided by lrclib.net.</div>
        </div>

        <!-- Play -->
        <template v-else>
          <div class="tabs">
            <div :class="{ active: tab === 'lyrics' }" @click="tab = 'lyrics'">Lyrics</div>
            <div :class="{ active: tab === 'words' }" @click="tab = 'words'">Song words</div>
          </div>

          <div v-show="tab === 'lyrics'">
            <div v-if="finished" class="finished">
              <div class="text-2xl font-bold">{{ accuracy }}%</div>
              <div class="color-sub">{{ okCount }} typed correctly, {{ missedCount }} shown · best on this level: {{ song?.best[level] ?? accuracy }}%</div>
              <div class="flex gap-2 justify-center mt-3 flex-wrap">
                <BaseButton @click="restart">Play again</BaseButton>
                <BaseButton v-if="level !== 'expert'" type="info" @click="nextLevel">Next level</BaseButton>
                <BaseButton type="orange" @click="tab = 'words'">Learn the words</BaseButton>
              </div>
            </div>

            <div ref="lyricsBox" class="lyrics">
              <div
                v-for="(line, li) in tokens"
                :key="li"
                :data-line="li"
                class="lyric-line"
                :class="{ current: li === curLine, waiting: li === waitingLine, empty: !lines[li]?.text }"
              >
                <span class="seek" v-if="synced && lines[li]?.text" title="Play from this line" @click="seekToLine(li)">▶</span>
                <span class="text">
                  <template v-for="(t, ti) in line" :key="ti">
                    <template v-if="!t.isWord">{{ t.text }}</template>
                    <template v-else-if="gaps.has(li + ':' + ti) && !filled[li + ':' + ti]">
                      <input
                        v-if="activeGap === li + ':' + ti"
                        :ref="setGapInput"
                        class="gap-input"
                        :class="[{ wrong: typedWrong }, wordState(li, ti)]"
                        :style="{ width: Math.max(t.text.length, 2) + 1.5 + 'ch' }"
                        :value="typed"
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck="false"
                        @input="onType"
                        @keydown="onKey"
                      />
                      <span v-else class="gap" :class="wordState(li, ti)" :style="{ width: Math.max(t.text.length, 2) + 1 + 'ch' }" @click="focusGap"></span>
                    </template>
                    <span v-else class="word" :class="[filled[li + ':' + ti], wordState(li, ti)]" @click="lookup(t.text)">{{ t.text }}</span>
                  </template>
                </span>
                <span v-if="lines[li]?.text" class="tr-btn" title="Translate line" @click="showLineTrans(li)"><IconFluentTranslate20Regular /></span>
                <div v-if="lineTrans[li]" class="line-tr">{{ lineTrans[li] }}</div>
                <div v-if="li === waitingLine && canPlayRest" class="line-actions">
                  <span class="line-action" @mousedown.prevent @click="playToLineEnd">
                    <IconFluentPlay20Filled /> Play the rest of the line <kbd>Space</kbd>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-show="tab === 'words'">
            <div class="flex items-center gap-2 flex-wrap mb-3">
              <div class="color-sub text-sm flex-1">
                {{ words.length }} words from this song ({{ selectedCount }} selected). Words you missed are at the top.
                Meanings come from the local CET-4 dictionary or are auto-translated — you can edit them.
              </div>
              <span class="link text-sm" @click="toggleAll(true)">Select all</span>
              <span class="link text-sm" @click="toggleAll(false)">None</span>
              <BaseButton :loading="creating" :disabled="!words.length" @click="practiceWords">Practice selected words</BaseButton>
            </div>
            <div v-if="!words.length" class="py-10 center"><IconEosIconsLoading /></div>
            <div class="word-list">
              <label v-for="w in words" :key="w.key" class="word-row" :class="{ off: !w.selected }">
                <input type="checkbox" v-model="w.selected" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-bold">{{ w.key }}</span>
                    <span v-if="w.missed" class="badge bad">missed</span>
                    <span v-if="w.count > 1" class="text-xs color-sub">×{{ w.count }}</span>
                  </div>
                  <div class="text-xs color-sub truncate">{{ w.line }}</div>
                </div>
                <div class="trans">
                  <IconEosIconsLoading v-if="w.loading" />
                  <input v-else v-model="w.trans" class="trans-input" :class="w.source" placeholder="translation" @click.prevent.stop />
                </div>
              </label>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.songs-page {
  padding: 1rem 1.2rem;
  box-sizing: border-box;
  min-height: 100vh;
}
.color-sub {
  color: var(--color-sub-text);
}
.link {
  color: var(--color-link);
  cursor: pointer;
}
.ok {
  color: #22a559;
}
.bad {
  color: #e5484d;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 1rem;
  align-items: start;
}
.left {
  position: sticky;
  top: 1rem;
}
.video {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 0.6rem;
  overflow: hidden;
  :deep(iframe) {
    width: 100%;
    height: 100%;
    display: block;
  }
}
.player-host {
  position: absolute;
  inset: 0;
}
// Hides lyrics that are part of the picture. Clicks pass through to the YouTube player.
.video-cover {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #ddd;
  &.bottom {
    height: 30%;
    background: rgba(14, 14, 16, 0.92);
    backdrop-filter: blur(16px);
  }
  &.full {
    top: 0;
    background: #141416;
  }
}
.opt-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.opt-label {
  font-size: 0.875rem;
  color: var(--color-sub-text);
  min-width: 8.5rem;
}
.yt-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.85);
  line-height: 1.5;
}
.controls {
  margin-top: 1rem;
}
.stats {
  display: flex;
  gap: 1rem;
  font-size: 1.1rem;
  font-weight: bold;
}
.lookup {
  border-left: 3px solid var(--color-link);
}
.right {
  min-height: 60vh;
}
.candidate {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.7rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-item-border);
  cursor: pointer;
  &:hover {
    background: var(--color-second);
  }
}
.tabs {
  display: flex;
  gap: 1.5rem;
  border-bottom: 1px solid var(--color-line);
  margin-bottom: 1rem;
  div {
    padding: 0.4rem 0;
    cursor: pointer;
    color: var(--color-sub-text);
    border-bottom: 2px solid transparent;
    &.active {
      color: var(--color-main-text);
      border-color: var(--color-link);
      font-weight: bold;
    }
  }
}
.finished {
  text-align: center;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 0.6rem;
  background: var(--color-second);
}
.lyrics {
  max-height: calc(100vh - 12rem);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.5rem;
}
.lyric-line {
  position: relative;
  padding: 0.45rem 2rem 0.45rem 1.6rem;
  border-radius: 0.4rem;
  font-size: 1.15rem;
  line-height: 2;
  color: var(--color-sub-text);
  transition: background 0.2s;
  &.empty {
    min-height: 0.8rem;
    padding: 0.2rem;
  }
  &.current {
    color: var(--color-main-text);
    background: var(--color-second);
  }
  &.waiting {
    outline: 2px solid var(--color-link);
  }
  .seek,
  .tr-btn {
    position: absolute;
    top: 0.75rem;
    opacity: 0;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--color-sub-text);
  }
  .seek {
    left: 0.35rem;
  }
  .tr-btn {
    right: 0.4rem;
    font-size: 1rem;
  }
  &:hover .seek,
  &:hover .tr-btn {
    opacity: 1;
  }
}
.line-actions {
  line-height: 1.6;
  padding-bottom: 0.2rem;
}
.line-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: var(--color-link);
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
  kbd {
    font: inherit;
    font-size: 0.75rem;
    padding: 0 0.35rem;
    border: 1px solid currentColor;
    border-radius: 0.25rem;
    opacity: 0.8;
  }
}
.line-tr {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--color-link);
  padding-bottom: 0.2rem;
}
.word {
  cursor: pointer;
  border-radius: 0.2rem;
  &:hover {
    background: var(--color-third);
  }
  &.ok {
    color: #22a559;
    font-weight: bold;
  }
  &.missed {
    color: #e5484d;
    font-weight: bold;
  }
}
// Karaoke highlight of the word being sung right now
.word,
.gap {
  transition: background-color 0.12s, color 0.12s, opacity 0.12s, box-shadow 0.12s;
}
.word.upcoming {
  opacity: 0.55;
}
.word.singing {
  background: var(--color-link);
  color: #fff;
  box-shadow: 0 0 0 0.12em var(--color-link);
}
.gap.singing {
  border-bottom-color: var(--color-link);
  background: color-mix(in srgb, var(--color-link) 30%, transparent);
  border-radius: 0.2rem 0.2rem 0 0;
}
.gap-input.singing {
  box-shadow: 0 0 0 2px var(--color-link);
}
.gap {
  display: inline-block;
  height: 1.3em;
  vertical-align: middle;
  border-bottom: 2px solid var(--color-sub-text);
  margin: 0 0.1em;
  cursor: text;
}
.gap-input {
  font: inherit;
  font-family: monospace;
  font-size: 1.05rem;
  padding: 0 0.3em;
  margin: 0 0.1em;
  border: none;
  border-bottom: 2px solid var(--color-link);
  border-radius: 0.2rem;
  background: var(--color-input-bg);
  color: var(--color-main-text);
  outline: none;
  &.wrong {
    border-color: #e5484d;
    color: #e5484d;
  }
}
.word-list {
  max-height: calc(100vh - 15rem);
  overflow-y: auto;
}
.word-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.5rem 0.4rem;
  border-bottom: 1px solid var(--color-line);
  cursor: pointer;
  &.off {
    opacity: 0.45;
  }
}
.badge {
  font-size: 0.7rem;
  padding: 0 0.35rem;
  border: 1px solid currentColor;
  border-radius: 0.3rem;
}
.trans {
  width: 45%;
  flex-shrink: 0;
}
.trans-input {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 0.9rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid transparent;
  border-radius: 0.3rem;
  background: transparent;
  color: var(--color-main-text);
  &:hover,
  &:focus {
    border-color: var(--color-input-border);
    background: var(--color-input-bg);
    outline: none;
  }
  &.web {
    color: var(--color-link);
  }
  &.none {
    border-color: #e5484d55;
  }
}
@media (max-width: 900px) {
  .songs-page {
    padding: 0.5rem;
  }
  .layout {
    grid-template-columns: 1fr;
  }
  .left {
    position: static;
  }
  .lyrics,
  .word-list {
    max-height: none;
  }
  .trans {
    width: 40%;
  }
}
</style>
