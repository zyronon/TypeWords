import { loadJsLib, shakeCommonDict } from '../utils'
import {
  APP_NAME,
  APP_VERSION,
  EXPORT_DATA_KEY,
  LIB_JS_URL,
  LOCAL_FILE_KEY,
  SAVE_DICT_KEY,
  SAVE_SETTING_KEY,
} from '../config/env'
import { get } from 'idb-keyval'
import saveAs from 'file-saver'
import dayjs from 'dayjs'
import { Toast } from '@typewords/base'
import { useBaseStore } from '../stores/base'
import { useSettingStore } from '../stores/setting'
import { ref } from 'vue'
import { PRACTICE_ARTICLE_CACHE, PRACTICE_WORD_CACHE } from '../utils/cache'
import { usePracticeArticlePersistence, usePracticeWordPersistence } from '../composables/usePracticePersistence.ts'
import type { BackupData } from '../types'

export function useExport() {
  const store = useBaseStore()
  const settingStore = useSettingStore()

  let loading = ref(false)

  async function getExportedData() {
    const wordPersistence = usePracticeWordPersistence()
    const articlePersistence = usePracticeArticlePersistence()

    let data: BackupData = {
      version: EXPORT_DATA_KEY.version,
      val: {
        setting: {
          version: SAVE_SETTING_KEY.version,
          val: settingStore.$state,
        },
        dict: {
          version: SAVE_DICT_KEY.version,
          val: shakeCommonDict(store.$state),
        },
        [PRACTICE_WORD_CACHE.key]: {
          version: PRACTICE_WORD_CACHE.version,
          val: {},
        },
        [PRACTICE_ARTICLE_CACHE.key]: {
          version: PRACTICE_ARTICLE_CACHE.version,
          val: {},
        },
      },
    }
    let d = await wordPersistence.getLocalDataCompact()
    if (d) {
      data.val[PRACTICE_WORD_CACHE.key].val = d
    }
    let d1 = await articlePersistence.getLocalDataCompact()
    if (d1) {
      data.val[PRACTICE_ARTICLE_CACHE.key].val = d1
    }
    return data
  }

  async function exportData(
    notice = '导出成功！',
    fileName = `${APP_NAME}-User-Data-${dayjs().format('YYYY-MM-DD HH-mm-ss')}.zip`
  ) {
    let disabled = localStorage.getItem('disable360')
    if (disabled) return Toast.success('已跳过导出')
    if (loading.value) return
    loading.value = true

    try {
      const JSZip = await loadJsLib('JSZip', LIB_JS_URL.JSZIP)

      const zip = new JSZip()
      zip.file('data.json', JSON.stringify(await getExportedData()))
      const mp3 = zip.folder('mp3')
      const allRecords = await get(LOCAL_FILE_KEY)
      for (const rec of allRecords ?? []) {
        mp3.file(rec.id + '.mp3', rec.file)
      }
      let content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, fileName)
      notice && Toast.success(notice)
      return content
    } catch (e: any) {
      Toast.error(e?.message || e || '导出失败')
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    exportData,
    getExportedData,
  }
}
