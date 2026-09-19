import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const types = ['dict', 'setting', 'practice_word', 'practice_article']
const userA = '00000000-0000-4000-8000-000000000001'
const userB = '00000000-0000-4000-8000-000000000002'
const rows = () =>
  types.map(type => ({
    type,
    data: { fixture: true },
    data_version: 1,
    updated_at: '2026-09-16T00:00:00Z',
  }))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function session(id = userA, token = `synthetic-token-${id}`) {
  return { access_token: token, user: { id, email: `${id}@example.invalid`, is_anonymous: false } }
}
function load(path, modules) {
  const exports = {}
  runInNewContext(
    ts.transpileModule(readFileSync(resolve(root, path), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      URL,
      structuredClone,
      AbortController,
      require(name) {
        assert.ok(name in modules, `Unexpected import: ${name}`)
        return modules[name]
      },
    }
  )
  return exports
}
function harness(options = {}) {
  let callback,
    unsubscribed = false,
    stopped = false
  const requests = []
  const authCalls = []
  const auth = {
    onAuthStateChange(fn) {
      callback = fn
      return {
        data: {
          subscription: {
            unsubscribe() {
              unsubscribed = true
            },
          },
        },
      }
    },
    async getSession() {
      return options.initial ? await options.initial.promise : { data: { session: null }, error: null }
    },
    async signInWithPassword(credentials) {
      authCalls.push({ method: 'login', ...credentials })
      if (options.login) return await options.login.promise
      callback('SIGNED_IN', session())
      return { data: { session: session() }, error: null }
    },
    async signOut(args) {
      authCalls.push({ method: 'logout', ...args })
      if (options.logout) return await options.logout.promise
      callback('SIGNED_OUT', null)
      return { error: null }
    },
    async stopAutoRefresh() {
      stopped = true
    },
  }
  const sdk = {
    createClient(url, key, config) {
      if (!config?.accessToken) return { auth }
      return createClient(url, key, {
        ...config,
        global: {
          fetch: async (url, init) => {
            const request = {
              url: new URL(url),
              method: init.method,
              headers: new Headers(init.headers),
              body: init.body ? JSON.parse(init.body) : null,
            }
            requests.push(request)
            if (options.response) return await options.response(request)
            if (request.method === 'POST') return new Response(null, { status: 201 })
            const uid = request.url.searchParams.get('user_id').slice(3)
            const selected = request.url.searchParams.get('type').slice(4, -1).split(',')
            return Response.json(
              rows()
                .filter(row => selected.includes(row.type))
                .map(row => ({ ...row, user_id: uid }))
            )
          },
        },
      })
    },
  }
  const platform = load('app/core/platform/sync.ts', { '@supabase/supabase-js': sdk })
  const api = load('app/core/platform/accountSync.ts', { '@supabase/supabase-js': sdk, './sync': platform })
  const manager = api.createAccountSync('https://synthetic.supabase.co', 'sb_publishable_synthetic', true)
  return {
    manager,
    requests,
    authCalls,
    emit: (event, value) => callback(event, value),
    cleanupState: () => ({ unsubscribed, stopped }),
  }
}
async function signedIn(t, options) {
  const h = harness(options)
  t.after(() => h.manager.dispose())
  await h.manager.ready
  await h.manager.signIn('fixture@example.invalid', 'not-a-real-password')
  return h
}

test('account scope abort signal follows token, account, logout and disposal lifetime', async t => {
  const h = await signedIn(t)
  let scope = h.manager.capture()
  const first = scope.signal
  h.emit('SIGNED_IN', session())
  assert.equal(first.aborted, false)
  h.emit('TOKEN_REFRESHED', session(userA, 'replacement-token'))
  assert.equal(first.aborted, true)
  scope = h.manager.capture()
  h.emit('SIGNED_IN', session(userB))
  assert.equal(scope.signal.aborted, true)
  scope = h.manager.capture()
  await h.manager.signOut()
  assert.equal(scope.signal.aborted, true)
  await h.manager.signIn('fixture@example.invalid', 'synthetic')
  scope = h.manager.capture()
  h.manager.dispose()
  assert.equal(scope.signal.aborted, true)
})

test('account invalidation observers see the new identity, never the retired token', async t => {
  const h = await signedIn(t)
  let replacement
  h.manager.capture().signal.addEventListener('abort', () => {
    replacement = h.manager.capture()
  })
  h.emit('SIGNED_IN', session(userB))
  assert.equal(replacement.userId, userB)
  assert.equal(replacement.signal.aborted, false)
  await replacement.read(['dict'])
  assert.equal(h.requests[0].headers.get('authorization'), `Bearer synthetic-token-${userB}`)
})

test('account login does not authorize automatic writes or expose tokens/passwords', async t => {
  const h = await signedIn(t)
  assert.equal(h.manager.getState().userId, userA)
  assert.equal(h.manager.getState().active, false)
  assert.throws(() => h.manager.capture('automatic'), /首次同步/)
  assert.equal(h.requests.length, 0)
  const state = JSON.stringify(h.manager.getState())
  assert.ok(!state.includes('synthetic-token'))
  assert.ok(!state.includes('not-a-real-password'))
  await assert.rejects(h.manager.capture().upsert(rows()), /只读/)
  assert.equal(h.requests.length, 0)
})

test('installed SDK reads use a fixed subject filter and fixed bearer token', async t => {
  const h = await signedIn(t)
  const scope = h.manager.capture()
  const result = await scope.read(types)
  assert.equal(result.length, 4)
  assert.equal(h.requests[0].url.pathname, '/rest/v1/typewords_data')
  assert.equal(h.requests[0].url.searchParams.get('user_id'), `eq.${userA}`)
  assert.equal(h.requests[0].headers.get('authorization'), `Bearer synthetic-token-${userA}`)
  assert.throws(() => h.manager.capture('automatic'), /首次同步/)
  h.manager.completeInitialSync(scope)
  assert.equal(h.manager.getState().active, true)
})

test('installed SDK upsert uses account conflict key and overrides injected ownership', async t => {
  const h = await signedIn(t)
  const data = rows().map(row => ({ ...row, user_id: userB }))
  const scope = h.manager.capture('initial-upload')
  const upload = scope.upsert(data)
  data[0].data.fixture = false
  data[0].user_id = userB
  await upload
  const request = h.requests[0]
  assert.equal(request.method, 'POST')
  assert.equal(request.url.searchParams.get('on_conflict'), 'user_id,type')
  assert.ok(request.body.every(row => row.user_id === userA))
  assert.equal(request.body[0].data.fixture, true)
  assert.equal(h.manager.getState().active, false)
  h.manager.completeInitialSync(scope)
  await h.manager.capture('automatic').upsert([rows()[0]])
})

test('empty, partial and metadata reads cannot complete initial sync', async t => {
  for (const result of [[], [{ ...rows()[0], user_id: userA }]]) {
    const h = await signedIn(t, { response: async () => Response.json(result) })
    const scope = h.manager.capture()
    await scope.read(types)
    assert.throws(() => h.manager.completeInitialSync(scope), /尚未成功/)
  }
  const h = await signedIn(t)
  const metadata = h.manager.capture()
  await metadata.read(types, true)
  assert.throws(() => h.manager.completeInitialSync(metadata), /尚未成功/)
  const partial = h.manager.capture('initial-upload')
  await partial.upsert([rows()[0]])
  assert.throws(() => h.manager.completeInitialSync(partial), /尚未成功/)
})

test('malformed and foreign account responses are rejected', async t => {
  for (const result of [
    null,
    {},
    [null],
    [{ ...rows()[0], user_id: userB }],
    [
      { ...rows()[0], user_id: userA },
      { ...rows()[0], user_id: userA },
    ],
    [{ ...rows()[0], user_id: userA, type: 'unexpected' }],
  ]) {
    const h = await signedIn(t, { response: async () => Response.json(result) })
    const scope = h.manager.capture()
    await assert.rejects(scope.read(types), /远端账号数据无效/)
    assert.throws(() => h.manager.completeInitialSync(scope), /尚未成功/)
  }
})

test('wrong or duplicate types fail before making a network request', async t => {
  const h = await signedIn(t)
  assert.throws(() => h.manager.capture('unexpected'), /无效/)
  for (const invalid of [[], ['dict', 'dict'], ['unknown']]) {
    await assert.rejects(h.manager.capture().read(invalid), /无效/)
    await assert.rejects(
      h.manager.capture('initial-upload').upsert(invalid.map(type => ({ ...rows()[0], type }))),
      /无效/
    )
  }
  assert.equal(h.requests.length, 0)
})

test('same-user SIGNED_IN preserves scope; refresh invalidates old tokens without resetting direction', async t => {
  const h = await signedIn(t)
  const scope = h.manager.capture()
  await scope.read(types)
  h.manager.completeInitialSync(scope)
  h.emit('SIGNED_IN', session())
  scope.assertCurrent()
  assert.equal(h.manager.getState().active, true)
  h.emit('TOKEN_REFRESHED', session(userA, 'refreshed-synthetic-token'))
  assert.throws(scope.assertCurrent, { name: 'StaleAccountSyncError' })
  await h.manager.capture('automatic').read(types)
  assert.equal(h.requests.at(-1).headers.get('authorization'), 'Bearer refreshed-synthetic-token')
})

test('account switch revokes old scopes and requires a new initial direction', async t => {
  const h = await signedIn(t)
  const old = h.manager.capture()
  await old.read(types)
  h.manager.completeInitialSync(old)
  h.emit('SIGNED_IN', session(userB))
  assert.equal(h.manager.getState().userId, userB)
  assert.equal(h.manager.getState().active, false)
  assert.throws(() => h.manager.completeInitialSync(old), { name: 'StaleAccountSyncError' })
  await assert.rejects(old.read(types), { name: 'StaleAccountSyncError' })
  await h.manager.capture().read(types)
  assert.equal(h.requests.at(-1).url.searchParams.get('user_id'), `eq.${userB}`)
})

test('a scope invalidated before SDK token resolution cannot send under another account', async t => {
  const h = await signedIn(t)
  const write = h.manager.capture('initial-upload').upsert(rows())
  h.emit('SIGNED_IN', session(userB))
  await assert.rejects(write, { name: 'StaleAccountSyncError' })
  assert.equal(h.requests.length, 0)
})

for (const method of ['read', 'upsert']) {
  test(`late ${method} response is rejected after an account switch`, async t => {
    const started = deferred(),
      response = deferred()
    const h = await signedIn(t, {
      response: async () => {
        started.resolve()
        return await response.promise
      },
    })
    const scope = h.manager.capture('initial-upload')
    const request = method === 'read' ? scope.read(types) : scope.upsert(rows())
    await started.promise
    h.emit('SIGNED_IN', session(userB))
    response.resolve(
      method === 'read'
        ? Response.json(rows().map(row => ({ ...row, user_id: userA })))
        : new Response(null, { status: 201 })
    )
    await assert.rejects(request, { name: 'StaleAccountSyncError' })
    assert.equal(h.manager.getState().userId, userB)
    assert.equal(h.manager.getState().active, false)
    assert.equal(h.requests[0].headers.get('authorization'), `Bearer synthetic-token-${userA}`)
  })
}

test('logout immediately invalidates in-flight scopes and stays blocked on failure', async t => {
  const logout = deferred()
  const h = await signedIn(t, { logout })
  const scope = h.manager.capture()
  const done = h.manager.signOut()
  assert.throws(scope.assertCurrent, { name: 'StaleAccountSyncError' })
  assert.throws(() => h.manager.capture(), /登录/)
  h.emit('TOKEN_REFRESHED', session())
  assert.equal(h.manager.getState().userId, null)
  logout.resolve({ error: new Error('offline logout') })
  await assert.rejects(done, /offline logout/)
  h.emit('SIGNED_IN', session())
  assert.equal(h.manager.getState().userId, null)
  assert.equal(h.manager.getState().busy, null)
  assert.equal(h.authCalls.at(-1).scope, 'local')
})

test('logout cancels a delayed login result without resurrecting its account', async t => {
  const login = deferred()
  const h = harness({ login })
  t.after(() => h.manager.dispose())
  await h.manager.ready
  const pending = h.manager.signIn('fixture@example.invalid', 'synthetic')
  await h.manager.signOut()
  h.emit('SIGNED_IN', session())
  login.resolve({ data: { session: session() }, error: null })
  await assert.rejects(pending, { name: 'StaleAccountSyncError' })
  assert.equal(h.manager.getState().userId, null)
  assert.equal(h.manager.getState().busy, null)
})

test('external signout during login invalidates its result and releases busy state', async t => {
  const login = deferred()
  const h = harness({ login })
  t.after(() => h.manager.dispose())
  await h.manager.ready
  const pending = h.manager.signIn('fixture@example.invalid', 'synthetic')
  h.emit('SIGNED_OUT', null)
  login.resolve({ data: { session: session() }, error: null })
  await assert.rejects(pending, { name: 'StaleAccountSyncError' })
  assert.equal(h.manager.getState().busy, null)
  assert.equal(h.manager.getState().userId, null)
})

test('late initial session cannot overwrite a subsequent login', async t => {
  const initial = deferred()
  const h = harness({ initial })
  t.after(() => h.manager.dispose())
  await h.manager.signIn('fixture@example.invalid', 'synthetic')
  initial.resolve({ data: { session: session(userB) }, error: null })
  await h.manager.ready
  assert.equal(h.manager.getState().userId, userA)
})

test('late INITIAL_SESSION event cannot replace a completed explicit login', async t => {
  const h = await signedIn(t)
  const scope = h.manager.capture()
  h.emit('INITIAL_SESSION', session(userB))
  assert.equal(h.manager.getState().userId, userA)
  scope.assertCurrent()
})

test('failed login blocks stale stored events but a new explicit login can recover', async t => {
  const login = deferred()
  const options = { login }
  const h = harness(options)
  t.after(() => h.manager.dispose())
  await h.manager.ready
  const pending = h.manager.signIn('fixture@example.invalid', 'synthetic')
  await assert.rejects(h.manager.signIn('second@example.invalid', 'synthetic'), /尚未结束/)
  login.resolve({ data: { session: null }, error: new Error('invalid credentials') })
  await assert.rejects(pending, /invalid credentials/)
  h.emit('SIGNED_IN', session())
  assert.equal(h.manager.getState().userId, null)
  assert.equal(h.manager.getState().busy, null)
  options.login = null
  await h.manager.signIn('fixture@example.invalid', 'synthetic')
  assert.equal(h.manager.getState().userId, userA)
  assert.equal(h.manager.getState().active, false)
})

test('successful logout allows a later explicit login, still without upload authorization', async t => {
  const h = await signedIn(t)
  await h.manager.signOut()
  await h.manager.signIn('fixture@example.invalid', 'synthetic')
  assert.equal(h.manager.getState().userId, userA)
  assert.equal(h.manager.getState().active, false)
})

test('disposing during login rejects its late result and cannot revive the manager', async t => {
  const login = deferred()
  const h = harness({ login })
  t.after(() => h.manager.dispose())
  await h.manager.ready
  const pending = h.manager.signIn('fixture@example.invalid', 'synthetic')
  h.manager.dispose()
  login.resolve({ data: { session: session() }, error: null })
  await assert.rejects(pending, { name: 'StaleAccountSyncError' })
  assert.equal(h.manager.getState().userId, null)
  assert.throws(() => h.manager.capture(), { name: 'StaleAccountSyncError' })
})

test('restored sessions require initial direction; anonymous sessions are rejected', async t => {
  const initial = deferred()
  const h = harness({ initial })
  t.after(() => h.manager.dispose())
  initial.resolve({ data: { session: session() }, error: null })
  await h.manager.ready
  assert.throws(() => h.manager.capture('automatic'), /首次同步/)
  h.emit('SIGNED_IN', { ...session(), user: { id: userB, is_anonymous: true } })
  assert.equal(h.manager.getState().userId, null)
  assert.throws(() => h.manager.capture(), /登录/)
})

test('disposed/project-replaced managers cannot accept events, complete sync, or send requests', async t => {
  const h = await signedIn(t)
  const scope = h.manager.capture()
  await scope.read(types)
  h.manager.dispose()
  h.manager.dispose()
  h.emit('SIGNED_IN', session(userB))
  assert.equal(h.manager.getState().userId, null)
  assert.deepEqual(h.cleanupState(), { unsubscribed: true, stopped: true })
  assert.throws(() => h.manager.completeInitialSync(scope), { name: 'StaleAccountSyncError' })
  await assert.rejects(scope.read(types), { name: 'StaleAccountSyncError' })
})

test('failed REST writes do not enable automatic synchronization', async t => {
  const h = await signedIn(t, {
    response: async () => Response.json({ code: '42501', message: 'synthetic RLS rejection' }, { status: 403 }),
  })
  const scope = h.manager.capture('initial-upload')
  await assert.rejects(scope.upsert(rows()), { code: '42501', message: 'synthetic RLS rejection' })
  assert.throws(() => h.manager.completeInitialSync(scope), /尚未成功/)
  assert.equal(h.manager.getState().active, false)
})

test('caller mutations cannot turn a partial transfer into completed initial sync', async t => {
  const started = deferred(),
    response = deferred()
  const h = await signedIn(t, {
    response: async () => {
      started.resolve()
      return await response.promise
    },
  })
  const scope = h.manager.capture('initial-upload')
  const partial = [rows()[0]]
  const request = scope.upsert(partial)
  await started.promise
  partial.push(...rows().slice(1))
  response.resolve(new Response(null, { status: 201 }))
  await request
  assert.throws(() => h.manager.completeInitialSync(scope), /尚未成功/)
  assert.equal(h.requests[0].body.length, 1)
})

test('scope from another project cannot authorize this project', async t => {
  const first = await signedIn(t),
    second = await signedIn(t)
  const scope = first.manager.capture()
  await scope.read(types)
  assert.throws(() => second.manager.completeInitialSync(scope), /尚未成功/)
  assert.equal(second.manager.getState().active, false)
})

test('installed Auth and REST SDKs complete a synthetic password login/read/upload/local logout', async t => {
  const requests = []
  const expires = Math.floor(Date.now() / 1000) + 3600
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: userA,
    aud: 'authenticated',
    role: 'authenticated',
    exp: expires,
    iat: expires - 3600,
    iss: 'https://synthetic.supabase.co/auth/v1',
  })}.synthetic-signature`
  const sdk = {
    createClient(url, key, config = {}) {
      return createClient(url, key, {
        ...config,
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: {
          fetch: async (url, init) => {
            const parsed = new URL(url)
            requests.push({ url: parsed, method: init.method, headers: new Headers(init.headers) })
            if (parsed.pathname === '/auth/v1/token') {
              assert.equal(parsed.searchParams.get('grant_type'), 'password')
              assert.deepEqual(JSON.parse(init.body), {
                email: 'fixture@example.invalid',
                password: 'synthetic-password',
                gotrue_meta_security: {},
              })
              return Response.json({
                access_token: token,
                refresh_token: 'synthetic-refresh-token',
                token_type: 'bearer',
                expires_in: 3600,
                expires_at: expires,
                user: {
                  id: userA,
                  email: 'fixture@example.invalid',
                  is_anonymous: false,
                  app_metadata: {},
                  user_metadata: {},
                },
              })
            }
            if (parsed.pathname === '/auth/v1/logout') {
              assert.equal(parsed.searchParams.get('scope'), 'local')
              return new Response(null, { status: 204 })
            }
            assert.equal(parsed.pathname, '/rest/v1/typewords_data')
            assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`)
            if (init.method === 'POST') {
              assert.ok(JSON.parse(init.body).every(row => row.user_id === userA))
              return new Response(null, { status: 201 })
            }
            return Response.json(rows().map(row => ({ ...row, user_id: userA })))
          },
        },
      })
    },
  }
  const platform = load('app/core/platform/sync.ts', { '@supabase/supabase-js': sdk })
  const api = load('app/core/platform/accountSync.ts', { '@supabase/supabase-js': sdk, './sync': platform })
  const manager = api.createAccountSync('https://synthetic.supabase.co', 'sb_publishable_synthetic', true)
  t.after(() => manager.dispose())
  await manager.ready
  await manager.signIn('fixture@example.invalid', 'synthetic-password')
  assert.equal(manager.getState().userId, userA)
  const scope = manager.capture('initial-upload')
  await scope.read(types)
  await scope.upsert(rows())
  manager.completeInitialSync(scope)
  await manager.signOut()
  assert.equal(manager.getState().userId, null)
  assert.equal(manager.getState().active, false)
  assert.throws(scope.assertCurrent, { name: 'StaleAccountSyncError' })
  assert.deepEqual(
    requests.map(request => request.url.pathname),
    ['/auth/v1/token', '/rest/v1/typewords_data', '/rest/v1/typewords_data', '/auth/v1/logout']
  )
})
