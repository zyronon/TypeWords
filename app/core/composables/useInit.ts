import { APP_VERSION } from '../config/env'
import { debounce } from '../utils'
import type { BaseState, SettingState } from '../stores'
import { useBaseStore, useRuntimeStore, useSettingStore } from '../stores'
import { Supabase } from '../utils/supabase'
import { ensureHashGuardBeforeInit, useDataSyncPersistence } from './useDataSyncPersistence'
import { SyncDataType } from '../types'
import type { SubscriptionCallbackMutation } from 'pinia'
import { onUnmounted } from 'vue'

let unsub = null
let unsub2 = null

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
    console.timeEnd('init')
    initializing = false // 初始化完成，允许保存数据

    //等数据全部准备好，再开启监听，避免循环保存-同步
    document.addEventListener('visibilitychange', onvisibilitychange)
    //用 $subscribe 替代 watch
    unsub = store.$subscribe(
      debounce(async (mutation, data: BaseState) => {
        if (fetching || !focus || runtimeStore.globalLoading || restoreFetching) return
        if (data._ignoreWatch) {
          data._ignoreWatch = false
          return
        }
        if (mutation.type === 'direct' && mutation.events?.key === '_ignoreWatch') {
          return
        }
        console.log('store.$subscribe', mutation, data, data._ignoreWatch)
        fetching = true
        try {
          await dataSync.saveDictState(data)
        } finally {
          fetching = false
        }
      }, 1000)
    )

    unsub2 = settingStore.$subscribe(
      debounce(async (mutation: SubscriptionCallbackMutation<SettingState>, data: SettingState) => {
        if (fetching2 || !focus || runtimeStore.globalLoading || restoreFetching) return
        console.log('settingStore.$subscribe', mutation, data, data._ignoreWatch)
        if (data._ignoreWatch) {
          data._ignoreWatch = false
          return
        }
        if (mutation.type === 'direct' && mutation.events?.key === '_ignoreWatch') {
          return
        }
        fetching2 = true
        try {
          await dataSync.saveLocalAndSync(SyncDataType.setting, data)
        } finally {
          fetching2 = false
        }
      }, 1000)
    )

    runtimeStore.isNew = APP_VERSION.version > Number(settingStore.webAppVersion)
    // runtimeStore.isNew = true
    runtimeStore.isError = Supabase.getStatus().status === 'error'
    window.umami?.track('host', { host: window.location.host })
  }

  return init
}
