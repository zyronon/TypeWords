import { createStore, setMany, type UseStore } from 'idb-keyval'
import type { AccountSyncScope } from './accountSync'

let accountStore: UseStore | undefined

// Use the existing idb-keyval database, not a separate account data store.
export async function setManyForAccount(
  entries: [IDBValidKey, unknown][],
  scope: AccountSyncScope,
  store: UseStore = (accountStore ??= createStore('keyval-store', 'keyval'))
): Promise<void> {
  scope.assertCurrent()
  await setMany(entries, (mode, callback) =>
    store(mode, objectStore => {
      // Opening the database is asynchronous too.
      scope.assertCurrent()
      const transaction = objectStore.transaction
      const abort = () => {
        try {
          transaction.abort()
        } catch {
          // A completed transaction cannot be undone; the post-await guard still applies.
        }
      }
      scope.signal.addEventListener('abort', abort, { once: true })
      try {
        return Promise.resolve(callback(objectStore)).finally(() => scope.signal.removeEventListener('abort', abort))
      } catch (error) {
        abort()
        scope.signal.removeEventListener('abort', abort)
        throw error
      }
    })
  )
  scope.assertCurrent()
}
