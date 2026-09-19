import { APP_VERSION } from '../config/env'
import { debounce } from '../utils'
import type { BaseState, SettingState } from '../stores'
import { useBaseStore, useRuntimeStore, useSettingStore } from '../stores'
import { Supabase } from '../utils/supabase'
import { ensureHashGuardBeforeInit, useDataSyncPersistence } from './useDataSyncPersistence'
import { SyncDataType } from '../types'
import type { StateTree, SubscriptionCallback } from 'pinia'
import { onUnmounted } from 'vue'

let unsub = null
let unsub2 = null

function importAwareAutosave<S extends StateTree & { _ignoreWatch: boolean }>(save: (data: S) => Promise<void>) {
  let generation = 0
  let resetting = false
  const deferred = debounce((data: S, scheduledGeneration: number) => {
    if (scheduledGeneration === generation) return save(data)
  }, 1000)
  const callback: SubscriptionCallback<S> = (mutation, data) => {
    if (resetting) return
    if (data._ignoreWatch) {
      // Consume import/rollback suppression before a genuine edit can join the debounce window.
      generation++
      resetting = true
      try {
        data._ignoreWatch = false
      } finally {
        resetting = false
      }
      return
    }
    if (mutation.type === 'direct' && mutation.events?.key === '_ignoreWatch') return
    deferred(data, generation)
  }
  return { callback, cancel: () => generation++ }
}

export function useInit() {
  const store = useBaseStore()
  const settingStore = useSettingStore()
  const runtimeStore = useRuntimeStore()
  const dataSync = useDataSyncPersistence()
  let initializing = false // 标记是否正在初始化
  let focus = true
  let fetching = false
  let fetching2 = false
  let restoreFetching = false

  const onvisibilitychange = async () => {
    focus = !document.hidden
    if (focus) {
      try {
        //当激活时，要先获取数据，以保证本地是最新的，以免本地老数据上传到后端覆盖新数据
        if (restoreFetching) return
        restoreFetching = true
        await dataSync.syncData(
          { [SyncDataType.dict]: null, [SyncDataType.setting]: null },
          //只拉不推送
          { pushWhenLocalNewer: false }
        )
      } finally {
        restoreFetching = false
      }
    }
  }

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onvisibilitychange)
  })

  //init 有可能重复执行，因为从老网站导了数据之后需要 init
  async function init() {
    if (initializing) return
    initializing = true
    console.time('init')

    //先清理副作用，避免重复监听
    unsub?.()
    unsub2?.()
    document.removeEventListener('visibilitychange', onvisibilitychange)

    await ensureHashGuardBeforeInit()
    // await userStore.init()
    let dictData = await store.init()
    let settingData = await settingStore.init()
    if (dictData && settingData) {
      await dataSync.syncData({
        [SyncDataType.dict]: dictData,
        [SyncDataType.setting]: settingData,
      })
    }
    settingStore.load = true
    store.load = true
    // Imported records may contain this runtime-only flag; initial hydration has no subscribers.
    store._ignoreWatch = false
    settingStore._ignoreWatch = false
    console.timeEnd('init')
    initializing = false // 初始化完成，允许保存数据

    //等数据全部准备好，再开启监听，避免循环保存-同步
    document.addEventListener('visibilitychange', onvisibilitychange)
    //用 $subscribe 替代 watch
    const dictAutosave = importAwareAutosave(async (data: BaseState) => {
      if (fetching || !focus || runtimeStore.globalLoading || restoreFetching) return
      fetching = true
      try {
        await dataSync.saveDictState(data)
      } finally {
        fetching = false
      }
    })
    const stopDict = store.$subscribe(dictAutosave.callback, { flush: 'sync' })
    unsub = () => {
      dictAutosave.cancel()
      stopDict()
    }

    const settingAutosave = importAwareAutosave(async (data: SettingState) => {
      if (fetching2 || !focus || runtimeStore.globalLoading || restoreFetching) return
      fetching2 = true
      try {
        await dataSync.saveLocalAndSync(SyncDataType.setting, data)
      } finally {
        fetching2 = false
      }
    })
    const stopSetting = settingStore.$subscribe(settingAutosave.callback, { flush: 'sync' })
    unsub2 = () => {
      settingAutosave.cancel()
      stopSetting()
    }

    runtimeStore.isNew = APP_VERSION.version > Number(settingStore.webAppVersion)
    // runtimeStore.isNew = true
    runtimeStore.isError = Supabase.getStatus().status === 'error'
    window.umami?.track('host', { host: window.location.host })
  }

  return init
}
