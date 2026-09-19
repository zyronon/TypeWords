import assert from 'node:assert/strict'
import test from 'node:test'
import { nextTick } from 'vue'
import { harness } from './init-subscriptions-harness.mjs'

for (const name of ['base', 'setting']) {
  test(`${name}: hydrated import flags do not swallow the first edit after restart`, async () => {
    const h = harness()
    h[name].init = async () => {
      h[name].setState({ marker: 'restored import', _ignoreWatch: true })
      return null
    }
    await h.init()
    h[name].marker = 'after restart'
    await nextTick()
    await h.clock.flush()
    assert.deepEqual(h.calls, [{ store: name, marker: 'after restart' }])
  })

  test(`${name}: real Pinia preserves the first edit inside the import debounce window`, async () => {
    const h = harness()
    await h.init()
    h[name].setState({ marker: 'imported', _ignoreWatch: true })
    await nextTick()
    h[name].marker = 'user edit'
    await nextTick()
    await h.clock.flush()
    assert.deepEqual(h.calls, [{ store: name, marker: 'user edit' }])
  })

  test(`${name}: real Pinia import cancels a previously scheduled autosave`, async () => {
    const h = harness()
    await h.init()
    h[name].marker = 'pending edit'
    await nextTick()
    h[name].setState({ marker: 'imported', _ignoreWatch: true })
    await nextTick()
    await h.clock.flush()
    await h.clock.flush()
    assert.deepEqual(h.calls, [])
    assert.equal(h[name]._ignoreWatch, false)
  })

  test(`${name}: reinitialization cancels old subscription timers`, async () => {
    const h = harness()
    await h.init()
    h[name].marker = 'pending edit'
    await nextTick()
    await h.init()
    await h.clock.flush()
    assert.deepEqual(h.calls, [])
    h[name].marker = 'new edit'
    await nextTick()
    await h.clock.flush()
    assert.deepEqual(h.calls, [{ store: name, marker: 'new edit' }])
  })

  test(`${name}: busy import suppression does not swallow the next genuine edit`, async () => {
    const h = harness()
    await h.init()
    h.runtime.globalLoading = true
    h[name].setState({ marker: 'imported', _ignoreWatch: true })
    await nextTick()
    h.runtime.globalLoading = false
    h[name].marker = 'after import'
    await nextTick()
    await h.clock.flush()
    assert.deepEqual(h.calls, [{ store: name, marker: 'after import' }])
  })
}
