import { getDefaultBaseState, useBaseStore } from '@/stores/base'
import type { BaseState } from '@/stores/base'
import { getDefaultSettingState } from '@/stores/setting'
import type { SettingState } from '@/stores/setting'
import type { Dict, DictResource } from '@/types/types'
import { useRouter } from 'vue-router'
import { useRuntimeStore } from '@/stores/runtime'
import dayjs from 'dayjs'
import { AppEnv, DictId, ENV, RESOURCE_PATH, SAVE_DICT_KEY, SAVE_SETTING_KEY } from '@/config/env'
import { nextTick } from 'vue'
import Toast from '@/components/base/toast/Toast'
import { getDefaultDict, getDefaultWord } from '@/types/func'
import duration from 'dayjs/plugin/duration'
import { DictType } from '@/types/enum'

dayjs.extend(duration)

export function no() {
  Toast.warning('未现实')
}

//检测多余字段，防止人为删除数据，导致数据不完整报错
function checkRiskKey(origin: object, target: object) {
  for (const [key, value] of Object.entries(origin)) {
    if (target[key] !== undefined) origin[key] = target[key]
  }
  return origin
}

export function checkAndUpgradeSaveDict(val: any) {
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
        console.warn('数据缺少版本号，返回默认状态')
        return defaultState
      }
      let state: any = data.val
      if (typeof state !== 'object') {
        console.warn('数据格式无效，返回默认状态')
        return defaultState
      }
      state.load = false
      let version = Number(data.version)
      // console.log('state', state)
      if (version === SAVE_DICT_KEY.version) {
        checkRiskKey(defaultState, state)
        defaultState.article.bookList = defaultState.article.bookList.map(v => {
          return getDefaultDict(checkRiskKey(getDefaultDict(), v))
        })
        defaultState.word.bookList = defaultState.word.bookList.map(v => {
          return getDefaultDict(checkRiskKey(getDefaultDict(), v))
        })
        return defaultState
      } else {
        // 版本不匹配时，尽量保留数据而不是直接返回默认状态
        console.warn(`数据版本不匹配: 当前版本 ${version}, 期望版本 ${SAVE_DICT_KEY.version}，尝试保留数据`)
        try {
          checkRiskKey(defaultState, state)
          // 尝试保留 bookList 数据
          if (state.word && state.word.bookList && Array.isArray(state.word.bookList)) {
            defaultState.word.bookList = state.word.bookList.map((v: any) => {
              return getDefaultDict(checkRiskKey(getDefaultDict(), v))
            })
          }
          if (state.article && state.article.bookList && Array.isArray(state.article.bookList)) {
            defaultState.article.bookList = state.article.bookList.map((v: any) => {
              return getDefaultDict(checkRiskKey(getDefaultDict(), v))
            })
          }
          return defaultState
        } catch (upgradeError) {
          console.error('数据升级失败，返回默认状态', upgradeError)
          return defaultState
        }
      }
    } catch (e) {
      console.error('数据解析异常，返回默认状态', e)
      return defaultState
    }
  }
  return defaultState
}

export function checkAndUpgradeSaveSetting(val: any) {
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
      let version = Number(data.version)
      if (version === SAVE_SETTING_KEY.version) {
        checkRiskKey(defaultState.shortcutKeyMap, state.shortcutKeyMap)
        delete state.shortcutKeyMap
        checkRiskKey(defaultState, state)
        return defaultState
      } else {
        if (version === 13) {
          defaultState.soundType = state.soundType
        }
        //为了保持永远是最新的快捷键选项列表，但保留住用户的自定义设置，去掉无效的快捷键选项
        //例: 2版本，可能有快捷键A。3版本没有了
        checkRiskKey(defaultState.shortcutKeyMap, state.shortcutKeyMap)
        delete state.shortcutKeyMap
        checkRiskKey(defaultState, state)
        return defaultState
      }
    } catch (e) {
      return defaultState
    }
  }
  return defaultState
}

//筛选未自定义的词典，未自定义的词典不需要保存单词，用的时候再下载
export function shakeCommonDict(n: BaseState): BaseState {
  let data: BaseState = cloneDeep(n)
  data.word.bookList.map((v: Dict) => {
    if (!v.custom && ![DictId.wordKnown, DictId.wordWrong, DictId.wordCollect].includes(v.id)) v.words = []
  })
  data.article.bookList.map((v: Dict) => {
    if (!v.custom && ![DictId.articleCollect].includes(v.id)) v.articles = []
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
  if (!val) return
  if (String(val).length === 10) {
    val = val * 1000
  }
  const d = new Date(Number(val))
  return dayjs(d).format(format)
}

export function msToHourMinute(ms) {
  const d = dayjs.duration(ms)
  const hours = d.hours()
  const minutes = d.minutes()
  const seconds = d.seconds()
  if (hours) return `${hours}小时${minutes}分钟`
  if (minutes) return `${minutes}分钟`
  return `${seconds}秒`
}

export function msToMinute(ms) {
  return `${Math.floor(dayjs.duration(ms).asMinutes())}分钟`
}

//获取完成天数
export function _getAccomplishDays(total: number, dayNumber: number) {
  return Math.ceil(total / dayNumber)
}

//获取完成日期
export function _getAccomplishDate(total: number, dayNumber: number) {
  if (dayNumber <= 0) return '-'
  let d = _getAccomplishDays(total, dayNumber)
  return dayjs().add(d, 'day').format('YYYY-MM-DD')
}

//获取学习进度
export function _getStudyProgress(index: number, total: number) {
  return Number(((index / total) * 100).toFixed())
}

//todo 偶尔发现一个报错，这里nextTick一直不执行
export function _nextTick(cb: () => void, time?: number) {
  if (time) {
    nextTick(() => setTimeout(cb, time))
  } else {
    nextTick(cb)
  }
}

export function _copy(val: string) {
  navigator.clipboard.writeText(val)
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
    if (type === DictType.word) {
      return getDefaultDict({ ...val, words: s })
    } else {
      return getDefaultDict({ ...val, articles: s })
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
          window[key] = module.default || module // 将模块挂到 window 对象
          resolve(window[key])
        } catch (err) {
          reject(`${key} 加载失败: ${err.message}`)
        }
      }
    } else {
      // 如果是非 .mjs 文件，直接按原方式加载
      script.src = url
      script.onload = () => resolve(window[key])
    }
    script.onerror = () => reject(key + ' 加载失败')
    document.head.appendChild(script)
  })
}

export function total(arr, key) {
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
  return resource
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
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  // 判断是否包含 iPhone、iPad 或 iPod
  return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
}
