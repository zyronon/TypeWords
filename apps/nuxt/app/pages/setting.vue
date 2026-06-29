<script setup lang="ts">
import { defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { getDefaultSettingState, useSettingStore } from '@typewords/core/stores/setting'
import { getShortcutKey, useEventListener } from '@typewords/core/hooks/event'
import {
  checkAndUpgradeSaveDict,
  checkAndUpgradeSaveSetting,
  cloneDeep,
  isEmpty,
  loadJsLib,
} from '@typewords/core/utils'
import {
  BaseButton,
  BaseInput,
  BasePage,
  Form,
  FormItem,
  type FormType,
  PopConfirm,
  Toast,
  UploadButton,
} from '@typewords/base'
import { getDefaultBaseState, useBaseStore } from '@typewords/core/stores/base'
import {
  APP_NAME,
  APP_VERSION,
  BACKUP_INDEX_KEY,
  DefaultShortcutKeyMap,
  DictId,
  LIB_JS_URL,
  LOCAL_FILE_KEY,
  Old_Host,
  Origin,
} from '@typewords/core/config/env'
import { get, set } from 'idb-keyval'
import { useRuntimeStore } from '@typewords/core/stores/runtime'
import { useExport } from '@typewords/core/hooks/export'
import MigrateDialog from '@typewords/core/components/dialog/MigrateDialog.vue'
import Log from '@typewords/core/components/setting/Log.vue'
import About from '@typewords/core/components/About.vue'
import CommonSetting from '@typewords/core/components/setting/CommonSetting.vue'
import FsrsSetting from '@typewords/core/components/setting/FsrsSetting.vue'
import ArticleSetting from '@typewords/core/components/setting/ArticleSetting.vue'
import WordSetting from '@typewords/core/components/setting/WordSetting.vue'
import SoundSetting from '@typewords/core/components/setting/SoundSetting.vue'
import { PRACTICE_ARTICLE_CACHE, PRACTICE_WORD_CACHE } from '@typewords/core/utils/cache'
import { useDataSyncPersistence } from '@typewords/core/composables/useDataSyncPersistence'
import SettingItem from '@typewords/core/components/setting/SettingItem.vue'
import { Supabase } from '@typewords/core/utils/supabase.ts'
import BackupGateDialog from '@typewords/core/components/dialog/BackupGateDialog.vue'

import { createClient } from '@supabase/supabase-js'
import { useRoute } from 'vue-router'
import type { BackupData, Snapshot } from '@typewords/core'

const Dialog = defineAsyncComponent(() => import('@typewords/base/Dialog'))

type HistoryBackupIndexItem = {
  hash: string
  key: string
  createdAt: number
}

type HistoryBackupMeta = HistoryBackupIndexItem & {
  previousHash?: string | null
}

let route = useRoute()
const { t } = useI18n()
let title = APP_NAME + t('setting_page_title_suffix')
useSeoMeta({
  title: title,
  description: title,
  ogTitle: title,
  ogDescription: title,
  ogUrl: Origin + route.fullPath,
  twitterTitle: title,
  twitterDescription: title,
})

const tabIndex = $ref(Number(route?.query?.index ?? 0))
const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const store = useBaseStore()
const dataSyncPersistence = useDataSyncPersistence()

const config = useRuntimeConfig()
const gitLastCommitHash = ref(config?.public?.latestCommitHash)
const gitLastCommitTime = ref(config?.public?.latestCommitTime)

let editShortcutKey = $ref('')

const disabledDefaultKeyboardEvent = $computed(() => {
  return editShortcutKey && tabIndex === 7
})

// 监听编辑快捷键状态变化，自动聚焦输入框
watch(
  () => editShortcutKey,
  newVal => {
    if (newVal) {
      // 使用nextTick确保DOM已更新
      nextTick(() => {
        focusShortcutInput()
      })
    }
  }
)

useEventListener('keydown', (e: KeyboardEvent) => {
  if (!disabledDefaultKeyboardEvent) return

  // 确保阻止浏览器默认行为
  e.preventDefault()
  e.stopPropagation()

  let shortcutKey = getShortcutKey(e)

  // console.log('e', e, e.keyCode, e.ctrlKey, e.altKey, e.shiftKey)
  // console.log('key', shortcutKey)

  // if (shortcutKey[shortcutKey.length-1] === '+') {
  //   settingStore.shortcutKeyMap[editShortcutKey] = DefaultShortcutKeyMap[editShortcutKey]
  //   return ElMessage.warning('设备失败！')
  // }

  if (editShortcutKey) {
    if (shortcutKey === 'Delete') {
      settingStore.shortcutKeyMap[editShortcutKey] = ''
    } else {
      // 忽略单独的修饰键
      if (
        shortcutKey === 'Ctrl+' ||
        shortcutKey === 'Alt+' ||
        shortcutKey === 'Shift+' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Shift'
      ) {
        return
      }

      for (const [k, v] of Object.entries(settingStore.shortcutKeyMap)) {
        if (v === shortcutKey && k !== editShortcutKey) {
          settingStore.shortcutKeyMap[editShortcutKey] = DefaultShortcutKeyMap[editShortcutKey]
          return Toast.warning(t('shortcut_key_duplicate'))
        }
      }
      settingStore.shortcutKeyMap[editShortcutKey] = shortcutKey
    }
  }
})

function handleInputBlur() {
  // 输入框失焦时结束编辑状态
  editShortcutKey = ''
}

function focusShortcutInput() {
  // 找到当前正在编辑的快捷键输入框
  const inputElements = document.querySelectorAll('.set-key input')
  if (inputElements && inputElements.length > 0) {
    // 聚焦第一个找到的输入框
    const inputElement = inputElements[0] as HTMLInputElement
    inputElement.focus()
  }
}

// 快捷键中文名称映射
function getShortcutKeyName(key: string): string {
  const shortcutKeyNameMap: Record<string, string> = {
    ShowWord: t('shortcut_show_word'),
    EditArticle: t('shortcut_edit_article'),
    Next: t('shortcut_next'),
    Previous: t('shortcut_previous'),
    Ignore: t('shortcut_ignore'),
    ToggleSimple: t('shortcut_toggle_simple'),
    ToggleCollect: t('shortcut_toggle_collect'),
    NextChapter: t('shortcut_next_chapter'),
    PreviousChapter: t('shortcut_previous_chapter'),
    NextStep: t('shortcut_next_step'),
    RepeatChapter: t('shortcut_repeat_chapter'),
    DictationChapter: t('shortcut_dictation_chapter'),
    PlayWordPronunciation: t('shortcut_play_word_pronunciation'),
    ToggleShowTranslate: t('shortcut_toggle_show_translate'),
    ToggleDictation: t('shortcut_toggle_dictation'),
    ToggleTheme: t('shortcut_toggle_theme'),
    ToggleConciseMode: t('shortcut_toggle_concise_mode'),
    ToggleToolbar: t('shortcut_toggle_toolbar'),
    TogglePanel: t('shortcut_toggle_panel'),
    RandomWrite: t('shortcut_random_write'),
    KnowWord: t('shortcut_know_word'),
    UnknownWord: t('shortcut_unknown_word'),
    MasteredWord: t('shortcut_mastered_word'),
    ChooseA: t('shortcut_choose_a'),
    ChooseB: t('shortcut_choose_b'),
    ChooseC: t('shortcut_choose_c'),
    ChooseD: t('shortcut_choose_d'),
    PlaySentence1: t('shortcut_play_sentence_1'),
    PlaySentence2: t('shortcut_play_sentence_2'),
    PlaySentence3: t('shortcut_play_sentence_3'),
    PlaySentence4: t('shortcut_play_sentence_4'),
    PlaySentence5: t('shortcut_play_sentence_5'),
    PlaySentence6: t('shortcut_play_sentence_6'),
    PlaySentence7: t('shortcut_play_sentence_7'),
    PlaySentence8: t('shortcut_play_sentence_8'),
    PlaySentence9: t('shortcut_play_sentence_9'),
  }

  return shortcutKeyNameMap[key] || key
}

function resetShortcutKeyMap() {
  editShortcutKey = ''
  settingStore.shortcutKeyMap = cloneDeep(DefaultShortcutKeyMap)
  Toast.success(t('restore_success'))
}

let importLoading = $ref(false)
let configLoading = $ref(false)

const { loading: exportLoading, exportData, getExportedData } = useExport()

async function importJson(str: string) {
  importLoading = true
  let obj: BackupData = {
    version: -1,
    val: {
      setting: {},
      dict: {},
      [PRACTICE_WORD_CACHE.key]: null,
      [PRACTICE_ARTICLE_CACHE.key]: null,
      // @deprecated 大版本5废弃
      [APP_VERSION.key]: null,
    },
  }
  try {
    debugger
    obj = JSON.parse(str)
    let data = obj.val
    data.dict.val = await checkAndUpgradeSaveDict(data.dict)
    data.setting.val = await checkAndUpgradeSaveSetting(data.setting)
    //老版本兼容逻辑
    if (obj.version === 4) {
      if (!isEmpty(data?.[APP_VERSION.key])) {
        data.setting.val.webAppVersion = data?.[APP_VERSION.key]
      }
    }
    //需在调同步方法前面，同步方法可能报错
    let hasRemote = Supabase.check()
    runtimeStore.globalLoading = true
    const pushOk = await dataSyncPersistence.forcePushLocalDataToRemote(data)
    runtimeStore.globalLoading = false
    if (pushOk) {
      Toast.success(t('import_success_overwrite_remote'))
    } else {
      Toast.success(hasRemote ? t('import_success_push_failed') : t('import_success'))
    }
    runtimeStore.isNew = APP_VERSION.version > Number(data.setting?.val?.webAppVersion ?? APP_VERSION.version)
    data.setting.val.load = true
    settingStore.setState(data.setting.val)
    data.dict.val.load = true
    store.setState(data.dict.val)
    showBackupGate = false
  } catch (err) {
    return Toast.error(t('import_failed'))
  } finally {
    importLoading = false
  }
}

async function importData(e) {
  importLoading = true
  let file = e.target.files[0]
  if (!file) return (importLoading = false)
  if (file.name.endsWith('.json')) {
    let reader = new FileReader()
    reader.onload = function (v) {
      let str: any = v.target.result
      if (str) {
        importJson(str)
      }
    }
    reader.readAsText(file)
  } else if (file.name.endsWith('.zip')) {
    try {
      const JSZip = await loadJsLib('JSZip', LIB_JS_URL.JSZIP)
      const zip = await JSZip.loadAsync(file)

      const dataFile = zip.file('data.json')
      if (!dataFile) {
        return Toast.error(t('missing_data_json'))
      }

      const mp3Folder = zip.folder('mp3')
      if (mp3Folder) {
        const records: { id: string; file: Blob }[] = []
        for (const filename in zip.files) {
          if (filename.startsWith('mp3/') && filename.endsWith('.mp3')) {
            const entry = zip.file(filename)
            if (!entry) continue
            const blob = await entry.async('blob')
            const id = filename.replace(/^mp3\//, '').replace(/\.mp3$/, '')
            records.push({ id, file: blob })
          }
        }
        await set(LOCAL_FILE_KEY, records)
      }

      const str = await dataFile.async('string')
      await importJson(str)
    } catch (e) {
      Toast.error(e?.message || e || t('import_failed'))
    } finally {
      importLoading = false
    }
  } else {
    Toast.error(t('unsupported_file_type'))
  }
  importLoading = false
}

let isNewHost = $ref(false)
let showTransfer = $ref(false)
let showBackupGate = $ref(false)
let showHistoryDialog = $ref(false)
let pendingNextAction = $ref<'import' | 'supabase_save' | 'restore_history' | 'transfer' | ''>('')
let historyBackups = $ref<HistoryBackupMeta[]>([])
let restoreTarget = $ref<HistoryBackupMeta | null>(null)
let restoreLoading = $ref(false)
let showSbFirstSyncChoiceDialog = $ref(false)
let sbSyncChoiceLoading = $ref(false)

function openGate(type) {
  pendingNextAction = type
  showBackupGate = true
}

async function openHistoryDialog() {
  const raw = (await get(BACKUP_INDEX_KEY)) as HistoryBackupIndexItem[] | undefined
  const index = Array.isArray(raw)
    ? raw.filter(item => item && typeof item.hash === 'string' && typeof item.key === 'string')
    : []
  const items: HistoryBackupMeta[] = []
  for (const item of index) {
    const snapshot = (await get(item.key)) as { meta?: { previousHash?: string | null } } | undefined
    items.push({
      ...item,
      previousHash: snapshot?.meta?.previousHash ?? null,
    })
  }
  historyBackups = items.sort((a, b) => b.createdAt - a.createdAt)
  showHistoryDialog = true
}

function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function openHistoryRestoreGate(item: HistoryBackupMeta) {
  restoreTarget = item
  openGate('restore_history')
}

function openSupabaseSaveGate() {
  sbFormRef?.validate(valid => {
    if (!valid) return
    openGate('supabase_save')
  })
}

async function restoreHistoryData() {
  if (!restoreTarget) return
  if (restoreLoading) return
  restoreLoading = true
  try {
    const { data: val }: Snapshot = await get(restoreTarget.key)
    debugger
    let data: BackupData['val'] = {
      setting: JSON.parse(val.setting),
      dict: JSON.parse(val.dict),
      [PRACTICE_WORD_CACHE.key]: JSON.parse(val[PRACTICE_WORD_CACHE.key]),
      [PRACTICE_ARTICLE_CACHE.key]: JSON.parse(val[PRACTICE_ARTICLE_CACHE.key]),
    }
    data.dict.val = await checkAndUpgradeSaveDict(data.dict)
    data.setting.val = await checkAndUpgradeSaveSetting(data.setting)

    //需在调同步方法前面，同步方法可能报错
    let hasRemote = Supabase.check()
    runtimeStore.globalLoading = true
    const pushOk = await dataSyncPersistence.forcePushLocalDataToRemote(data)
    runtimeStore.globalLoading = false
    if (pushOk) {
      Toast.success(t('history_restore_success_overwrite_remote'))
    } else {
      Toast.success(hasRemote ? t('history_restore_success_push_failed') : t('restore_success_short'))
    }
    runtimeStore.isNew = APP_VERSION.version > Number(data.setting?.val?.webAppVersion ?? APP_VERSION.version)
    data.setting.val.load = true
    settingStore.setState(data.setting.val)
    data.dict.val.load = true
    store.setState(data.dict.val)
    showBackupGate = false
    showHistoryDialog = false
  } catch (error) {
    Toast.error(t('restore_failed') + ((error as Error)?.message ?? String(error)))
  } finally {
    restoreLoading = false
  }
}

let tempSbInstance = null

async function onSbFirstSyncChoice(action: 'push_local' | 'pull_remote') {
  if (sbSyncChoiceLoading) return
  sbSyncChoiceLoading = true
  try {
    if (action === 'push_local') {
      let localData = await getExportedData()
      const ok = await dataSyncPersistence.forcePushLocalDataToRemote(localData.val, tempSbInstance)
      if (!ok) throw new Error(t('push_local_failed'))
      Toast.success(t('push_local_success'))
    } else {
      const ok = await dataSyncPersistence.pullAllRemoteToLocal(tempSbInstance)
      if (!ok) throw new Error(t('pull_remote_failed'))
      Toast.success(t('pull_remote_success'))
    }
    Supabase.setStatus('success')
    sbStatus = Supabase.getStatus()
    Supabase.saveConfig(sbForm?.url, sbForm?.key)
    showSbFirstSyncChoiceDialog = false
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error)
    Supabase.setStatus('error', msg)
    sbStatus = Supabase.getStatus()
    Toast.error(t('sync_error_with_msg') + msg)
  } finally {
    sbSyncChoiceLoading = false
  }
}

onMounted(() => {
  isNewHost = window.location.host !== Old_Host
})

function transferOk() {
  setTimeout(() => {
    window.location.href = '/words'
  }, 1500)
}

async function clearAllData() {
  await dataSyncPersistence.clear()
  Supabase.removeConfig()
  sbForm.url = ''
  sbForm.key = ''
  sbStatus = { status: 'idle', statusMessage: undefined }
  Toast.success(t('clear_success'))
}

let sbFormRef = $ref<FormType>()
const initialSbConfig = Supabase.getConfig()
let sbForm = $ref({
  url: initialSbConfig?.url ?? '',
  key: initialSbConfig?.key ?? '',
})
let sbStatus = $ref(Supabase.getStatus())
watch(
  () => tabIndex,
  () => {
    if (tabIndex === 5) sbStatus = Supabase.getStatus()
  }
)

let sbFormRules = {
  url: [{ required: true, message: t('supabase_url_required'), trigger: 'blur' }],
  key: [{ required: true, message: t('supabase_key_required'), trigger: 'blur' }],
}

//能否使用同步数据功能,如果有自定义的文章里面有音频，则不可以
const canSyncToServe = $computed(() => {
  //筛选自定义和收藏
  let bookList = store.article.bookList.filter(v => v.custom || [DictId.articleCollect].includes(v.id))
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
  return audioFileIdList.length === 0
})

async function doSaveSbConfig() {
  if (configLoading) return
  showBackupGate = false
  configLoading = true
  tempSbInstance = createClient(sbForm?.url, sbForm?.key)
  try {
    // 检测 typewords_data 表是否存在
    const { data: existingData, error: checkError } = await tempSbInstance.from('typewords_data').select('type')
    if (checkError) {
      Supabase.setStatus('error', checkError?.message ?? t('table_not_exist'))
      sbStatus = Supabase.getStatus()
      Toast.error(t('table_not_exist'))
    } else {
      // 表已存在，检测是否需要插入默认数据
      const rows = (existingData ?? []) as { type: string }[]
      const existingTypes = rows.map(d => d.type)
      const defaultData = [
        { type: 'dict', data: {} },
        { type: 'setting', data: {} },
        { type: 'practice_word', data: {} },
        { type: 'practice_article', data: {} },
      ]
      for (const item of defaultData) {
        if (!existingTypes.includes(item.type)) {
          await (tempSbInstance as any).from('typewords_data').insert(item)
        }
      }
      const { data: hasVersionData, error: versionError } = await (tempSbInstance as any)
        .from('typewords_data')
        .select('type, data_version')
        .in('type', ['dict', 'setting', 'practice_word', 'practice_article'])
        .not('data_version', 'is', null)
      if (versionError) {
        throw new Error(versionError?.message ?? String(versionError))
      }
      const hasRemoteVersionData = Array.isArray(hasVersionData) && hasVersionData.length > 0

      if (hasRemoteVersionData) {
        showSbFirstSyncChoiceDialog = true
      } else {
        Supabase.setStatus('success')
        sbStatus = Supabase.getStatus()
        await onSbFirstSyncChoice('push_local')
        Toast.success(t('save_success'))
        Supabase.saveConfig(sbForm?.url, sbForm?.key)
        transferOk()
      }
    }
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error)
    Supabase.setStatus('error', msg)
    sbStatus = Supabase.getStatus()
    Toast.error(t('error_occurred') + msg)
  } finally {
    configLoading = false
  }
}

function removeSbConfig() {
  sbFormRef?.validate(async valid => {
    if (valid) {
      Supabase.removeConfig()
      sbForm.url = ''
      sbForm.key = ''
      sbStatus = { status: 'idle', statusMessage: undefined }
      Toast.success(t('clear_success'))
      setTimeout(() => {
        location.href = '/words'
      }, 1000)
    }
  })
}

function disable360(){
  localStorage.setItem('disable360',1)
  Toast.success('已设置')
}
</script>

<template>
  <BasePage>
    <div class="setting text-md card flex flex-col" style="height: calc(100vh - 3rem)">
      <div class="page-title text-align-center">{{ $t('setting') }}</div>
      <div class="flex flex-1 overflow-hidden gap-4">
        <div class="left">
          <div class="tabs">
            <div class="tab" :class="tabIndex === 0 && 'active'" @click="tabIndex = 0">
              <IconFluentSettings20Regular />
              <span>{{ $t('general_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 1 && 'active'" @click="tabIndex = 1">
              <IconFluentBot20Regular />
              <span>{{ $t('fsrs_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 2 && 'active'" @click="tabIndex = 2">
              <IconFluentTextUnderlineDouble20Regular />
              <span>{{ $t('word_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 3 && 'active'" @click="tabIndex = 3">
              <IconFluentBookLetter20Regular />
              <span>{{ $t('article_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 4 && 'active'" @click="tabIndex = 4">
              <IconClarityVolumeUpLine />
              <span>{{ $t('sound_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 5 && 'active'" @click="tabIndex = 5">
              <IconFluentDatabasePerson20Regular />
              <span>{{ $t('data_management') }}</span>
            </div>

            <div class="tab" :class="tabIndex === 6 && 'active'" @click="tabIndex = 6">
              <IconFluentCloudSync20Regular />
              <span>{{ $t('data_sync') }}</span>
              <div class="red-point" v-if="runtimeStore.isError"></div>
            </div>
            <div class="tab" :class="tabIndex === 7 && 'active'" @click="tabIndex = 7">
              <IconFluentKeyboardLayoutFloat20Regular />
              <span>{{ $t('shortcut_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 8 && 'active'" @click="tabIndex = 8">
              <IconFluentTextBulletListSquare20Regular />
              <span>{{ $t('update_log') }}</span>
              <!--              <div class="red-point" v-if="runtimeStore.isNew"></div>-->
            </div>
            <div class="tab" :class="tabIndex === 9 && 'active'" @click="tabIndex = 9">
              <IconFluentPerson20Regular />
              <span>{{ $t('about') }}</span>
            </div>
          </div>
        </div>
        <div class="col-line"></div>
        <div class="flex-1 overflow-y-auto overflow-x-hidden pr-4 content">
          <CommonSetting v-if="tabIndex === 0" />
          <FsrsSetting v-if="tabIndex === 1" />
          <WordSetting v-if="tabIndex === 2" />
          <ArticleSetting v-if="tabIndex === 3" />
          <SoundSetting v-if="tabIndex === 4" />

          <div v-if="tabIndex === 5">
            <!--            导出数据-->
            <SettingItem
              :title="$t('export_data_title')"
              :desc="$t('data_saved_locally') + $t('export_data_desc_suffix', { appName: APP_NAME })"
            >
              <BaseButton size="large"  :loading="exportLoading" @click="exportData()">{{ $t('export_data_backup') }}</BaseButton>
            </SettingItem>
            <div class="text-gray text-sm">💾 {{ $t('export_zip_hint') }}</div>
            <div class="line my-3"></div>

            <!--            导入数据-->
            <SettingItem :title="$t('import_data_title')">
              <BaseButton size="large"  @click="openGate('import')" :loading="importLoading">{{
                $t('import_data_restore')
              }}</BaseButton>
            </SettingItem>
            <i18n-t keypath="import_overwrite_warning" tag="span">
              <strong class="color-red">{{ $t('complete_overflow') }}</strong>
            </i18n-t>
            <!--            新网站同步-->
            <template v-if="isNewHost">
              <div class="line my-3"></div>
              <SettingItem :title="$t('migrate_2study_title')">
                <BaseButton size="large"  @click="openGate('transfer')">{{ $t('migrate_btn') }}</BaseButton>
              </SettingItem>
              <i18n-t keypath="migrate_overwrite_warning" tag="span">
                <strong class="color-red">{{ $t('complete_overflow') }}</strong>
              </i18n-t>
            </template>

            <div class="line my-3"></div>
            <SettingItem :title="$t('other')"> </SettingItem>
            <div class="flex gap-space">
              <BaseButton size="large"  @click="openHistoryDialog">{{ $t('history_data') }}</BaseButton>
              <PopConfirm :title="$t('clear_all_data_confirm')" @confirm="clearAllData">
                <BaseButton size="large" >{{ $t('clear_all_data') }}</BaseButton>
              </PopConfirm>
              <BaseButton size="large" type="info" @click="disable360" keyboard="不要乱点，点击后会使导出功能失效，仅适用于： Mac 版本 360 极速浏览器">跳过导出</BaseButton>
            </div>
          </div>

          <div v-if="tabIndex === 6">
            <p class="text-red font-bold">过时功能：由于经常同步失败，不再推荐继续使用，请等待官方同步功能</p>
            <!--          Supabase 设置  -->
            <SettingItem :title="$t('supabase_config')" :desc="$t('supabase_config_desc')">
              <div v-if="sbStatus.status !== 'idle'" class="mt-2 text-sm">
                <span v-if="sbStatus.status === 'success'" class="text-green">{{ $t('sync_status_running') }}</span>
                <span v-else-if="sbStatus.status === 'error'" class="text-red">
                  {{ $t('sync_status_failed') }}{{ sbStatus.statusMessage ? `（${sbStatus.statusMessage}）` : '' }}
                </span>
                <span v-else-if="sbStatus.status === 'syncing'">{{ $t('sync_status_syncing') }}</span>
              </div>
            </SettingItem>

            <div class="mb-6">
              <div>
                {{ $t('supabase_website') }}
                <a href="https://supabase.com/" target="_blank">https://supabase.com/</a>
              </div>
              <div>
                {{ $t('supabase_tutorial') }}
                <a href="https://www.kdocs.cn/l/cduLx52XXXgw" target="_blank">https://www.kdocs.cn/l/cduLx52XXXgw</a>
              </div>
              <div>
                {{ $t('supabase_intro', { appName: APP_NAME }) }}
              </div>
            </div>

            <div class="relative">
              <Form ref="sbFormRef" :rules="sbFormRules" :model="sbForm">
                <FormItem label="Url" prop="url">
                  <BaseInput v-model="sbForm.url" />
                </FormItem>
                <FormItem label="Key" prop="key">
                  <BaseInput v-model="sbForm.key" />
                </FormItem>
              </Form>
              <div class="flex justify-end">
                <BaseButton size="large"  @click="removeSbConfig" :disabled="!canSyncToServe">{{ $t('delete_config') }}</BaseButton>
                <BaseButton size="large"  @click="openSupabaseSaveGate" :loading="configLoading" :disabled="!canSyncToServe">{{
                  runtimeStore.isError ? $t('retry') : $t('save_config')
                }}</BaseButton>
              </div>
              <div
                class="absolute top-0 left-0 w-full h-full bg-white opacity-80 cursor-not-allowed z-10 center rounded-md"
                v-if="!canSyncToServe"
              >
                <div class="text-red">{{ $t('custom_audio_sync_disabled') }}</div>
              </div>
            </div>
          </div>

          <div class="body" v-if="tabIndex === 7">
            <div class="row">
              <label class="main-title">{{ $t('function') }}</label>
              <div class="wrapper">{{ $t('shortcut_key') }}</div>
            </div>
            <div class="scroll">
              <div class="row" v-for="item of Object.entries(settingStore.shortcutKeyMap)">
                <label class="item-title">{{ getShortcutKeyName(item[0]) }}</label>
                <div class="wrapper" @click="editShortcutKey = item[0]">
                  <div class="set-key" v-if="editShortcutKey === item[0]">
                    <input
                      ref="shortcutInput"
                      :value="item[1] ? item[1] : $t('no_shortcut_set')"
                      readonly
                      type="text"
                      @blur="handleInputBlur"
                    />
                    <span @click.stop="editShortcutKey = ''"
                      >{{ $t('press_key_to_set') }}，<span class="text-red!">{{
                        $t('click_here_when_done')
                      }}</span></span
                    >
                  </div>
                  <div v-else>
                    <div v-if="item[1]">{{ item[1] }}</div>
                    <span v-else>{{ $t('no_shortcut_set') }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="row">
              <label class="item-title"></label>
              <div class="wrapper">
                <BaseButton size="large"  @click="resetShortcutKeyMap">{{ $t('restore_default') }}</BaseButton>
              </div>
            </div>
          </div>

          <!--          日志-->
          <Log v-if="tabIndex === 8" />

          <div v-if="tabIndex === 9" class="center flex-col">
            <About />
            <div class="text-md color-gray mt-10">Build {{ gitLastCommitHash }} {{ gitLastCommitTime }}</div>
          </div>
        </div>
      </div>
    </div>
  </BasePage>

  <BackupGateDialog v-model="showBackupGate">
    <template v-slot="{ disabled }">
      <BaseButton size="large"  @click="doSaveSbConfig" :disabled="disabled" v-if="pendingNextAction === 'supabase_save'">{{
        runtimeStore.isError ? $t('retry') : $t('save_config')
      }}</BaseButton>
      <BaseButton size="large"  @click="showTransfer = true" :disabled="disabled" v-else-if="pendingNextAction === 'transfer'">{{
        $t('migrate_btn')
      }}</BaseButton>
      <BaseButton size="large"
        v-else-if="pendingNextAction === 'restore_history'"
        @click="restoreHistoryData"
        :disabled="disabled"
        :loading="restoreLoading"
      >
        {{ $t('restore_history_data') }}
      </BaseButton>

      <UploadButton
        @change="importData"
        :disabled="disabled"
        :loading="importLoading"
        accept="application/json,.zip,application/zip"
        v-else
      >
        {{ $t('import_data_restore') }}
      </UploadButton>
    </template>
  </BackupGateDialog>

  <Dialog v-model="showHistoryDialog" :title="$t('history_data_dialog_title')">
    <div class="p-4 w-120 max-h-100 overflow-auto">
      <div v-if="!historyBackups.length" class="color-gray">{{ $t('no_history_data') }}</div>
      <div v-else class="flex flex-col gap-3">
        <div>{{ $t('history_data_desc', { appName: APP_NAME }) }}</div>
        <div v-for="(item, i) in historyBackups" :key="item.key" class="border rounded-md flex justify-between">
          <div>
            <div class="">{{ i + 1 }}{{ $t('index_version_label') }}{{ item.hash }}</div>
            <div class="color-gray">{{ $t('auto_backup_time') }}{{ formatHistoryTime(item.createdAt) }}</div>
          </div>
          <div class="mt-2">
            <BaseButton size="large"  @click="openHistoryRestoreGate(item)" :disabled="restoreLoading">{{
              $t('restore_this_version')
            }}</BaseButton>
          </div>
        </div>
      </div>
    </div>
  </Dialog>

  <Dialog v-model="showSbFirstSyncChoiceDialog" :title="$t('remote_data_detected_title')">
    <div class="p-4 w-120">
      <div class="">{{ $t('remote_data_detected_desc') }}</div>
      <div class="color-gray mt-2">{{ $t('push_local_desc') }}</div>
      <div class="color-gray">{{ $t('pull_remote_desc') }}</div>
      <div class="flex justify-end mt-4">
        <BaseButton size="large"  :loading="sbSyncChoiceLoading" @click="onSbFirstSyncChoice('push_local')">{{
          $t('push_local')
        }}</BaseButton>
        <BaseButton size="large"  :loading="sbSyncChoiceLoading" @click="onSbFirstSyncChoice('pull_remote')">{{
          $t('pull_remote')
        }}</BaseButton>
      </div>
    </div>
  </Dialog>

  <MigrateDialog v-model="showTransfer" @ok="transferOk" />
</template>

<style scoped lang="scss">
.col-line {
  border-right: 2px solid var(--color-line);
}

.setting {
  .left {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;

    .tabs {
      padding: 0.6rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;

      .tab {
        @apply cursor-pointer flex items-center relative;
        border-radius: 0.5rem;
        @apply w-auto p-1 lg:w-40 lg:p-2;
        gap: 0.6rem;
        transition: all 0.5s;

        svg {
          @apply text-lg shrink-0;
        }

        &:hover {
          background: var(--color-fourth);
        }

        &.active {
          background: var(--color-fourth);
        }
      }
    }
  }

  .content {
    .row {
      min-height: 2.6rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: calc(var(--space) * 5);

      .wrapper {
        height: 2rem;
        flex: 1;
        display: flex;
        justify-content: flex-end;
        gap: var(--space);

        span {
          text-align: right;
          color: gray;
        }

        .set-key {
          align-items: center;

          input {
            width: 9rem;
            box-sizing: border-box;
            margin-right: 0.6rem;
            height: 1.8rem;
            outline: none;
            font-size: 1rem;
            border: 1px solid gray;
            border-radius: 0.2rem;
            padding: 0 0.3rem;
            background: var(--color-second);
            color: var(--color-font-1);
          }
        }
      }

      .main-title {
        font-size: 1.1rem;
        font-weight: bold;
      }

      .item-title {
        font-size: 1rem;
      }

      .sub-title {
        font-size: 0.9rem;
      }
    }

    .body {
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .scroll {
      flex: 1;
      padding-right: 0.6rem;
      overflow: auto;
    }

    .line {
      border-bottom: 1px solid #c4c3c3;
    }
  }
}
</style>
