import {
  _getDictDataByUrl,
  checkAndUpgradeSaveDict,
  checkAndUpgradeSaveSetting,
  shakeCommonDict,
  shouldFetchRemote,
} from '../utils'
import {
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
import { del, get, set } from 'idb-keyval'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Toast } from '@/base'

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

function getSyncClient(client?: SupabaseClient | null): SupabaseClient | null {
  if (client) return client
  if (!Supabase.check()) return null
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

function applyDictData(store: ReturnType<typeof useBaseStore>, data: unknown) {
  store.setState(data as any)
  if (store.word.studyIndex >= 3) {
    if (!store.sdict.custom && !store.sdict.system && !store.sdict.words.length) {
      _getDictDataByUrl(store.sdict).then(r => {
        store.word.bookList[store.word.studyIndex] = r
      })
    }
  }
  if (store.article.studyIndex >= 1) {
    if (!store.sbook.custom && !store.sbook.system && !store.sbook.articles.length) {
      _getDictDataByUrl(store.sbook, DictType.article).then(r => {
        store.article.bookList[store.article.studyIndex] = r
      })
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
    return (data ?? []) as RemoteMetaRow[]
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
  if (!sb) return []
  console.log('Fetching server data list', types)
  try {
    const { data, error } = await sb
      .from('typewords_data')
      .select('type, data, updated_at, data_version')
      .in('type', types)
    if (error) {
      console.log('sp-error', error)
      Supabase.setStatus('error', error?.message ?? String(error))
      return []
    }
    return (data ?? []) as RemoteDataRow[]
  } catch (error) {
    console.log('sp-error', error)
    Supabase.setStatus('error', error?.message ?? String(error))
    return []
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
  const now = new Date().toISOString()
  if (type === SyncDataType.setting) {
    const normalized = await checkAndUpgradeSaveSetting({
      val: row.data,
      version: row.data_version,
    })
    normalized.load = true
    normalized._ignoreWatch = true
    settingStore.setState(normalized)
    await persistLocalState(SyncDataType.setting, normalized, row.updated_at ?? now)
    return
  }
  if (type === SyncDataType.dict) {
    const normalized = await checkAndUpgradeSaveDict({
      val: row.data,
      version: row.data_version,
    })
    normalized.load = true
    normalized._ignoreWatch = true
    applyDictData(store, normalized)
    await persistLocalState(SyncDataType.dict, normalized, row.updated_at ?? now)
    return
  }
  await persistLocalState(type, row.data, row.updated_at ?? now)
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

  async function pullIfRemoteNewer(type: SyncDataType, client?: SupabaseClient | null): Promise<RemoteDataRow | null> {
    const remoteMetas = await fetchServerMeta([type], client)
    if (!remoteMetas) return null
    const remoteMetaMap = new Map(remoteMetas.map(item => [item.type, item]))
    const compareResult = await compareResultByType(type, remoteMetaMap)
    console.log('pullIfRemoteNewer-compareResult', CompareResult[compareResult], type)
    if (compareResult === CompareResult.RemoteNewer) {
      const remoteData = await fetchServerDatas([type], client)
      if (remoteData?.length) {
        await applyRemoteDataByType(type, remoteData[0], store, settingStore)
        return remoteData[0]
      }
    }
    return null
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
        for (const item of rows) {
          await applyRemoteDataByType(item.type, item, store, settingStore)
        }
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
    const rows = await fetchServerDatas([type], client)
    return rows?.[0] ?? null
  }

  async function getRemoteMeta(type: SyncDataType, client?: SupabaseClient | null): Promise<RemoteMetaRow | null> {
    const rows = await fetchServerMeta([type], client)
    return rows?.[0] ?? null
  }

  async function forcePushLocalDataToRemote(data: BackupData['val'], client?: SupabaseClient | null): Promise<boolean> {
    let syncResult = true
    const updated_at = new Date().toISOString()
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
    await persistLocalState(SyncDataType.dict, data.dict.val, updated_at)
    await persistLocalState(SyncDataType.setting, data.setting.val, updated_at)
    //@ts-ignore
    await persistLocalState(SyncDataType.practice_word, data?.[PRACTICE_WORD_CACHE.key]?.val ?? null, updated_at)
    //@ts-ignore
    await persistLocalState(SyncDataType.practice_article, data?.[PRACTICE_ARTICLE_CACHE.key]?.val ?? null, updated_at)
    return syncResult
  }

  async function pullAllRemoteToLocal(client?: SupabaseClient | null): Promise<boolean> {
    const sb = getSyncClient(client)
    if (!sb) return false
    try {
      const { data, error } = await (sb as any)
        .from('typewords_data')
        .select('type, data, updated_at, data_version')
        .in('type', ALL_SYNC_TYPES)
        .not('data_version', 'is', null)
      if (error) {
        Supabase.setStatus('error', error?.message ?? String(error))
        return false
      }
      const rows = (data ?? []) as RemoteDataRow[]
      const map = new Map(rows.map(item => [item.type, item]))
      for (const type of ALL_SYNC_TYPES) {
        await applyRemoteDataByType(type, map.get(type) ?? null, store, settingStore)
      }
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
    store.setState(d)
    settingStore.setState(d1)
    return await forcePushLocalDataToRemote(data)
  }

  return {
    pullIfRemoteNewer,
    saveLocalAndSync,
    getRemoteData,
    getRemoteMeta,
    saveDictState,
    forcePushLocalDataToRemote,
    pullAllRemoteToLocal,
    getLocalCompactDataByType,
    syncData,
    getDictSyncBlockReason,
    clear,
  }
}
