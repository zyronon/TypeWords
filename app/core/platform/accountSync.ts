import { createClient, type Session } from '@supabase/supabase-js'
import { validatedSyncUrl } from './sync'

const SYNC_TYPES = ['dict', 'setting', 'practice_word', 'practice_article'] as const
type SyncType = (typeof SYNC_TYPES)[number]
export type AccountSyncRow = {
  type: SyncType
  data: unknown
  data_version: number
  updated_at: string
}
export type AccountSyncMode = 'read' | 'initial-upload' | 'automatic'

export class StaleAccountSyncError extends Error {
  constructor() {
    super('同步账号或会话已改变，请重新操作')
    this.name = 'StaleAccountSyncError'
  }
}

/**
 * Account transport only. Callers must also assertCurrent after their own awaits,
 * before applying remote data, committing local transactions or updating UI status.
 * Disposing cannot undo a write already accepted by the server.
 */
export function createAccountSync(url: string, key: string, desktop: boolean) {
  const projectUrl = validatedSyncUrl(url, desktop)
  const authClient = createClient(projectUrl, key)
  let session: Session | null = null
  let revision = 0
  let operation = 0
  let pendingSignIn: number | null = null
  let busy: 'sign-in' | 'sign-out' | null = null
  let blocked = false
  let disposed = false
  let active = false
  let lifetime = new AbortController()
  const completedTransfers = new WeakSet<object>()

  function advanceRevision() {
    revision++
    const previous = lifetime
    lifetime = new AbortController()
    previous.abort()
  }

  function invalidate() {
    session = null
    active = false
    advanceRevision()
  }

  function acceptSession(next: Session | null) {
    const valid = next?.user?.id && next.access_token && !next.user.is_anonymous ? next : null
    if (session?.user.id !== valid?.user.id || session?.access_token !== valid?.access_token) {
      if (session?.user.id !== valid?.user.id) active = false
      session = valid
      advanceRevision()
    } else {
      session = valid
    }
  }

  // No async SDK calls in the auth callback.
  const {
    data: { subscription },
  } = authClient.auth.onAuthStateChange((event, next) => {
    if (disposed || blocked) return
    if (event === 'INITIAL_SESSION' && (operation > 0 || revision > 0)) return
    if (busy) {
      if (busy === 'sign-in' && event === 'SIGNED_OUT') {
        operation++
        invalidate()
        blocked = true
      }
      return
    }
    acceptSession(event === 'SIGNED_OUT' ? null : next)
  })

  const initialRevision = revision
  const ready = authClient.auth.getSession().then(({ data, error }) => {
    if (disposed || busy || blocked || revision !== initialRevision) return
    if (error) {
      invalidate()
      blocked = true
      throw error
    }
    acceptSession(data.session)
  })
  // Consumers can await ready for errors; do not create an unhandled rejection on construction.
  void ready.catch(() => {})

  function assertOpen() {
    if (disposed) throw new StaleAccountSyncError()
  }

  async function signIn(email: string, password: string) {
    assertOpen()
    if (busy) throw new Error('账号操作尚未结束')
    const currentOperation = ++operation
    pendingSignIn = currentOperation
    busy = 'sign-in'
    blocked = false
    invalidate()
    try {
      const { data, error } = await authClient.auth.signInWithPassword({ email, password })
      if (disposed || operation !== currentOperation) throw new StaleAccountSyncError()
      if (error) throw error
      if (!data.session?.user.id || data.session.user.is_anonymous) throw new Error('需要非匿名账号登录')
      acceptSession(data.session)
    } catch (error) {
      if (!disposed && operation === currentOperation) {
        invalidate()
        blocked = true
      }
      throw error
    } finally {
      if (pendingSignIn === currentOperation) {
        pendingSignIn = null
        if (busy === 'sign-in') busy = null
      }
    }
  }

  async function signOut() {
    assertOpen()
    const currentOperation = ++operation
    busy = 'sign-out'
    blocked = true
    // Revoke application access immediately, even if SDK logout waits on a login or fails offline.
    invalidate()
    try {
      const { error } = await authClient.auth.signOut({ scope: 'local' })
      if (disposed || operation !== currentOperation) throw new StaleAccountSyncError()
      if (error) throw error
    } finally {
      if (operation === currentOperation) busy = null
      // Remain blocked until an explicit sign-in. A failed logout may retain SDK storage.
    }
  }

  function capture(mode: AccountSyncMode = 'read') {
    assertOpen()
    if (!['read', 'initial-upload', 'automatic'].includes(mode)) throw new Error('无效的同步模式')
    if (busy || blocked || !session) throw new Error('请先登录同步账号')
    if (mode === 'automatic' && !active) throw new Error('请先明确选择首次同步方向')
    const capturedRevision = revision
    const userId = session.user.id
    const token = session.access_token
    const assertCurrent = () => {
      if (disposed || blocked || busy || capturedRevision !== revision) throw new StaleAccountSyncError()
    }
    // Do not ask a shared auth client for a token after an await: it may now belong to another user.
    const client = createClient(projectUrl, key, {
      accessToken: async () => {
        assertCurrent()
        return token
      },
    })

    function validateTypes(types: readonly SyncType[]) {
      if (!types.length || new Set(types).size !== types.length || types.some(type => !SYNC_TYPES.includes(type))) {
        throw new Error('无效的同步数据类型')
      }
    }

    const scope = {
      userId,
      signal: lifetime.signal,
      assertCurrent,
      async read(types: readonly SyncType[], metadataOnly = false) {
        assertCurrent()
        const requestedTypes = [...types]
        validateTypes(requestedTypes)
        const table = client.from('typewords_data')
        const query = metadataOnly
          ? table.select('user_id,type,updated_at,data_version')
          : table.select('user_id,type,data,updated_at,data_version')
        const { data, error } = await query.eq('user_id', userId).in('type', requestedTypes)
        assertCurrent()
        if (error) throw error
        if (
          !Array.isArray(data) ||
          data.some(row => !row || row.user_id !== userId || !requestedTypes.includes(row.type)) ||
          new Set(data.map(row => row.type)).size !== data.length
        ) {
          throw new Error('远端账号数据无效')
        }
        // Empty/partial data may be inspected, but must never enable automatic writes.
        if (!metadataOnly && requestedTypes.length === SYNC_TYPES.length && data.length === requestedTypes.length) {
          completedTransfers.add(scope)
        }
        return data
      },
      async upsert(rows: readonly AccountSyncRow[]) {
        assertCurrent()
        if (mode === 'read') throw new Error('只读同步操作不能上传')
        validateTypes(rows.map(row => row.type))
        // Snapshot before the SDK awaits its token; caller mutations cannot change ownership or payload.
        const payload = structuredClone(rows).map(row => ({
          type: row.type,
          data: row.data,
          data_version: row.data_version,
          updated_at: row.updated_at,
          user_id: userId,
        }))
        const { error } = await client.from('typewords_data').upsert(payload, { onConflict: 'user_id,type' })
        assertCurrent()
        if (error) throw error
        if (payload.length === SYNC_TYPES.length) completedTransfers.add(scope)
      },
    }
    return scope
  }

  return {
    ready,
    signIn,
    signOut,
    capture,
    getState() {
      return {
        userId: session?.user.id ?? null,
        email: session?.user.email ?? null,
        busy,
        active,
      }
    },
    // Invoke only after payload validation AND the caller's local commit have succeeded.
    completeInitialSync(scope: ReturnType<typeof capture>) {
      scope.assertCurrent()
      if (!completedTransfers.has(scope)) throw new Error('首次同步尚未成功完成')
      active = true
    },
    dispose() {
      if (disposed) return
      disposed = true
      operation++
      busy = null
      invalidate()
      subscription.unsubscribe()
      void authClient.auth.stopAutoRefresh().catch(() => {})
    },
  }
}

export type AccountSync = ReturnType<typeof createAccountSync>
export type AccountSyncScope = ReturnType<AccountSync['capture']>
