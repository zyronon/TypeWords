import {
  _getDictDataByUrl,
  checkAndUpgradeSaveDict,
  checkAndUpgradeSaveSetting,
  shakeCommonDict,
  shouldFetchRemote,
} from '../utils'
import {
  checkAndUpgradePracticeWordCache,
  getPracticeArticleCacheLocal,
  getPracticeArticleCacheLocalWithMeta,
  getPracticeWordCacheLocal,
  getPracticeWordCacheLocalWithMeta,
  PRACTICE_ARTICLE_CACHE,
  PRACTICE_WORD_CACHE,
  type PracticeArticleCache,
  type PracticeWordCacheStored,
  setPracticeArticleCacheLocal,
  setPracticeWordCacheLocal,
} from '../utils/cache'
import {
  APP_VERSION,
  BACKUP_INDEX_KEY,
  BACKUP_KEY,
  DictId,
  LOCAL_FILE_KEY,
  SAVE_DICT_KEY,
  SAVE_SETTING_KEY,
  WEBSITE_VERSION_HASH,
} from '../config/env'
import { type BaseState, getDefaultBaseState, getDefaultSettingState, useBaseStore, useSettingStore } from '../stores'
import type { BackupData, SaveData, Snapshot } from '../types/types.ts'
import { SyncDataType, CompareResult, DictType } from '../types/enum'
import { Supabase } from '../utils/supabase'
import { del, get, set, setMany } from 'idb-keyval'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Toast } from '@/base'
import { nextTick, toRaw } from 'vue'
import { RemoteDataValidationError, validateRemotePracticeCache } from './remotePracticeValidation'
import { validateStoredSettings } from './settingsValidation'
import { validateStoredDictionary } from './dictionaryValidation'
import type { AccountSync, AccountSyncScope } from '../platform/accountSync'
import { setManyForAccount } from '../platform/accountPersistence'

// JSON cloning changes FSRS Date objects into strings; unwrap reactive children individually.
function cloneImportState<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const raw = toRaw(value)
  if (raw instanceof Date) return new Date(raw.getTime()) as T
  if (Array.isArray(raw)) return raw.map(cloneImportState) as T
  return Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, cloneImportState(item)])) as T
}

// Serialize writes across composable instances; an import invalidates queued autosaves.
let persistenceQueue: Promise<unknown> = Promise.resolve()
let importGeneration = 0
function enqueuePersistence<T>(action: () => Promise<T>, generation?: number): Promise<T> {
  const result = persistenceQueue.then(() =>
    generation === undefined || generation === importGeneration ? action() : undefined
  )
  persistenceQueue = result.catch(() => {})
  return result as Promise<T>
}

type RemoteMetaRow = {
  type: SyncDataType
  updated_at?: string
  data_version?: number
}

type RemoteDataRow = RemoteMetaRow & {
  data: any
}

type LocalPersistMeta = {
  updated_at?: string
  version?: number
}

type SaveLocalAndSyncOptions = {
  client?: SupabaseClient | null
  pullWhenRemoteNewer?: boolean
  pushWhenLocalNewer?: boolean
  canSyncRemote?: boolean
}

const DICT_SYNC_BLOCK_REASON = '检测到自定义文章里面有自定义音频，无法使用同步功能'

const ALL_SYNC_TYPES: SyncDataType[] = [
  SyncDataType.dict,
  SyncDataType.setting,
  SyncDataType.practice_word,
  SyncDataType.practice_article,
]

function getDataVersion(type: SyncDataType): number {
  switch (type) {
    case SyncDataType.dict:
      return SAVE_DICT_KEY.version
    case SyncDataType.setting:
      return SAVE_SETTING_KEY.version
    case SyncDataType.practice_word:
      return PRACTICE_WORD_CACHE.version
    case SyncDataType.practice_article:
      return PRACTICE_ARTICLE_CACHE.version
  }
}

function getPersistKey(type: SyncDataType): string {
  return type === SyncDataType.dict ? SAVE_DICT_KEY.key : SAVE_SETTING_KEY.key
}

export class RemoteDataReadError extends Error {
  constructor() {
    super('远端同步数据读取失败，本地缓存仅在内存中恢复，请检查同步配置后重试')
  }
}

function getSyncClient(client?: SupabaseClient | null, allowReadRetry = false): SupabaseClient | null {
  if (!Supabase.isEnabled()) return null
  if (client) return client
  if (!Supabase.check(allowReadRetry)) return null
  return Supabase.getInstance() as SupabaseClient
}

async function getLocalPersistMeta(type: SyncDataType): Promise<LocalPersistMeta | null> {
  if (type === SyncDataType.practice_word) {
    return await getPracticeWordCacheLocalWithMeta()
  }
  if (type === SyncDataType.practice_article) {
    return await getPracticeArticleCacheLocalWithMeta()
  }
  const raw = await get(getPersistKey(type))
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function persistLocalState(type: SyncDataType, val: unknown, updated_at?: string): Promise<void> {
  // console.log('persistLocalState',type,updated_at)
  if (type === SyncDataType.practice_word) {
    await setPracticeWordCacheLocal(val as PracticeWordCacheStored, updated_at)
    return
  }
  if (type === SyncDataType.practice_article) {
    await setPracticeArticleCacheLocal(val as PracticeArticleCache, updated_at)
    return
  }
  await set(
    getPersistKey(type),
    JSON.stringify({
      val,
      version: getDataVersion(type),
      updated_at,
    })
  )
}

function hydrateDictData(store: ReturnType<typeof useBaseStore>, scope?: AccountSyncScope) {
  const word = store.word
  const article = store.article
  if (store.word.studyIndex >= 3) {
    if (!store.sdict.custom && !store.sdict.system && !store.sdict.words.length) {
      const index = word.studyIndex
      const dict = store.sdict
      _getDictDataByUrl(dict)
        .then(r => {
          scope?.assertCurrent()
          if (store.word === word && word.bookList[index] === dict) word.bookList[index] = r
        })
        .catch(error => console.warn('Remote dictionary resource load failed', error))
    }
  }
  if (store.article.studyIndex >= 1) {
    if (!store.sbook.custom && !store.sbook.system && !store.sbook.articles.length) {
      const index = article.studyIndex
      const book = store.sbook
      _getDictDataByUrl(book, DictType.article)
        .then(r => {
          scope?.assertCurrent()
          if (store.article === article && article.bookList[index] === book) article.bookList[index] = r
        })
        .catch(error => console.warn('Remote article resource load failed', error))
    }
  }
}

async function fetchServerMeta(types: SyncDataType[], client?: SupabaseClient | null): Promise<RemoteMetaRow[] | null> {
  const sb = getSyncClient(client)
  if (!sb) return null
  try {
    const { data, error } = await sb.from('typewords_data').select('type, updated_at, data_version').in('type', types)
    if (error) {
      console.log('sp-error', error)
      Supabase.setStatus('error', error?.message ?? String(error))
      return null
    }
    // Only a valid empty array means no remote rows; malformed metadata must never select a push.
    const seen = new Set<SyncDataType>()
    if (
      !Array.isArray(data) ||
      data.some(row => {
        if (
          !row ||
          typeof row !== 'object' ||
          Array.isArray(row) ||
          !types.includes(row.type) ||
          seen.has(row.type) ||
          (row.data_version != null && (!Number.isInteger(row.data_version) || row.data_version < 1)) ||
          (row.updated_at != null &&
            (typeof row.updated_at !== 'string' ||
              !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(row.updated_at) ||
              !Number.isFinite(Date.parse(row.updated_at))))
        ) {
          return true
        }
        seen.add(row.type)
        return false
      })
    ) {
      throw new Error('远端同步元数据无效，请检查数据和读取权限后重试')
    }
    return data as RemoteMetaRow[]
  } catch (error) {
    console.log('sp-error', error)
    Supabase.setStatus('error', error?.message ?? String(error))
    return null
  }
}

async function fetchServerDatas(
  types: SyncDataType[],
  client?: SupabaseClient | null
): Promise<RemoteDataRow[] | null> {
  const sb = getSyncClient(client)
  if (!sb) return null
  console.log('Fetching server data list', types)
  try {
    const { data, error } = await sb
      .from('typewords_data')
      .select('type, data, updated_at, data_version')
      .in('type', types)
    if (error) {
      console.log('sp-error', error)
      Supabase.setStatus('error', error?.message ?? String(error))
      return null
    }
    // Metadata selected these rows for a pull; missing rows are not a successful read.
    if (
      !Array.isArray(data) ||
      data.length !== types.length ||
      types.some(type => data.filter(row => row?.type === type).length !== 1)
    ) {
      throw new Error('远端同步数据不完整，请检查读取权限后重试')
    }
    return data as RemoteDataRow[]
  } catch (error) {
    console.log('sp-error', error)
    Supabase.setStatus('error', error?.message ?? String(error))
    return null
  }
}

async function compareResultByType(
  type: SyncDataType,
  remoteMetaMap: Map<SyncDataType, RemoteMetaRow>,
  localMeta?: LocalPersistMeta
): Promise<CompareResult> {
  const remoteMeta = remoteMetaMap.get(type)
  if (!remoteMeta) return CompareResult.NoRemote
  if (localMeta == null) {
    localMeta = await getLocalPersistMeta(type)
  }
  if (!localMeta) {
    if (remoteMeta.data_version == null) {
      return CompareResult.NoRemote
    } else {
      //如果本地没数据，但远程有版本号，则远程新
      return CompareResult.RemoteNewer
    }
  }
  //如果本地没有更新日期，那必定是刚更新版本，updated_at和sb 一起上线，这里特殊处理即可
  if (!localMeta?.updated_at) return CompareResult.LocalNewer
  const currentVersion = getDataVersion(type)
  return shouldFetchRemote(localMeta.updated_at, remoteMeta.updated_at, remoteMeta.data_version, currentVersion)
}

async function upsertServerDatas(rows: RemoteDataRow[], client?: SupabaseClient | null): Promise<boolean> {
  const sb = getSyncClient(client)
  if (!sb) return false
  try {
    console.log(
      'Upserting server data',
      rows.map(row => row.type)
    )
    const { error } = await (sb as any).from('typewords_data').upsert(rows, { onConflict: 'type' })
    if (error) {
      Supabase.setStatus('error', error?.message ?? String(error))
      return false
    }
    return true
  } catch (e) {
    Supabase.setStatus('error', (e as Error)?.message ?? String(e))
    return false
  }
}

async function applyRemoteDataByType(
  type: SyncDataType,
  row: RemoteDataRow,
  store: ReturnType<typeof useBaseStore>,
  settingStore: ReturnType<typeof useSettingStore>
): Promise<void> {
  if (!row) return
  try {
    await applyRemoteDataBatch([row], store, settingStore)
  } catch (error) {
    Supabase.setStatus('error', error?.message ?? String(error))
    throw error
  }
}

function validateRemoteDataRow(row: RemoteDataRow): void {
  const cache = row.type === SyncDataType.practice_word || row.type === SyncDataType.practice_article
  if (
    !ALL_SYNC_TYPES.includes(row.type) ||
    !Number.isInteger(row.data_version) ||
    row.data_version < 1 ||
    row.data_version > getDataVersion(row.type) ||
    (!(cache && row.data === null) && (!row.data || typeof row.data !== 'object' || Array.isArray(row.data)))
  ) {
    throw new RemoteDataValidationError(
      'Invalid or unsupported remote data',
      row.data_version > getDataVersion(row.type) ? row.data_version : undefined
    )
  }
  if (cache) {
    validateRemotePracticeCache(
      row.data,
      row.type === SyncDataType.practice_word ? 'word' : 'article',
      row.data_version
    )
  }
  if (row.type === SyncDataType.setting) {
    try {
      validateStoredSettings(row.data)
    } catch (error) {
      throw new RemoteDataValidationError(`Invalid remote settings: ${error instanceof Error ? error.message : error}`)
    }
  }
  if (row.type === SyncDataType.dict) {
    try {
      validateStoredDictionary(row.data)
    } catch (error) {
      throw new RemoteDataValidationError(
        `Invalid remote dictionary: ${error instanceof Error ? error.message : error}`
      )
    }
  }
}

async function applyRemoteDataBatch(
  rows: RemoteDataRow[],
  store: ReturnType<typeof useBaseStore>,
  settingStore: ReturnType<typeof useSettingStore>,
  scope?: AccountSyncScope
): Promise<void> {
  scope?.assertCurrent()
  // Validate every envelope before legacy normalizers or live state changes.
  const prepared = new Map<SyncDataType, any>()
  for (const row of rows) {
    validateRemoteDataRow(row)
    if (prepared.has(row.type)) throw new RemoteDataValidationError('Duplicate remote data type')
    prepared.set(row.type, cloneImportState(row.data))
  }
  const now = new Date().toISOString()
  if (prepared.has(SyncDataType.setting)) {
    const row = rows.find(row => row.type === SyncDataType.setting)!
    const normalized = await checkAndUpgradeSaveSetting({
      val: prepared.get(row.type),
      version: row.data_version,
    })
    scope?.assertCurrent()
    normalized.load = true
    normalized._ignoreWatch = true
    prepared.set(row.type, normalized)
  }
  if (prepared.has(SyncDataType.dict)) {
    const row = rows.find(row => row.type === SyncDataType.dict)!
    const normalized = await checkAndUpgradeSaveDict({
      val: prepared.get(row.type),
      version: row.data_version,
    })
    scope?.assertCurrent()
    normalized.load = true
    normalized._ignoreWatch = true
    prepared.set(row.type, normalized)
  }
  if (prepared.has(SyncDataType.practice_word)) {
    const row = rows.find(row => row.type === SyncDataType.practice_word)!
    prepared.set(
      row.type,
      checkAndUpgradePracticeWordCache(
        { val: prepared.get(row.type), version: row.data_version },
        prepared.get(SyncDataType.setting) ?? settingStore.$state
      ).val
    )
  }
  const entries: [string, string][] = rows.map(row => [
    row.type === SyncDataType.practice_word
      ? PRACTICE_WORD_CACHE.key
      : row.type === SyncDataType.practice_article
        ? PRACTICE_ARTICLE_CACHE.key
        : getPersistKey(row.type),
    JSON.stringify({
      val: prepared.get(row.type),
      version: getDataVersion(row.type),
      updated_at: row.updated_at ?? now,
    }),
  ])
  const previousDict = cloneImportState(store.$state)
  const previousSetting = cloneImportState(settingStore.$state)
  // Account pulls publish to memory only after the cancellable transaction commits.
  // A stale operation must never restore a snapshot over the next account's state.
  if (scope) {
    await setManyForAccount(entries, scope)
    scope.assertCurrent()
  }
  try {
    scope?.assertCurrent()
    if (prepared.has(SyncDataType.dict)) store.setState(prepared.get(SyncDataType.dict))
    scope?.assertCurrent()
    if (prepared.has(SyncDataType.setting)) settingStore.setState(prepared.get(SyncDataType.setting))
    if (!scope) await setMany(entries)
  } catch (error) {
    scope?.assertCurrent()
    if (prepared.has(SyncDataType.dict)) store.setState({ ...previousDict, _ignoreWatch: true })
    if (prepared.has(SyncDataType.setting)) {
      settingStore.$patch(state => {
        for (const key of Object.keys(state)) delete state[key]
        Object.assign(state, previousSetting, { _ignoreWatch: true })
      })
    }
    await nextTick()
    throw error
  }
  await nextTick()
  scope?.assertCurrent()
  if (prepared.has(SyncDataType.dict)) {
    // Resource availability does not undo a completed local transaction.
    try {
      hydrateDictData(store, scope)
    } catch (error) {
      console.warn('Remote dictionary resource load failed', error)
    }
  }
}

function getDictSyncBlockReason(state: BaseState): string | null {
  const data = shakeCommonDict(state)
  const bookList = data.article.bookList.filter(v => v.custom || v.system)
  const audioFileIdList: string[] = []
  bookList.forEach(v => {
    v.articles
      .filter(s => !s.audioSrc && s.audioFileId)
      .forEach(a => {
        audioFileIdList.push(a.audioFileId)
      })
  })
  return audioFileIdList.length ? DICT_SYNC_BLOCK_REASON : null
}

type HashBackupIndexItem = {
  hash: string
  key: string
  createdAt: number
}

function normalizeHash(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  return v.length > 0 ? v : null
}

export async function ensureHashGuardBeforeInit() {
  //@ts-ignore
  const runtimeConfig = useRuntimeConfig()

  try {
    const currentHash = normalizeHash(runtimeConfig?.public?.latestCommitHash)
    if (!currentHash) return

    const localHash = normalizeHash(await get(WEBSITE_VERSION_HASH))
    let res = true
    if (localHash !== currentHash) {
      res = await saveHashSnapshot(localHash ?? currentHash, '')
    }
    res && (await set(WEBSITE_VERSION_HASH, currentHash))
  } catch (e) {
    console.warn('init hash guard failed', e)
  }
}

export async function saveHashSnapshot(currentHash: string, previousHash: string | null): Promise<boolean> {
  const backupKey = `${BACKUP_KEY}${currentHash}`
  const createdAt = Date.now()

  const snapshot: Snapshot = {
    meta: {
      currentHash,
      previousHash,
      createdAt,
    },
    data: {
      dict: await get(SAVE_DICT_KEY.key),
      setting: await get(SAVE_SETTING_KEY.key),
      [PRACTICE_WORD_CACHE.key]: (await get(PRACTICE_WORD_CACHE.key)) ?? null,
      [PRACTICE_ARTICLE_CACHE.key]: (await get(PRACTICE_ARTICLE_CACHE.key)) ?? null,
    },
  }
  if (!snapshot.data.dict) {
    return false
  }
  await set(backupKey, snapshot)

  const rawIndex = (await get(BACKUP_INDEX_KEY)) as HashBackupIndexItem[] | undefined
  const index = Array.isArray(rawIndex)
    ? rawIndex.filter(item => item && typeof item.hash === 'string' && typeof item.key === 'string')
    : []

  let rIndex = index.findIndex(item => item.hash === currentHash)
  if (rIndex === -1) {
    index.push({ hash: currentHash, key: backupKey, createdAt })
  } else {
    index[rIndex] = { hash: currentHash, key: backupKey, createdAt }
  }

  if (index.length > 15) {
    index.sort((a, b) => a.createdAt - b.createdAt)
    const removed = index.splice(0, index.length - 10)
    for (const item of removed) {
      await del(item.key)
    }
  }
  await set(BACKUP_INDEX_KEY, index)
  return true
}

export function useDataSyncPersistence() {
  const store = useBaseStore()
  const settingStore = useSettingStore()

  async function pullAccountRemoteToLocal(account: AccountSync, scope: AccountSyncScope): Promise<boolean> {
    try {
      scope.assertCurrent()
      const data = await scope.read(ALL_SYNC_TYPES)
      scope.assertCurrent()
      if (
        data.length !== ALL_SYNC_TYPES.length ||
        ALL_SYNC_TYPES.some(type => data.filter(row => row.type === type).length !== 1)
      ) {
        throw new Error('远端账号数据不完整，不能完成首次拉取')
      }
      await applyRemoteDataBatch(data as RemoteDataRow[], store, settingStore, scope)
      scope.assertCurrent()
      account.completeInitialSync(scope)
      return true
    } catch (error) {
      // Do not unlock or update the legacy anonymous client's global status.
      scope.assertCurrent()
      throw error
    }
  }

  async function pullIfRemoteNewer(type: SyncDataType, client?: SupabaseClient | null): Promise<RemoteDataRow | null> {
    try {
      const sb = getSyncClient(client, true)
      if (!sb) return null
      const remoteMetas = await fetchServerMeta([type], sb)
      if (!remoteMetas) return null
      const remoteMetaMap = new Map(remoteMetas.map(item => [item.type, item]))
      const compareResult = await compareResultByType(type, remoteMetaMap)
      console.log('pullIfRemoteNewer-compareResult', CompareResult[compareResult], type)
      if (compareResult === CompareResult.RemoteNewer) {
        const remoteData = await fetchServerDatas([type], sb)
        if (remoteData?.length) {
          await applyRemoteDataByType(type, remoteData[0], store, settingStore)
          // Metadata alone cannot recover a failed payload read or local transaction.
          Supabase.setStatus('success')
          return remoteData[0]
        }
      }
      return null
    } catch (error) {
      Supabase.setStatus('error', error?.message ?? String(error))
      throw error
    }
  }

  // 同步数据，远程新则拉取（默认），本地新则推送（默认）
  async function syncData(
    localData: Partial<Record<SyncDataType, SaveData | null>>,
    options?: SaveLocalAndSyncOptions
  ) {
    try {
      const remoteMetas = await fetchServerMeta(Object.keys(localData) as any)
      if (!remoteMetas) return
      const remoteMetaMap = new Map(remoteMetas.map(item => [item.type, item]))
      let pull = []
      let push = []
      for (const type of Object.keys(localData)) {
        const compareResult = await compareResultByType(type as SyncDataType, remoteMetaMap)
        console.log('syncData-compareResult', CompareResult[compareResult], type)
        if (compareResult === CompareResult.RemoteNewer) {
          pull.push(type)
        }
        if ([CompareResult.LocalNewer, CompareResult.NoRemote].includes(compareResult)) {
          push.push(type)
        }
      }

      if (pull.length) {
        const rows = await fetchServerDatas(pull)
        if (!rows) return
        await applyRemoteDataBatch(rows, store, settingStore)
      }

      if (push.length && options?.pushWhenLocalNewer !== false) {
        let rows = []
        for (const type of push) {
          let item = localData[type]
          rows.push({ type, data: item.val, data_version: item.version, updated_at: item.updated_at })
        }
        await upsertServerDatas(rows)
      }

      if (Supabase.getStatus().status !== 'error') {
        Supabase.setStatus('success')
      }
    } catch (error) {
      Supabase.setStatus('error', error?.message ?? String(error))
    }
  }

  async function saveLocalAndSync(type: SyncDataType, data: unknown, options?: SaveLocalAndSyncOptions) {
    try {
      //先取出本地数据的meta值，以用后续与云端数据比较
      const localMeta = await getLocalPersistMeta(type)
      // console.log('saveLocalAndSync-localMeta', localMeta)
      //先保存，再同步
      const updated_at = new Date().toISOString()
      await persistLocalState(type, data, updated_at)

      const canSyncRemote = options?.canSyncRemote !== false
      if (!canSyncRemote) return
      const remoteMetas = await fetchServerMeta([type], options?.client)
      if (!remoteMetas) return
      const remoteMetaMap = new Map(remoteMetas.map(item => [item.type, item]))
      // console.log('saveLocalAndSync-remoteMetaMap', remoteMetaMap.get(type))
      const compareResult = await compareResultByType(type, remoteMetaMap, localMeta)
      console.log('saveLocalAndSync-compareResult', CompareResult[compareResult], type)
      //如果云端数据较新并允许拉取，则拉取云端数据，之后不再上传本地数据
      if (compareResult === CompareResult.RemoteNewer && options?.pullWhenRemoteNewer !== false) {
        const remoteData = await fetchServerDatas([type], options?.client)
        if (remoteData?.length) {
          await applyRemoteDataByType(type, remoteData[0], store, settingStore)
        }
        //防止后端数据为空，本地强制上传了
        return
      }
      const data_version = getDataVersion(type)
      await upsertServerDatas([{ type, data, data_version, updated_at }], options?.client)
    } finally {
      if (Supabase.getStatus()?.status !== 'error') {
        Supabase.setStatus('success')
      }
    }
  }

  async function getRemoteData(type: SyncDataType, client?: SupabaseClient | null): Promise<RemoteDataRow | null> {
    let sb: SupabaseClient | null
    try {
      sb = getSyncClient(client, true)
    } catch (error) {
      Supabase.setStatus('error', error?.message ?? String(error))
      throw new RemoteDataReadError()
    }
    if (!sb) {
      if (Supabase.getStatus().status === 'error') throw new RemoteDataReadError()
      return null
    }
    const rows = await fetchServerDatas([type], sb)
    const row = rows?.[0]
    if (!row) throw new RemoteDataReadError()
    try {
      // This read path historically treats an absent version as v1; batch imports remain strict.
      validateRemoteDataRow({ ...row, data_version: row.data_version ?? 1 })
      Supabase.setStatus('success')
      return row
    } catch (error) {
      Supabase.setStatus('error', error?.message ?? String(error))
      // A null result lets the caller migrate/save a local cache over the rejected remote data.
      throw error
    }
  }

  async function getRemoteMeta(type: SyncDataType, client?: SupabaseClient | null): Promise<RemoteMetaRow | null> {
    const rows = await fetchServerMeta([type], client)
    return rows?.[0] ?? null
  }

  async function forcePushLocalDataToRemote(
    data: BackupData['val'],
    client?: SupabaseClient | null,
    audio?: Array<{ id: string; file: Blob }>
  ): Promise<boolean> {
    let syncResult = true
    const updated_at = new Date().toISOString()
    const entries: [string, any][] = [
      [SAVE_DICT_KEY.key, JSON.stringify({ val: data.dict.val, version: SAVE_DICT_KEY.version, updated_at })],
      [SAVE_SETTING_KEY.key, JSON.stringify({ val: data.setting.val, version: SAVE_SETTING_KEY.version, updated_at })],
      [
        PRACTICE_WORD_CACHE.key,
        JSON.stringify({
          val: (data[PRACTICE_WORD_CACHE.key] as SaveData)?.val ?? null,
          version: PRACTICE_WORD_CACHE.version,
          updated_at,
        }),
      ],
      [
        PRACTICE_ARTICLE_CACHE.key,
        JSON.stringify({
          val: (data[PRACTICE_ARTICLE_CACHE.key] as SaveData)?.val ?? null,
          version: PRACTICE_ARTICLE_CACHE.version,
          updated_at,
        }),
      ],
    ]
    if (audio !== undefined) entries.push([LOCAL_FILE_KEY, audio])
    const previousDict = cloneImportState(store.$state)
    const previousSetting = cloneImportState(settingStore.$state)
    try {
      store.setState({ ...cloneImportState(data.dict.val), load: true, _ignoreWatch: true })
      settingStore.setState({ ...cloneImportState(data.setting.val), load: true, _ignoreWatch: true })
      await setMany(entries)
    } catch (error) {
      store.setState({ ...previousDict, _ignoreWatch: true })
      settingStore.$patch(state => {
        for (const key of Object.keys(state)) delete state[key]
        Object.assign(state, previousSetting, { _ignoreWatch: true })
      })
      await nextTick()
      // An explicit IndexedDB abort can reject with transaction.error === null.
      throw error ?? new Error('Local backup transaction failed')
    }
    await nextTick()
    // Local-only audio cannot be reconstructed by a remote JSON consumer.
    if (getDictSyncBlockReason(data.dict.val as BaseState)) return false
    const sb = getSyncClient(client)
    if (sb) {
      const rows: Array<{ type: SyncDataType; data: unknown; data_version: number; updated_at: string }> = [
        { type: SyncDataType.dict, data: data.dict.val, data_version: SAVE_DICT_KEY.version, updated_at },
        { type: SyncDataType.setting, data: data.setting.val, data_version: SAVE_SETTING_KEY.version, updated_at },
        {
          type: SyncDataType.practice_word,
          //@ts-ignore
          data: data?.[PRACTICE_WORD_CACHE.key]?.val ?? null,
          data_version: PRACTICE_WORD_CACHE.version,
          updated_at,
        },
        {
          type: SyncDataType.practice_article,
          //@ts-ignore
          data: data?.[PRACTICE_ARTICLE_CACHE.key]?.val ?? null,
          data_version: PRACTICE_ARTICLE_CACHE.version,
          updated_at,
        },
      ]
      try {
        const { error } = await (sb as any).from('typewords_data').upsert(rows, { onConflict: 'type' })
        if (error) {
          syncResult = false
          Supabase.setStatus('error', error?.message ?? String(error))
        }
      } catch (error) {
        syncResult = false
        Supabase.setStatus('error', error?.message ?? String(error))
      }
    } else {
      syncResult = false
    }
    return syncResult
  }

  async function pullAllRemoteToLocal(client?: SupabaseClient | null): Promise<boolean> {
    try {
      const sb = getSyncClient(client, true)
      if (!sb) return false
      const { data, error } = await (sb as any)
        .from('typewords_data')
        .select('type, data, updated_at, data_version')
        .in('type', ALL_SYNC_TYPES)
        .not('data_version', 'is', null)
      if (error) {
        Supabase.setStatus('error', error?.message ?? String(error))
        return false
      }
      if (
        !Array.isArray(data) ||
        !data.length ||
        data.some(row => !row || !ALL_SYNC_TYPES.includes(row.type)) ||
        new Set(data.map(row => row.type)).size !== data.length
      ) {
        throw new Error('远端没有可用的同步数据或返回数据不完整，请检查读取权限后重试')
      }
      const rows = data as RemoteDataRow[]
      await applyRemoteDataBatch(rows, store, settingStore)
      Supabase.setStatus('success')
      return true
    } catch (error) {
      Supabase.setStatus('error', error?.message ?? String(error))
      return false
    }
  }

  async function prepareDictState(
    state: BaseState = store.$state
  ): Promise<{ data: BaseState; canSyncRemote: boolean }> {
    const data = shakeCommonDict(state)
    const blockReason = getDictSyncBlockReason(state)
    const audioFileIdList: string[] = []
    if (blockReason) {
      const bookList = data.article.bookList.filter(v => v.custom || v.system)
      bookList.forEach(v => {
        v.articles
          .filter(s => !s.audioSrc && s.audioFileId)
          .forEach(a => {
            audioFileIdList.push(a.audioFileId)
          })
      })
    }

    if (blockReason) {
      const result: Array<{ id: string; file: Blob }> = []
      const fileList = (await get(LOCAL_FILE_KEY)) as Array<{ id: string; file: Blob }> | undefined
      const files = fileList ?? []
      audioFileIdList.forEach(id => {
        const item = files.find(file => file.id === id)
        item && result.push(item)
      })
      await set(LOCAL_FILE_KEY, result)
      if (Supabase.check()) {
        Supabase.setStatus('error', blockReason)
      }
      return { data, canSyncRemote: false }
    }

    return { data, canSyncRemote: true }
  }

  async function saveDictState(state: BaseState = store.$state, options?: SaveLocalAndSyncOptions) {
    const { data, canSyncRemote } = await prepareDictState(state)
    await saveLocalAndSync(SyncDataType.dict, data, { ...options, canSyncRemote })
  }

  async function getLocalCompactDataByType(type: SyncDataType) {
    if (type === SyncDataType.practice_word) return await getPracticeWordCacheLocal()
    if (type === SyncDataType.practice_article) return await getPracticeArticleCacheLocal()
    if (type === SyncDataType.dict) return shakeCommonDict(store.$state)
    if (type === SyncDataType.setting) return settingStore.$state
  }

  async function clear() {
    let d = getDefaultBaseState()
    d.load = true
    let d1 = getDefaultSettingState()
    d1.load = true
    let data: any = {
      dict: { val: d },
      setting: { val: d1 },
      [PRACTICE_WORD_CACHE.key]: null,
      [PRACTICE_ARTICLE_CACHE.key]: null,
      // @deprecated 大版本5废弃
      [APP_VERSION.key]: null,
    }
    return await forcePushLocalDataToRemote(data)
  }

  return {
    pullAccountRemoteToLocal: (account: AccountSync) => {
      if (!Supabase.isEnabled()) return Promise.reject(new Error('本地桌面版暂不提供云同步'))
      // Capture before joining the shared queue, not when the queued job starts.
      const scope = account.capture('read')
      return enqueuePersistence(() => pullAccountRemoteToLocal(account, scope))
    },
    pullIfRemoteNewer: (...args: Parameters<typeof pullIfRemoteNewer>) =>
      enqueuePersistence(() => pullIfRemoteNewer(...args)),
    saveLocalAndSync: (...args: Parameters<typeof saveLocalAndSync>) =>
      enqueuePersistence(() => saveLocalAndSync(...args), importGeneration),
    getRemoteData,
    getRemoteMeta,
    saveDictState: (...args: Parameters<typeof saveDictState>) =>
      enqueuePersistence(() => saveDictState(...args), importGeneration),
    forcePushLocalDataToRemote: (...args: Parameters<typeof forcePushLocalDataToRemote>) => {
      importGeneration++
      return enqueuePersistence(() => forcePushLocalDataToRemote(...args))
    },
    pullAllRemoteToLocal: (...args: Parameters<typeof pullAllRemoteToLocal>) =>
      enqueuePersistence(() => pullAllRemoteToLocal(...args)),
    getLocalCompactDataByType,
    syncData: (...args: Parameters<typeof syncData>) => enqueuePersistence(() => syncData(...args)),
    getDictSyncBlockReason,
    clear: () => {
      importGeneration++
      return enqueuePersistence(clear)
    },
  }
}
