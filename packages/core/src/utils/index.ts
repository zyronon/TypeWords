import type { BaseState, SettingState } from '../stores'
import { getDefaultBaseState, getDefaultSettingState, useBaseStore, useRuntimeStore } from '../stores'
import {
  CompareResult,
  Dict,
  DictResource,
  DictType,
  getDefaultDict,
  getDefaultWord,
  IdentifyMethod,
  SaveData,
  ShortcutKey,
} from '../types'
import { useRouter } from 'vue-router'
//@ts-ignore
import dayjs from 'dayjs'
//@ts-ignore
import duration from 'dayjs/plugin/duration'
import {
  APP_VERSION,
  AppEnv,
  BACKUP_INDEX_KEY,
  DefaultShortcutKeyMap,
  DictId,
  ENV,
  RESOURCE_PATH,
  SAVE_DICT_KEY,
} from '../config/env'
import { nextTick } from 'vue'
import { Toast } from '@typewords/base'
import { get } from 'idb-keyval'
import { nanoid } from 'nanoid'
import { saveHashSnapshot } from '../composables/useDataSyncPersistence'
import { withAppBaseURL } from './base-url'

dayjs.extend(duration)

export function no() {
  Toast.warning('未现实')
}

//检测多余字段;防止人为删除数据，导致数据不完整报错
function checkRiskKey(origin: object, target: object) {
  for (const [key, value] of Object.entries(origin)) {
    // @ts-ignore
    if (target[key] !== undefined) origin[key] = target[key]
  }
  return origin
}

function normalizeStoredDict(val: any): Dict {
  const next = { ...(val ?? {}) }
  // 历史数据升级：系统虚拟词典补 system: true（无论旧存档是否有此字段）
  const systemIds = [DictId.wordCollect, DictId.wordWrong, DictId.wordKnown, DictId.articleCollect]
  if (systemIds.includes(next.enName ?? next.id)) {
    next.system = true
  }
  if (!next.enName && next.en_name) {
    next.enName = next.en_name
  }
  if (!next.enName && !next.en_name) {
    next.enName = String(next.id)
  }
  if (Array.isArray(next.words) && next.words.length) {
    next.length = next.words.length
  }
  if (Array.isArray(next.articles) && next.articles.length) {
    next.length = next.articles.length
  }
  return getDefaultDict(checkRiskKey(getDefaultDict(), next))
}

export async function checkAndUpgradeSaveDict(val: any) {
  // console.log(configStr)
  // console.log('s', new Blob([val]).size)
  // val = ''
  let defaultState = getDefaultBaseState()
  if (val) {
    try {
      let data: any
      if (typeof val === 'string') {
        data = JSON.parse(val)
      } else {
        data = val
      }
      if (!data.version) {
        let currentHash = '词典数据缺少版本号-自动备份'
        window?.umami?.track('error', currentHash)
        console.warn(currentHash)
        await saveHashSnapshot(currentHash, '')
        return defaultState
      }
      let state: any = data.val
      if (typeof state !== 'object') {
        let currentHash1 = '词典数据格式无效-自动备份'
        console.warn(currentHash1)
        window?.umami?.track('error', currentHash1)
        await saveHashSnapshot(currentHash1, '')
        return defaultState
      }
      state.load = false
      let version = Number(data.version)
      // console.log('state', state)
      if (version === SAVE_DICT_KEY.version) {
        checkRiskKey(defaultState, state)
        defaultState.article.bookList = defaultState.article.bookList.map(v => normalizeStoredDict(v))
        defaultState.word.bookList = defaultState.word.bookList.map(v => normalizeStoredDict(v))
        return defaultState
      } else {
        // 版本不匹配时，尽量保留数据而不是直接返回默认状态
        console.warn(`数据版本不匹配: 当前版本 ${version}, 期望版本 ${SAVE_DICT_KEY.version}，尝试保留数据`)
        try {
          checkRiskKey(defaultState, state)
          // 尝试保留 bookList 数据
          if (state.word && state.word.bookList && Array.isArray(state.word.bookList)) {
            defaultState.word.bookList = state.word.bookList.map((v: any) => normalizeStoredDict(v))
          }
          if (state.article && state.article.bookList && Array.isArray(state.article.bookList)) {
            defaultState.article.bookList = state.article.bookList.map((v: any) => normalizeStoredDict(v))
          }
          return defaultState
        } catch (upgradeError) {
          let currentHash2 = '词典数据升级失败-自动备份'
          console.error(currentHash2, upgradeError)
          window?.umami?.track('error', currentHash2 + upgradeError)
          await saveHashSnapshot(currentHash2, '')
          return defaultState
        }
      }
    } catch (e) {
      let currentHash3 = '词典数据解析异常-自动备份'
      console.error(currentHash3, e)
      window?.umami?.track('error', currentHash3 + e)
      await saveHashSnapshot(currentHash3, '')
      return defaultState
    }
  }
  return defaultState
}

// 带版本、时间，用于同步时附带，这样不用再保存到本地一次
export async function parseJsonStr(val: any, cb: any): Promise<SaveData> {
  let result: SaveData = JSON.parse(val)
  result.val = await cb(result)
  return result
}

export async function checkAndUpgradeSaveSetting(val: any) {
  // console.log(configStr)
  // console.log('s', new Blob([val]).size)
  // val = ''
  let defaultState = getDefaultSettingState()
  if (val) {
    try {
      let data
      if (typeof val === 'string') {
        data = JSON.parse(val)
      } else {
        data = val
      }
      if (!data.version) return defaultState
      let state: SettingState & { [key: string]: any } = data.val
      if (typeof state !== 'object') return defaultState
      state.load = false
      // debugger
      let version = Number(data.version)
      //为了保持永远是最新的快捷键选项列表，但保留住用户的自定义设置，去掉无效的快捷键选项
      //例: 2版本，可能有快捷键A。3版本没有了
      checkRiskKey(defaultState.shortcutKeyMap, state.shortcutKeyMap)

      let updateLocalData = false
      //移除单独保存的 app version字段，转移到 settingStore的webAppVersion里面
      if (version <= 17) {
        defaultState.webAppVersion = (await get(APP_VERSION.key)) ?? APP_VERSION.version
        updateLocalData = true
      }
      //3/20晚上10点25推的代码，这个地方出了一个bug，ShortcutKey没导入，导致抛异常后返回了默认值，所有的用户的setting都变成默认值了。
      //在这里读取之前的快照，如果存在则从里面读取setting的firstTime，
      //判断是否与当前值相等，不相等则取快照的值并将本地的update_at更新，以免被远程覆盖
      // 修复19版本未导入变量，导致抛错所有用户setting变默认值的bug
      if (version === 19) {
        try {
          const snapshotCutoffTime = new Date('2026-03-20T22:25:00+08:00').getTime()
          const rawIndex = (await get(BACKUP_INDEX_KEY)) as Array<{ key?: string; createdAt?: number }> | null
          const index = Array.isArray(rawIndex) ? rawIndex : []
          const targetSnapshot = index
            .filter(item => typeof item?.key === 'string' && Number(item?.createdAt) <= snapshotCutoffTime)
            .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0]
          if (targetSnapshot?.key) {
            const snapshot = await get(targetSnapshot.key)
            const snapshotSettingRaw = snapshot?.data?.setting
            let snapshotSettingState: any = null
            if (typeof snapshotSettingRaw === 'string') {
              snapshotSettingState = JSON.parse(snapshotSettingRaw)?.val ?? null
            } else if (snapshotSettingRaw && typeof snapshotSettingRaw === 'object') {
              snapshotSettingState = snapshotSettingRaw?.val ?? null
            }
            const snapshotFirstTime = Number(snapshotSettingState?.firstTime)
            const currentFirstTime = Number(state?.firstTime)
            if (Number.isFinite(snapshotFirstTime) && snapshotFirstTime > 0 && snapshotFirstTime !== currentFirstTime) {
              state.firstTime = snapshotFirstTime
              updateLocalData = true
            }
          }
        } catch (e) {
          console.warn('firstTime 快照回填跳过或失败，忽略并继续', e)
        }
      }

      //修复快捷键下一个单词和跳过单词重复了
      if (version <= 20) {
        defaultState.shortcutKeyMap[ShortcutKey.Next] = DefaultShortcutKeyMap[ShortcutKey.Next]
        updateLocalData = true
      }

      //合并单独的快速自测选项到新的合并选项中
      if (version <= 21) {
        //如果用户之前是快速自测
        if (state.quickIdentify) state.identifyMethod = IdentifyMethod.QuickIdentify
        updateLocalData = true
      }

      // @ts-ignore
      delete state.shortcutKeyMap
      checkRiskKey(defaultState, state)
      ;(defaultState as any).__updateLocalData = updateLocalData
      return defaultState
    } catch (e) {
      let currentHash = '设置数据解析异常-自动备份'
      window?.umami?.track('error', currentHash + e)
      await saveHashSnapshot(currentHash, '')
      return defaultState
    }
  }
  return defaultState
}

//筛选未自定义的词典，未自定义的词典不需要保存单词，用的时候再下载
export function shakeCommonDict(n: BaseState): BaseState {
  let data: BaseState = cloneDeep(n)
  data.word.bookList.map((v: Dict) => {
    if (!v.custom && !v.system) v.words = []
  })
  data.article.bookList.map((v: Dict) => {
    if (!v.custom && !v.system) v.articles = []
    else {
      v.articles.map(a => {
        //运行时再生成
        a.sections = []
      })
    }
  })
  return data
}

export function isMobile(): boolean {
  //@ts-ignore
  if (import.meta.server) return false
  return /Mobi|iPhone|Android|ipad|tablet/i.test(window.navigator.userAgent)
}

export function useNav() {
  const router = useRouter()
  const runtimeStore = useRuntimeStore()

  function nav(path, query = {}, data?: any) {
    if (data) {
      runtimeStore.routeData = cloneDeep(data)
    }
    router.push({ path, query })
  }

  return { nav, push: nav, back: router.back }
}

export function _dateFormat(val: any, format: string = 'YYYY/MM/DD HH:mm'): string {
  if (!val) return ''
  if (String(val).length === 10) {
    val = val * 1000
  }
  const d = new Date(Number(val))
  return dayjs(d).format(format)
}

export function msToHourMinute(ms: number, en: boolean = false) {
  const d = dayjs.duration(ms)
  const totalMinutes = Math.floor(d.asMinutes())
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours) return `${hours}${en ? 'h' : '小时'}${minutes}${en ? 'm' : '分钟'}`
  if (minutes) return `${minutes}${en ? 'm' : '分钟'}`
  return `${Math.floor(d.asSeconds())}秒`
}

export function msToMinute(ms: number, en: boolean = false) {
  return `${Math.floor(dayjs.duration(ms).asMinutes())}${en ? 'm' : '分钟'}`
}

//获取完成天数
export function _getAccomplishDays(total: number, dayNumber: number) {
  let r = Math.ceil(total / dayNumber)
  if (r) {
    return r === Infinity ? '-' : r
  }
  return '-'
}

//获取完成日期
export function _getAccomplishDate(total: number, dayNumber: number) {
  if (dayNumber <= 0) return '-'
  let d = _getAccomplishDays(total, dayNumber)
  if (d == '-') return '-'
  return dayjs()
    .add(d as number, 'day')
    .format('YYYY-MM-DD')
}

//获取学习进度
export function _getStudyProgress(index: number, total: number): number {
  //@ts-ignore
  return Number(((index / total) * 100).toFixed())
}

export function _nextTick(cb: () => void, time?: number) {
  if (time) {
    nextTick(() => setTimeout(cb, time))
  } else {
    nextTick(cb)
  }
}

export function _parseLRC(lrc: string): { start: number; end: number; text: string }[] {
  const lines = lrc.split('\n').filter(line => line.trim() !== '')
  const regex = /\[(\d{2}):(\d{2}\.\d{2})\](.*)/
  let parsed: any = []

  for (let i = 0; i < lines.length; i++) {
    let match = lines[i].match(regex)
    if (match) {
      let start = parseFloat(match[1]) * 60 + parseFloat(match[2]) // 转换成秒
      let text = match[3].trim()

      // 计算结束时间（下一个时间戳）
      let nextMatch = lines[i + 1] ? lines[i + 1].match(regex) : null
      let end = nextMatch ? parseFloat(nextMatch[1]) * 60 + parseFloat(nextMatch[2]) : null

      parsed.push({ start, end, text })
    }
  }

  return parsed
}

export async function sleep(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

export async function _getDictDataByUrl(val: DictResource, type: DictType = DictType.word): Promise<Dict> {
  // await sleep(2000);
  let dictResourceUrl = ENV.RESOURCE_URL + `dicts/${val.language}/word/${val.url}`
  if (type === DictType.article) {
    dictResourceUrl = ENV.RESOURCE_URL + `dicts/${val.language}/article/${val.url}`
  }
  let s = await fetch(resourceWrap(dictResourceUrl, val.version)).then(r => r.json())
  if (s) {
    //单词词典有两种类型，用article来判断
    if (type === DictType.article) {
      return getDefaultDict({ ...val, articles: s })
    } else {
      return getDefaultDict({ ...val, words: s })
    }
  }
  return getDefaultDict()
}

//从字符串里面转换为Word格式
export function convertToWord(raw: any) {
  const safeString = str => (typeof str === 'string' ? str.trim() : '')
  const safeSplit = (str, sep) => (safeString(str) ? safeString(str).split(sep).filter(Boolean) : [])

  // 1. trans
  const trans = safeSplit(raw.trans, '\n').map(line => {
    const match = safeString(line).match(/^([^\s.]+\.?)\s*(.*)$/)
    if (match) {
      let pos = safeString(match[1])
      let cn = safeString(match[2])

      // 如果 pos 不是常规词性（不以字母开头），例如 "【名】"
      if (!/^[a-zA-Z]+\.?$/.test(pos)) {
        cn = safeString(line) // 整行放到 cn
        pos = '' // pos 置空
      }

      return { pos, cn }
    }
    return { pos: '', cn: safeString(line) }
  })

  // 2. sentences
  const sentences = safeSplit(raw.sentences, '\n\n').map(block => {
    const [c, cn] = block.split('\n')
    return { c: safeString(c), cn: safeString(cn) }
  })

  // 3. phrases
  const phrases = safeSplit(raw.phrases, '\n\n').map(block => {
    const [c, cn] = block.split('\n')
    return { c: safeString(c), cn: safeString(cn) }
  })

  // 4. synos
  const synos = safeSplit(raw.synos, '\n\n').map(block => {
    const lines = block.split('\n').map(safeString)
    const [posCn, wsStr] = lines
    let pos = ''
    let cn = ''

    if (posCn) {
      const posMatch = posCn.match(/^([a-zA-Z.]+)(.*)$/)
      pos = posMatch ? safeString(posMatch[1]) : ''
      cn = posMatch ? safeString(posMatch[2]) : safeString(posCn)
    }
    const ws = wsStr ? wsStr.split('/').map(safeString) : []

    return { pos, cn, ws }
  })

  // 5. relWords
  const relWordsText = safeString(raw.relWords)
  let root = ''
  const rels = []

  if (relWordsText) {
    const relLines = relWordsText.split('\n').filter(Boolean)
    if (relLines.length > 0) {
      root = safeString(relLines[0].replace(/^词根:/, ''))
      let currentPos = ''
      let currentWords = []

      for (let i = 1; i < relLines.length; i++) {
        const line = relLines[i].trim()
        if (!line) continue

        if (/^[a-z]+\./i.test(line)) {
          if (currentPos && currentWords.length > 0) {
            rels.push({ pos: currentPos, words: currentWords })
          }
          currentPos = safeString(line.replace(':', ''))
          currentWords = []
        } else if (line.includes(':')) {
          const [c, cn] = line.split(':')
          currentWords.push({ c: safeString(c), cn: safeString(cn) })
        }
      }
      if (currentPos && currentWords.length > 0) {
        rels.push({ pos: currentPos, words: currentWords })
      }
    }
  }

  // 6. etymology
  const etymology = safeSplit(raw.etymology, '\n\n').map(block => {
    const lines = block.split('\n').map(safeString)
    const t = lines.shift() || ''
    const d = lines.join('\n').trim()
    return { t, d }
  })

  return getDefaultWord({
    id: raw.id,
    word: safeString(raw.word),
    phonetic0: safeString(raw.phonetic0),
    phonetic1: safeString(raw.phonetic1),
    trans,
    sentences,
    phrases,
    synos,
    relWords: { root, rels },
    etymology,
    custom: true,
  })
}

export function cloneDeep<T>(val: T): T {
  return JSON.parse(JSON.stringify(val))
}

export function shuffle<T>(array: T[]): T[] {
  const result = array.slice() // 复制数组，避免修改原数组
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)) // 生成 0 ~ i 的随机索引
    ;[result[i], result[j]] = [result[j], result[i]] // 交换元素
  }
  return result
}

export type ShufflePracticeRange = {
  start: number
  end: number
}

export type ShufflePracticeSetting = {
  total: number
  range: ShufflePracticeRange
}

export function normalizeShufflePracticeRange(range: ShufflePracticeRange, max: number): ShufflePracticeRange {
  const safeMax = Math.max(0, Math.floor(Number(max) || 0))
  let start = Math.floor(Number(range?.start) || 0)
  let end = Math.floor(Number(range?.end) || 0)

  start = Math.min(Math.max(start, 0), safeMax)
  end = Math.min(Math.max(end, 0), safeMax)

  if (start > end) {
    start = end
  }

  return { start, end }
}

export function toShufflePracticeRange(startNo: number, endNo: number, max: number): ShufflePracticeRange {
  const safeEndNo = Math.floor(Number(endNo) || 0)
  const safeStartNo = safeEndNo > 0 ? Math.max(1, Math.floor(Number(startNo) || 1)) : 0
  return normalizeShufflePracticeRange(
    {
      start: safeStartNo > 0 ? safeStartNo - 1 : 0,
      end: safeEndNo,
    },
    max
  )
}

export function getShufflePracticeWords<T extends { word: string }>(
  words: T[],
  setting: ShufflePracticeSetting,
  ignoreSet?: Set<string>
) {
  const range = normalizeShufflePracticeRange(setting.range, words.length)
  const total = Math.max(0, Math.floor(Number(setting.total) || 0))
  const candidates = words.slice(range.start, range.end).filter(v => !ignoreSet?.has(v.word))

  return {
    range,
    total,
    available: candidates.length,
    words: shuffle(candidates).slice(0, total),
  }
}

export function last<T>(array: T[]): T | undefined {
  return array.length > 0 ? array[array.length - 1] : undefined
}

export function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      func.apply(this, args)
    }, wait)
  }
}

export function throttle<T extends (...args: any[]) => void>(func: T, wait: number) {
  let lastTime = 0
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastTime >= wait) {
      func.apply(this, args)
      lastTime = now
    }
  }
}

export function reverse<T>(array: T[]): T[] {
  return array.slice().reverse()
}

export function groupBy<T extends Record<string, any>>(array: T[], key: string) {
  return array.reduce<Record<string, T[]>>((result, item) => {
    const groupKey = String(item[key])
    ;(result[groupKey] ||= []).push(item)
    return result
  }, {})
}

//随机取N个
export function getRandomN(arr: any[], n: number) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]] // 交换
  }
  return copy.slice(0, n)
}

//数组分成N份
export function splitIntoN(arr: any[], n: number) {
  const result = []
  const len = arr.length
  const base = Math.floor(len / n) // 每份至少这么多
  let extra = len % n // 前几份多 1 个

  let index = 0
  for (let i = 0; i < n; i++) {
    const size = base + (extra > 0 ? 1 : 0)
    result.push(arr.slice(index, index + size))
    index += size
    if (extra > 0) extra--
  }
  return result
}

export async function loadJsLib(key: string, url: string) {
  // @ts-ignore
  if (window[key]) return window[key]
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    // 判断是否是 .mjs 文件，如果是，则使用 type="module"
    if (url.includes('.mjs')) {
      script.type = 'module' // 需要加上 type="module"
      script.src = url
      script.onload = async () => {
        try {
          // 使用动态 import 加载模块
          const module = await import(url) // 动态导入 .mjs 模块
          // @ts-ignore
          window[key] = module.default || module // 将模块挂到 window 对象
          // @ts-ignore
          resolve(window[key])
        } catch (err: any) {
          reject(`${key} 加载失败: ${err.message}`)
        }
      }
    } else {
      // 如果是非 .mjs 文件，直接按原方式加载
      script.src = url
      // @ts-ignore
      script.onload = () => resolve(window[key])
    }
    script.onerror = () => reject(key + ' 加载失败')
    document.head.appendChild(script)
  })
}

export function total(arr: any[], key: string) {
  return arr.reduce((a, b) => {
    a += b[key]
    return a
  }, 0)
}

export function resourceWrap(resource: string, version?: number) {
  if (AppEnv.IS_OFFICIAL) {
    if (resource.includes('.json')) resource = resource.replace('.json', '')
    if (!resource.includes('http')) resource = RESOURCE_PATH + resource
    if (version === undefined) {
      const store = useBaseStore()
      return `${resource}_v${store.dictListVersion}.json`
    }
    return `${resource}_v${version}.json`
  }
  return withAppBaseURL(resource)
}

type DictIdentity = {
  id?: unknown
  enName?: unknown
  en_name?: unknown
}

export function normalizeDictId(id: unknown): string {
  return id === null || id === undefined ? '' : String(id)
}

export function getDictIdentityList(dict?: DictIdentity | null): string[] {
  if (!dict) return []
  return Array.from(new Set([dict.id, dict.enName, dict.en_name].map(normalizeDictId).filter(Boolean)))
}

export function isDictIdMatch(dict: DictIdentity | null | undefined, id: unknown): boolean {
  const target = normalizeDictId(id)
  return !!target && getDictIdentityList(dict).includes(target)
}

export function isSameDictResource(a?: DictIdentity | null, b?: DictIdentity | null): boolean {
  const aIds = getDictIdentityList(a)
  if (!aIds.length) return false
  const bIds = new Set(getDictIdentityList(b))
  return aIds.some(id => bIds.has(id))
}

/** @deprecated 优先使用 dict.system 字段判断，仅作兼容 fallback */
export function isBuiltinDictId(id: unknown): boolean {
  return [DictId.wordKnown, DictId.wordWrong, DictId.wordCollect, DictId.articleCollect].includes(normalizeDictId(id) as any)
}

export function ensureCustomDictCopy(dict: Dict): Dict {
  const next = getDefaultDict(dict)
  const sourceId = normalizeDictId(next.sourceId || next.id)
  next.id = `custom-${nanoid(10)}`
  next.sourceId = sourceId
  next.enName = ''
  next.custom = true
  next.system = false
  next.sync = false
  next.userDictId = undefined
  return next
}

export function findOfficialSourceDict(list: Dict[] = [], dict?: Partial<Dict> | null): Dict | undefined {
  if (!dict) return undefined
  const sourceId = normalizeDictId(dict.sourceId)
  if (sourceId) {
    const matchBySourceId = list.find(item => isDictIdMatch(item, sourceId))
    if (matchBySourceId) return matchBySourceId
  }
  const currentId = normalizeDictId(dict.id)
  if (currentId) {
    const matchById = list.find(item => isDictIdMatch(item, currentId))
    if (matchById) return matchById
  }
  const url = dict.url ? String(dict.url) : ''
  if (url) {
    return list.find(item => item.url === url)
  }
  return undefined
}

// check if it is a new user
export async function isNewUser() {
  let isNew = false
  let base = useBaseStore()
  console.log(JSON.stringify(base.$state))
  console.log(JSON.stringify(getDefaultBaseState()))
  return JSON.stringify(base.$state) === JSON.stringify({ ...getDefaultBaseState(), ...{ load: true } })
}

export function jump2Feedback() {
  window.open('https://v.wjx.cn/vm/ev0W7fv.aspx#', '_blank')
}

export function isIOS() {
  //@ts-ignore
  const userAgent = navigator.userAgent || navigator.vendor || window.opera
  // 判断是否包含 iPhone、iPad 或 iPod
  //@ts-ignore
  return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream
}

export function parseTimestamp(ts: string | undefined): number | null {
  if (!ts) return null
  const parsed = Date.parse(ts)
  return Number.isNaN(parsed) ? null : parsed
}

export function compareTimestamps(localTs: string | undefined, remoteTs: string | undefined): CompareResult {
  const localTime = parseTimestamp(localTs)
  const remoteTime = parseTimestamp(remoteTs)
  if (localTime == null || remoteTime == null) return CompareResult.NoRemote
  if (remoteTime > localTime) return CompareResult.RemoteNewer
  if (localTime > remoteTime) return CompareResult.LocalNewer
  return CompareResult.Equal
}

/**
 * 是否应拉取远程（唯一入口）：先看版本，再看时间戳。
 * 1. 无版本号 → 视为旧，不拉。
 * 2. 有版本号：版本大的是新；相等则比时间戳，remote_newer 才拉。
 */
export function shouldFetchRemote(
  localUpdatedAt: string | undefined,
  remoteUpdatedAt: string | undefined,
  remoteVersion: number | undefined,
  currentVersion: number
): CompareResult {
  if (remoteVersion == null) return CompareResult.NoRemote
  if (remoteVersion > currentVersion) return CompareResult.RemoteNewer
  if (remoteVersion < currentVersion) return CompareResult.LocalNewer
  return compareTimestamps(localUpdatedAt, remoteUpdatedAt)
}

export function isEmpty(obj: any): boolean {
  if (typeof obj === 'object') {
    return Object.keys(obj).length === 0
  }
  if (Array.isArray(obj)) {
    return obj.length === 0
  }
  return obj === null || obj === undefined || obj === ''
}

const charMap = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  ' ': ' ',
  '。': '.',
  '，': ',',
  '？': '?',
  '【': '[',
  '】': ']',
  '￥': '$',
  '！': '!',
  '（': '(',
  '）': ')',
  '《': '<',
  '》': '>',
}

export function normalizeWord(word: string) {
  return word
    .split('')
    .map(ch => charMap[ch] || ch)
    .join('')
}
