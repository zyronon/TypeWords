import assert from 'node:assert/strict'
import test from 'node:test'
import { nextTick } from 'vue'
import { harness } from './init-subscriptions-harness.mjs'

for (const name of ['base', 'setting']) {
  test(`${name}: long import consumes ignore flag while busy, next genuine edit persists`, async () => {
    const h = harness()
    await h.init()
    h.runtime.globalLoading = true
    h[name].setState({ _ignoreWatch: true, marker: 'imported' })
    await nextTick()
    await h.clock.flush()
    assert.equal(h.calls.length, 0)
    assert.equal(h[name]._ignoreWatch, false, 'busy import must consume its own ignored mutation')
    h.runtime.globalLoading = false
    h[name].marker = 'user edit'
    await nextTick()
    await h.clock.flush()
    assert.deepEqual(h.calls, [{ store: name, marker: 'user edit' }])
  })
}
