import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

function fixture({ voices = [], available = true, setting = {} } = {}) {
  const timers = new Map()
  const listeners = new Set()
  const spoken = []
  const warnings = []
  let nextTimer = 0
  const synthesis = {
    getVoices: () => voices,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    onvoiceschanged: null,
    cancel() {},
    paused: false,
    resume() {
      this.paused = false
    },
    pause() {
      this.paused = true
    },
    speak(msg) {
      assert.equal(this.paused, false, 'resume before speaking')
      spoken.push(msg)
    },
  }
  const exports = {}
  const source = readFileSync(
    resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd(), 'app/core/hooks/sound.ts'),
    'utf8'
  ).replaceAll('import.meta.server', 'false')
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
      .outputText,
    {
      exports,
      setTimeout: (fn, ms) => {
        const id = ++nextTimer
        timers.set(id, { fn, ms })
        return id
      },
      clearTimeout: id => timers.delete(id),
      ...(available ? { speechSynthesis: synthesis, SpeechSynthesisUtterance: class {} } : {}),
      navigator: { userAgent: 'Windows Edg/' },
      require(name) {
        if (name === '../stores/setting')
          return { useSettingStore: () => ({ wordSoundSpeed: 1, wordSoundVolume: 50, ...setting }) }
        if (name === '@/base') return { Toast: { warning: value => warnings.push(value) } }
        return {}
      },
    }
  )
  return {
    exports,
    synthesis,
    spoken,
    warnings,
    timers,
    listeners,
    tick() {
      for (const [id, { fn }] of [...timers]) {
        timers.delete(id)
        fn()
      }
    },
    voicesChanged(next) {
      voices = next
      synthesis.onvoiceschanged?.()
      for (const fn of [...listeners]) fn()
    },
  }
}
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

test('TTS empty voices without an event completes with a warning after a bounded wait', async () => {
  const f = fixture()
  let ended = 0
  f.exports.useTTsPlayAudio()('fixture', { onEnd: () => ended++ })
  assert.ok(
    [...f.timers.values()].some(t => t.ms > 0 && t.ms <= 2000),
    'voice discovery must have a bounded timer'
  )
  f.tick()
  await flush()
  assert.equal(ended, 1)
  assert.equal(f.spoken.length, 0)
  assert.equal(f.warnings.length, 1)
  assert.equal(f.listeners.size, 0)
  assert.equal(f.timers.size, 0)
})

test('TTS delayed voices preserve existing listeners and clean up discovery', async () => {
  const f = fixture()
  const existing = () => {}
  f.synthesis.onvoiceschanged = existing
  f.exports.useTTsPlayAudio()('fixture')
  assert.equal(f.synthesis.onvoiceschanged, existing)
  f.voicesChanged([{ name: 'Emma US', lang: 'en-US' }])
  await flush()
  assert.equal(f.spoken.length, 1)
  assert.equal(f.spoken[0].voice.name, 'Emma US')
  assert.equal(f.listeners.size, 0)
  assert.equal(f.timers.size, 0)
})

test('TTS an empty voiceschanged event still waits for available voices', async () => {
  const f = fixture()
  f.exports.useTTsPlayAudio()('fixture')
  f.voicesChanged([])
  await flush()
  assert.equal(f.spoken.length, 0)
  f.voicesChanged([{ name: 'Emma', lang: 'en-US' }])
  await flush()
  assert.equal(f.spoken.length, 1)
})

test('TTS missing browser support settles the caller instead of leaving it waiting', () => {
  const f = fixture({ available: false })
  let ended = 0
  f.exports.useTTsPlayAudio()('fixture', { onEnd: () => ended++ })
  assert.equal(ended, 1)
  assert.equal(f.warnings.length, 1)
})

test('TTS canceled pending discovery never speaks or advances practice', async () => {
  const f = fixture()
  let ended = 0
  f.exports.useTTsPlayAudio()('fixture', { onEnd: () => ended++ })
  f.exports.cancelWordPracticeAudio()
  f.tick()
  f.voicesChanged([{ name: 'Emma', lang: 'en-US' }])
  await flush()
  assert.equal(f.spoken.length, 0)
  assert.equal(ended, 0)
  assert.equal(f.warnings.length, 0)
})

test('TTS stale utterance callbacks do not advance a replacement and completion is once-only', async () => {
  const f = fixture({ voices: [{ name: 'Emma', lang: 'en-US' }] })
  let old = 0,
    current = 0
  const play = f.exports.useTTsPlayAudio()
  play('first', { onEnd: () => old++ })
  await flush()
  play('second', { onEnd: () => current++ })
  await flush()
  f.spoken[0].onend()
  f.spoken[0].onerror()
  assert.equal(old, 0)
  f.spoken[1].onend()
  f.spoken[1].onerror()
  assert.equal(current, 1)
})

test('TTS configured voice and playback options remain intact', async () => {
  const f = fixture({
    voices: [{ name: 'Selected', lang: 'en-GB' }],
    setting: { ttsVoiceMap: [{ key: 'windows+edge', voice: 'Selected' }] },
  })
  f.exports.useTTsPlayAudio()('fixture', { rate: 1.25, volume: 0.37, pitch: 1.1, lang: 'en-GB' })
  await flush()
  assert.equal(f.spoken[0].voice.name, 'Selected')
  assert.equal(f.spoken[0].rate, 1.25)
  assert.equal(f.spoken[0].volume, 0.37)
  assert.equal(f.spoken[0].pitch, 1.1)
  assert.equal(f.spoken[0].lang, 'en-GB')
})

test('TTS resumes a synthesis engine paused by practice cancellation', async () => {
  const f = fixture({ voices: [{ name: 'Emma', lang: 'en-US' }] })
  f.exports.cancelWordPracticeAudio()
  assert.equal(f.synthesis.paused, true)
  f.exports.useTTsPlayAudio()('fixture')
  await flush()
  assert.equal(f.synthesis.paused, false)
  assert.equal(f.spoken.length, 1)
})

test('TTS English requests with only Chinese voices settle with an explicit warning', async () => {
  const f = fixture({ voices: [{ name: 'Huihui', lang: 'zh-CN' }] })
  let ended = 0
  f.exports.useTTsPlayAudio()('fixture', { onEnd: () => ended++ })
  await flush()
  assert.equal(f.spoken.length, 0)
  assert.equal(ended, 1)
  assert.equal(f.warnings.length, 1)
})

test('TTS falls back within the requested language, not to unrelated voice languages', async () => {
  const f = fixture({
    voices: [
      { name: 'Huihui', lang: 'zh-CN' },
      { name: 'British', lang: 'en-GB' },
    ],
  })
  f.exports.useTTsPlayAudio()('fixture')
  await flush()
  assert.equal(f.spoken[0].voice.name, 'British')
  assert.equal(f.warnings.length, 0)
})
