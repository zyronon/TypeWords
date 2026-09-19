import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// Run the actual hook with a minimal DOM/lifecycle boundary, not a copied handler.
function fixture() {
  const handlers = new Map()
  const received = []
  const windowHandlers = new Map()
  const input = {
    value: '', focus() {}, remove() {},
    addEventListener(type, fn) { handlers.set(type, fn) },
    removeEventListener(type) { handlers.delete(type) },
  }
  const exports = {}
  const source = readFileSync(resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd(), 'app/core/hooks/event.ts'), 'utf8')
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, setTimeout() {}, console,
    document: { querySelector: () => input, body: { appendChild() {} } },
    window: {
      addEventListener(type, fn) { windowHandlers.set(type, fn) },
      removeEventListener(type) { windowHandlers.delete(type) },
    },
    require(name) {
      if (name === 'vue') return { onMounted: fn => fn(), onUnmounted() {}, onDeactivated() {} }
      if (name === '@/base') return { Toast: { warning() {} } }
      if (name === '../utils/eventBus') return { emitter: {} }
      if (name === '../stores' || name === '../utils') return {}
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  exports.useEventListener('keydown', e => received.push({ key: e.key, code: e.code }))
  return {
    input, received,
    send: (type, event) => handlers.get(type)({ target: input, ...event }),
    key: event => windowHandlers.get('keydown')(event),
  }
}

test('empty input with null data is ignored without throwing or emitting a practice key', () => {
  const f = fixture()
  f.send('input', { inputType: 'insertText', data: null })
  assert.deepEqual(f.received, [])
})

test('empty replacement input is ignored', () => {
  const f = fixture()
  f.send('input', { inputType: 'insertReplacementText', data: '' })
  assert.deepEqual(f.received, [])
})

test('input still accepts value, data fallback and backspace', () => {
  for (const [value, data, inputType, key, code] of [
    ['c', null, 'insertText', 'c', 'KeyC'],
    ['', 'a', 'insertText', 'a', 'KeyA'],
    ['', null, 'deleteContentBackward', 'Backspace', 'Backspace'],
  ]) {
    const f = fixture()
    f.input.value = value
    f.send('input', { inputType, data })
    assert.deepEqual(f.received, [{ key, code }])
  }
})

test('composition defers input and an empty cancelled composition emits no key', () => {
  const f = fixture()
  f.send('compositionstart', {})
  f.input.value = 'c'
  f.send('input', { inputType: 'insertCompositionText', data: 'c' })
  assert.deepEqual(f.received, [])
  f.send('compositionend', { data: '' })
  assert.deepEqual(f.received, [])
  f.input.value = ''
  f.send('input', { inputType: 'insertCompositionText', data: null })
  assert.deepEqual(f.received, [])
})


test('active composition owns editing and confirmation keys without sending practice keys', () => {
  const f = fixture()
  f.send('compositionstart', {})
  for (const [key, code] of [['Backspace', 'Backspace'], ['Enter', 'Enter'], [' ', 'Space'], ['a', 'KeyA']]) {
    f.key({ key, code, isComposing: true })
  }
  assert.deepEqual(f.received, [])
  f.send('compositionend', { data: 'ca' })
  assert.deepEqual(f.received, [{ key: 'c', code: 'KeyC' }, { key: 'a', code: 'KeyA' }])
  f.key({ key: 'n', code: 'KeyN', isComposing: false })
  f.key({ key: 'Backspace', code: 'Backspace', isComposing: false })
  assert.deepEqual(f.received.slice(2), [{ key: 'n', code: 'KeyN' }, { key: 'Backspace', code: 'Backspace' }])
})

test('native isComposing key is ignored even without local compositionstart', () => {
  const f = fixture()
  f.key({ key: 'Backspace', code: 'Backspace', isComposing: true })
  assert.deepEqual(f.received, [])
  f.key({ key: 'Backspace', code: 'Backspace', isComposing: false })
  assert.deepEqual(f.received, [{ key: 'Backspace', code: 'Backspace' }])
})

test('cancelled composition resumes ordinary keys and Process remains ignored', () => {
  const f = fixture()
  f.send('compositionstart', {})
  f.key({ key: 'Backspace', code: 'Backspace', isComposing: true })
  f.send('compositionend', { data: '' })
  f.key({ key: 'Process', code: 'KeyC', isComposing: false })
  assert.deepEqual(f.received, [])
  f.key({ key: 'c', code: 'KeyC', isComposing: false })
  assert.deepEqual(f.received, [{ key: 'c', code: 'KeyC' }])
})


test('native keyboard composition end recovers even when compositionend was not delivered', () => {
  const f = fixture()
  f.send('compositionstart', {})
  f.key({ key: 'Backspace', code: 'Backspace', isComposing: true })
  assert.deepEqual(f.received, [])
  // Blink may delete the entire preedit without dispatching compositionend.
  f.key({ key: 'a', code: 'KeyA', isComposing: false })
  f.key({ key: 'Backspace', code: 'Backspace', isComposing: false })
  assert.deepEqual(f.received, [{ key: 'a', code: 'KeyA' }, { key: 'Backspace', code: 'Backspace' }])
})
