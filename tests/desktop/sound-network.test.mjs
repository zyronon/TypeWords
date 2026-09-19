import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

function fixture() {
  const timers = new Map()
  const requests = []
  const spoken = []
  let nextTimer = 0
  let audio
  class FakeAudio {
    constructor() {
      audio = this
    }
    pause() {}
    play() {
      const request = { caught: false }
      requests.push(request)
      return {
        catch(fn) {
          request.caught = true
          request.reject = fn
        },
      }
    }
  }
  const exports = {}
  const source = readFileSync(
    resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd(), 'app/core/hooks/sound.ts'),
    'utf8'
  ).replaceAll('import.meta.server', 'false')
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      Audio: FakeAudio,
      SpeechSynthesisUtterance: class {},
      speechSynthesis: {
        pause() {},
        cancel() {},
        resume() {},
        getVoices: () => [{ name: 'English', lang: 'en-US' }],
        speak: msg => spoken.push(msg),
      },
      setTimeout(fn, ms) {
        const id = ++nextTimer
        timers.set(id, { fn, ms })
        return id
      },
      clearTimeout: id => timers.delete(id),
      require(name) {
        if (name === 'vue') return { onMounted() {} }
        if (name === '../stores/setting') return { useSettingStore: () => ({ wordSoundSpeed: 1, wordSoundVolume: 50 }) }
        if (name === '../config/env') return { PronunciationApi: 'https://example.test/audio?q=' }
        if (name === '@/base') return { Toast: { success() {}, closeAll() {}, warning() {} } }
        return {}
      },
    }
  )
  return {
    exports,
    timers,
    requests,
    spoken,
    get audio() {
      return audio
    },
    tick() {
      for (const [id, { fn }] of [...timers]) {
        timers.delete(id)
        fn()
      }
    },
  }
}
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

test('network rejected play and error events fall back once and complete once', async () => {
  const f = fixture()
  let ended = 0
  f.exports.usePlayWordAudio()('word', false, () => ended++)
  const error = f.audio.onerror
  const end = f.audio.onended
  assert.equal(f.requests[0].caught, true, 'play rejection must be handled')
  f.requests[0].reject(new Error('network'))
  error()
  await flush()
  assert.equal(f.spoken.length, 1)
  end()
  assert.equal(ended, 0, 'late remote ended must not finish a TTS fallback')
  f.spoken[0].onend()
  f.spoken[0].onerror()
  assert.equal(ended, 1)
  assert.equal(f.timers.size, 0)
})

test('network unresolved play and stalled playback have a bounded fallback', async () => {
  for (const started of [false, true]) {
    const f = fixture()
    f.exports.usePlayWordAudio()('word', false)
    if (started) f.audio.onplaying?.()
    assert.ok([...f.timers.values()].some(t => t.ms > 0 && t.ms <= 15000))
    f.tick()
    await flush()
    assert.equal(f.spoken.length, 1)
    assert.equal(f.timers.size, 0)
  }
})

test('network cancellation removes callbacks and timers without advancing practice', async () => {
  const f = fixture()
  let ended = 0,
    played = 0
  f.exports.usePlayWordAudio()(
    'word',
    false,
    () => ended++,
    () => played++
  )
  const callbacks = [f.audio.onerror, f.audio.onended, f.audio.onplay]
  f.exports.cancelWordPracticeAudio()
  for (const fn of callbacks) fn?.()
  f.requests[0].reject?.(new Error('canceled'))
  f.tick()
  await flush()
  assert.equal(ended, 0)
  assert.equal(played, 0)
  assert.equal(f.spoken.length, 0)
  assert.equal(f.timers.size, 0)
  for (const field of ['onended', 'onerror', 'onplay', 'onplaying', 'ontimeupdate']) assert.equal(f.audio[field], null)
})

test('network stale callbacks and rejected promise never affect a replacement', async () => {
  const f = fixture()
  let old = 0,
    current = 0,
    oldPlayed = 0
  const play = f.exports.usePlayWordAudio()
  play(
    'first',
    false,
    () => old++,
    () => oldPlayed++
  )
  const stale = [f.audio.onerror, f.audio.onended, f.audio.onplay, ...[...f.timers.values()].map(t => t.fn)]
  play('second', false, () => current++)
  for (const fn of stale) fn?.()
  f.requests[0].reject?.(new Error('late'))
  await flush()
  assert.equal(old, 0)
  assert.equal(oldPlayed, 0)
  assert.equal(f.spoken.length, 0)
  f.audio.onended()
  assert.equal(current, 1)
  assert.equal(f.timers.size, 0)
})

test('network twenty successful sequential plays clean listeners and timers', () => {
  const f = fixture()
  let ended = 0
  const play = f.exports.usePlayWordAudio()
  for (let i = 0; i < 20; i++) {
    play(`word${i}`, false, () => ended++)
    const end = f.audio.onended
    f.audio.onplay()
    end()
    end()
    assert.equal(ended, i + 1)
    assert.equal(f.timers.size, 0)
    for (const field of ['onended', 'onerror', 'onplay', 'onplaying', 'ontimeupdate'])
      assert.equal(f.audio[field], null)
  }
})

test('network progress extends the deadline for long clips but stationary updates do not', async () => {
  const f = fixture()
  f.exports.usePlayWordAudio()('a long sentence', false)
  let previousTimer = [...f.timers.keys()][0]
  for (let second = 1; second <= 30; second++) {
    f.audio.currentTime = second
    f.audio.ontimeupdate()
    assert.equal(f.timers.size, 1)
    assert.equal(f.timers.has(previousTimer), false)
    previousTimer = [...f.timers.keys()][0]
  }
  f.audio.ontimeupdate()
  assert.equal(f.timers.has(previousTimer), true, 'no progress must not postpone fallback')
  assert.equal(f.spoken.length, 0)
  f.tick()
  await flush()
  assert.equal(f.spoken.length, 1)
})

test('network synchronous play failure also falls back and a canceled fallback stays stale', async () => {
  const f = fixture()
  const play = f.exports.usePlayWordAudio()
  play('initialize', false)
  f.exports.cancelWordPracticeAudio()
  f.audio.play = () => {
    throw new Error('play failed synchronously')
  }
  let ended = 0
  play('word', false, () => ended++)
  await flush()
  assert.equal(f.spoken.length, 1)
  f.exports.cancelWordPracticeAudio()
  f.spoken[0].onend()
  assert.equal(ended, 0)
  assert.equal(f.timers.size, 0)
})

test('network real rejected play promise is consumed and falls back', async () => {
  const f = fixture()
  const play = f.exports.usePlayWordAudio()
  play('initialize', false)
  f.exports.cancelWordPracticeAudio()
  f.audio.play = () => Promise.reject(new Error('network unavailable'))
  play('word', false)
  await flush()
  assert.equal(f.spoken.length, 1)
  assert.equal(f.timers.size, 0)
})
