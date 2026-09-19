import { APP_VERSION, EXPORT_DATA_KEY, SAVE_DICT_KEY, SAVE_SETTING_KEY } from '../config/env'
import { checkAndUpgradeSaveDict, checkAndUpgradeSaveSetting } from '../utils'
import { checkAndUpgradePracticeWordCache, PRACTICE_ARTICLE_CACHE, PRACTICE_WORD_CACHE } from '../utils/cache'
import type { BackupData } from '../types'
import { validateRemotePracticeCache } from './remotePracticeValidation'
import { validateStoredSettings } from './settingsValidation'
import { validateStoredDictionary } from './dictionaryValidation'

export type ImportAudio = Array<{ id: string; file: Blob }>
const record = (v: any): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v)

function assertEnvelope(value: any, maxVersion: number, name: string, nullable = false) {
  if (
    !record(value) ||
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    value.version > maxVersion ||
    !(record(value.val) || (nullable && value.val === null))
  ) {
    throw new Error(`Invalid or unsupported backup field: ${name}`)
  }
}

/** Validate untrusted input before invoking legacy upgrade code (which can create repair snapshots). */
export async function prepareBackupImport(text: string, audio: ImportAudio): Promise<BackupData['val']> {
  const backup = JSON.parse(text)
  if (!record(backup) || ![4, EXPORT_DATA_KEY.version].includes(backup.version) || !record(backup.val)) {
    throw new Error('Invalid or unsupported backup schema')
  }
  const data = backup.val
  assertEnvelope(data.dict, SAVE_DICT_KEY.version, 'dict')
  assertEnvelope(data.setting, SAVE_SETTING_KEY.version, 'setting')
  try {
    validateStoredDictionary(data.dict.val)
  } catch (error) {
    throw new Error('Invalid backup dictionary', { cause: error })
  }
  try {
    validateStoredSettings(data.setting.val)
  } catch (error) {
    throw new Error('Invalid backup settings', { cause: error })
  }
  for (const key of [PRACTICE_WORD_CACHE, PRACTICE_ARTICLE_CACHE]) {
    const envelope = data[key.key]
    if (envelope == null) continue
    assertEnvelope(envelope, key.version, key.key, true)
    // ZIP and remote payloads share the same cache format and pre-migration boundary.
    try {
      validateRemotePracticeCache(envelope.val, key === PRACTICE_WORD_CACHE ? 'word' : 'article', envelope.version)
    } catch (error) {
      throw new Error(`Invalid backup practice cache: ${key.key}`, { cause: error })
    }
  }
  const requiredAudio = new Set<string>()
  for (const kind of ['word', 'article']) {
    const section = data.dict.val[kind]
    if (!section.bookList.length) {
      throw new Error(`Invalid backup dictionary: ${kind}`)
    }
    for (const book of section.bookList) {
      for (const article of book.articles) {
        if (!article.audioSrc && article.audioFileId) {
          if (typeof article.audioFileId !== 'string') throw new Error('Invalid audio identifier')
          requiredAudio.add(article.audioFileId)
        }
      }
    }
  }
  const available = new Set<string>()
  for (const item of audio) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id ||
      available.has(item.id) ||
      !(item.file instanceof Blob) ||
      item.file.size === 0
    ) {
      throw new Error('Invalid or duplicate backup audio')
    }
    available.add(item.id)
  }
  for (const id of requiredAudio) {
    if (!available.has(id)) throw new Error(`Missing backup audio: ${id}`)
  }
  data.dict.val = await checkAndUpgradeSaveDict(data.dict)
  data.setting.val = await checkAndUpgradeSaveSetting(data.setting)
  data[PRACTICE_WORD_CACHE.key] = checkAndUpgradePracticeWordCache(data[PRACTICE_WORD_CACHE.key], data.setting.val)
  if (backup.version === 4 && data[APP_VERSION.key] != null) data.setting.val.webAppVersion = data[APP_VERSION.key]
  return data as BackupData['val']
}

/** Read all entries without touching IndexedDB. Missing/corrupt data or audio never partially imports. */
export async function readBackupZip(zip: any): Promise<{ text: string; audio: ImportAudio }> {
  const data = zip.file('data.json')
  if (!data) throw new Error('missing_data_json')
  const text = await data.async('string')
  // Fail malformed JSON before spending time decompressing audio.
  JSON.parse(text)
  const audio: ImportAudio = []
  for (const filename of Object.keys(zip.files)) {
    if (!filename.startsWith('mp3/') || zip.files[filename].dir) continue
    if (!/^mp3\/[^/\\]+\.mp3$/.test(filename)) throw new Error('Invalid backup audio path')
    audio.push({ id: filename.slice(4, -4), file: await zip.file(filename).async('blob') })
  }
  return { text, audio }
}
