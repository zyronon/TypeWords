import { useBaseStore } from '~/stores/base.ts'
import { useRuntimeStore } from '~/stores/runtime.ts'
import { useSettingStore } from '~/stores/setting.ts'
import { useUserStore } from '~/stores/user.ts'
import { syncSetting, syncDictList, getPracticeWordCacheApi, getPracticeArticleCacheApi } from '~/apis'
import { get, set } from 'idb-keyval'
import { AppEnv, DictId } from '~/config/env.ts'
import { shakeCommonDict } from '@/utils/index.ts'
import type { BaseState } from '@/stores/base.ts'
import { SAVE_DICT_KEY, LOCAL_FILE_KEY, SAVE_SETTING_KEY, APP_VERSION } from '@/config/env.ts'
import { PRACTICE_WORD_CACHE, PRACTICE_ARTICLE_CACHE } from '@/utils/cache.ts'

// 调用本地服务端存储 API（不依赖登录）
async function localGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/storage/${key}`)
    const json = await res.json()
    return json.success ? (json.data ?? null) : null
  } catch {
    return null
  }
}

function localSet(key: string, value: string | null): void {
  fetch(`/api/storage/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: value }),
  }).catch(() => {})
}

export function useInit() {
  const store = useBaseStore()
  const runtimeStore = useRuntimeStore()
  const settingStore = useSettingStore()
  const userStore = useUserStore()

  let lastAudioFileIdList = []
  let isInitializing = true // 标记是否正在初始化
  let dictSyncTimer: ReturnType<typeof setTimeout> | null = null
  let localDictSaveTimer: ReturnType<typeof setTimeout> | null = null

  watch(store.$state, (n: BaseState) => {
    console.log('store.$state', store.$state)
    // 如果正在初始化，不保存数据，避免覆盖
    if (isInitializing) return
    let data = shakeCommonDict(n)
    const payload = JSON.stringify({ val: data, version: SAVE_DICT_KEY.version })
    set(SAVE_DICT_KEY.key, payload)

    // 防抖保存词书数据到本地服务器（持久化，不受浏览器缓存影响）
    if (localDictSaveTimer) clearTimeout(localDictSaveTimer)
    localDictSaveTimer = setTimeout(() => {
      localSet(SAVE_DICT_KEY.key, payload)
    }, 1000)

    // 防抖推送词书数据到外部服务器（登录后）
    if (AppEnv.CAN_REQUEST) {
      if (dictSyncTimer) clearTimeout(dictSyncTimer)
      dictSyncTimer = setTimeout(() => {
        syncDictList(data)
      }, 2000)
    }

    //筛选自定义和收藏
    let bookList = data.article.bookList.filter(v => v.custom || [DictId.articleCollect].includes(v.id))
    let audioFileIdList = []
    bookList.forEach(v => {
      //筛选 audioFileId 字体有值的
      v.articles
        .filter(s => !s.audioSrc && s.audioFileId)
        .forEach(a => {
          //所有 id 存起来，下次直接判断字符串是否相等，因为这个watch会频繁调用
          audioFileIdList.push(a.audioFileId)
        })
    })
    if (audioFileIdList.toString() !== lastAudioFileIdList.toString()) {
      let result = []
      //删除未使用到的文件
      get(LOCAL_FILE_KEY).then((fileList: Array<{ id: string; file: Blob }>) => {
        if (fileList && fileList.length > 0) {
          audioFileIdList.forEach(a => {
            let item = fileList.find(b => b.id === a)
            item && result.push(item)
          })
          set(LOCAL_FILE_KEY, result)
          lastAudioFileIdList = audioFileIdList
        }
      })
    }
  })

  watch(
    () => settingStore.$state,
    n => {
      if (isInitializing) return
      const payload = JSON.stringify({ val: n, version: SAVE_SETTING_KEY.version })
      set(SAVE_SETTING_KEY.key, payload)
      // 保存设置到本地服务器
      localSet(SAVE_SETTING_KEY.key, payload)
      if (AppEnv.CAN_REQUEST) {
        syncSetting(null, settingStore.$state)
      }
    },
    { deep: true }
  )

  // 启动时从本地服务器恢复数据，写入 IndexedDB/localStorage，供 store.init() 读取
  async function hydrateFromLocalServer() {
    const [dictData, settingData, wordCacheData, articleCacheData] = await Promise.all([
      localGet(SAVE_DICT_KEY.key),
      localGet(SAVE_SETTING_KEY.key),
      localGet(PRACTICE_WORD_CACHE.key),
      localGet(PRACTICE_ARTICLE_CACHE.key),
    ])
    const writes: Promise<void>[] = []
    if (dictData) writes.push(set(SAVE_DICT_KEY.key, dictData))
    if (settingData) writes.push(set(SAVE_SETTING_KEY.key, settingData))
    if (wordCacheData) localStorage.setItem(PRACTICE_WORD_CACHE.key, wordCacheData)
    if (articleCacheData) localStorage.setItem(PRACTICE_ARTICLE_CACHE.key, articleCacheData)
    if (writes.length) await Promise.all(writes)
  }

  async function init() {
    console.log('init')
    isInitializing = true // 开始初始化

    // 并行执行：用户初始化 + 从本地服务器恢复数据
    await Promise.all([userStore.init(), hydrateFromLocalServer()])

    await store.init()
    await settingStore.init()
    store.load = true
    isInitializing = false // 初始化完成，允许保存数据

    // 登录后从外部服务器拉取练习缓存，覆盖本地数据（多设备同步）
    if (AppEnv.CAN_REQUEST) {
      const [wordRes, articleRes] = await Promise.allSettled([
        getPracticeWordCacheApi(),
        getPracticeArticleCacheApi(),
      ])
      if (wordRes.status === 'fulfilled' && wordRes.value.success && wordRes.value.data) {
        localStorage.setItem(PRACTICE_WORD_CACHE.key, JSON.stringify({
          version: PRACTICE_WORD_CACHE.version,
          val: wordRes.value.data,
        }))
      }
      if (articleRes.status === 'fulfilled' && articleRes.value.success && articleRes.value.data) {
        localStorage.setItem(PRACTICE_ARTICLE_CACHE.key, JSON.stringify({
          version: PRACTICE_ARTICLE_CACHE.version,
          val: articleRes.value.data,
        }))
      }
    }

    if (settingStore.first) {
      set(APP_VERSION.key, APP_VERSION.version)
    } else {
      get(APP_VERSION.key).then(r => {
        runtimeStore.isNew = r ? APP_VERSION.version > Number(r) : true
      })
    }
    window.umami?.track('host', { host: window.location.host })
  }

  return init
}
