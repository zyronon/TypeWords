import dayjs from 'dayjs'
import { APP_VERSION } from '../config/env'
import { useExport } from '../hooks/export'
import { useBaseStore } from '../stores'
import { getPracticeWordCacheLocal } from '../utils/cache'
import { userCollectionPreflight, userCollectionUpload } from '@/core/apis'

const CLIENT_ID_KEY = 'typewords-user-collection-client-id'
const THREE_HOURS_MS = 3 * 60 * 60 * 1000
const REQUIRED_STUDY_DAYS = 5
const MAX_ZIP_BYTES = 5 * 1024 * 1024

let checkedThisSession = false

type PreflightResult = {
  success: boolean
  data?: {
    enabled: boolean
    canUpload: boolean
    exists: boolean
    reason: 'already_exists' | 'disabled' | 'quota_full' | null
    maxBytes: number
  }
}

function createClientId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function getOrCreateClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY)
  if (existing) return existing
  const clientId = createClientId()
  localStorage.setItem(CLIENT_ID_KEY, clientId)
  return clientId
}

/**
 * 复制 words.vue 的统计口径，避免采集逻辑与 words 页面形成依赖。
 */
async function hasReachedCollectionThreshold(): Promise<boolean> {
  const store = useBaseStore()
  const allWordStatistics = store.word.bookList.flatMap(book => book.statistics ?? [])
  const persistedTotalMs = allWordStatistics.reduce((sum, stat) => sum + Number(stat.spend || 0), 0)

  const practiceCache = await getPracticeWordCacheLocal()
  const currentStat = practiceCache?.statStoreData
  const cacheSpendMs = Number(currentStat?.spend || 0)
  const cacheDayKeys = new Set<string>()
  if (currentStat?.spend) {
    if (Array.isArray(currentStat.segments) && currentStat.segments.length > 0) {
      for (const [segmentStart] of currentStat.segments) {
        cacheDayKeys.add(dayjs(segmentStart).format('YYYY-MM-DD'))
      }
    } else {
      cacheDayKeys.add(dayjs(currentStat.startDate).format('YYYY-MM-DD'))
    }
  }

  const studyDayKeys = new Set(allWordStatistics.map(stat => dayjs(stat.startDate).format('YYYY-MM-DD')))
  for (const dayKey of cacheDayKeys) studyDayKeys.add(dayKey)

  return studyDayKeys.size >= REQUIRED_STUDY_DAYS || persistedTotalMs + cacheSpendMs >= THREE_HOURS_MS
}

export async function checkAndUploadUserCollection(): Promise<void> {
  if (!import.meta.client || checkedThisSession) return
  checkedThisSession = true

  try {
    if (!(await hasReachedCollectionThreshold())) return

    const clientId = getOrCreateClientId()
    const preflight = (await userCollectionPreflight({ clientId })) as unknown as PreflightResult
    if (!preflight?.success || !preflight.data?.canUpload) return

    const { buildExportZip } = useExport()
    const zip = await buildExportZip()
    const serverMaxBytes = Number(preflight.data.maxBytes || MAX_ZIP_BYTES)
    if (zip.size >= Math.min(MAX_ZIP_BYTES, serverMaxBytes)) return

    const formData = new FormData()
    formData.append('client_id', clientId)
    formData.append('file', zip, `${clientId}.zip`)
    formData.append('device_os', navigator.platform || '')
    formData.append('device_model', navigator.userAgent || '')
    formData.append('app_version', String(APP_VERSION.version))

    await userCollectionUpload(formData)
  } catch (error) {
    console.warn('测试数据静默上传跳过', error)
  }
}
