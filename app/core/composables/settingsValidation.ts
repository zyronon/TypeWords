const record = (value: any): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// waitTimeForChangeWord is passed to setTimeout; spaceCooldownTime is compared with Date.now() deltas.
// HTML/WebView delays are signed 32-bit. This is not the current UI 10000 ms cap.
const SIGNED_32_TIMER_MAX = 2147483647

function validateFsrsGradeLimits(value: Record<string, any>): void {
  const keys = ['fsrsEasyLimit', 'fsrsGoodLimit', 'fsrsHardLimit'] as const
  const present: Partial<Record<(typeof keys)[number], number>> = {}
  for (const key of keys) {
    if (!(key in value)) continue
    const limit = value[key]
    // Wrong-time thresholds; 0 is the current Easy default. Missing companions stay for migration.
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new Error(`Invalid settings ${key}`)
    }
    present[key] = limit
  }
  const easy = present.fsrsEasyLimit
  const good = present.fsrsGoodLimit
  const hard = present.fsrsHardLimit
  // Product cascade: Easy if <= easy, else Good if <= good, else Hard if <= hard, else Again.
  if (easy !== undefined && good !== undefined && easy > good) {
    throw new Error('Invalid settings fsrsEasyLimit')
  }
  if (good !== undefined && hard !== undefined && good > hard) {
    throw new Error('Invalid settings fsrsGoodLimit')
  }
  if (easy !== undefined && hard !== undefined && easy > hard) {
    throw new Error('Invalid settings fsrsEasyLimit')
  }
}

function validateFsrsParameters(parameters: any): void {
  const assert = (valid: boolean, field = '') => {
    if (!valid) throw new Error(`Invalid settings fsrsParameters${field ? `.${field}` : ''}`)
  }
  assert(record(parameters))
  if ('request_retention' in parameters) {
    const retention = parameters.request_retention
    assert(
      typeof retention === 'number' && Number.isFinite(retention) && retention > 0 && retention <= 1,
      'request_retention'
    )
  }
  if ('maximum_interval' in parameters) {
    const interval = parameters.maximum_interval
    assert(typeof interval === 'number' && Number.isFinite(interval) && interval >= 1, 'maximum_interval')
  }
  for (const key of ['enable_fuzz', 'enable_short_term']) {
    if (key in parameters) assert(typeof parameters[key] === 'boolean', key)
  }
  if ('w' in parameters) {
    const weights = parameters.w
    assert(Array.isArray(weights) && [17, 19, 21].includes(weights.length), 'w')
    // Iteration also rejects holes; Array.every would silently skip them.
    for (const weight of weights) assert(typeof weight === 'number' && Number.isFinite(weight), 'w')
  }
  for (const key of ['learning_steps', 'relearning_steps']) {
    if (!(key in parameters)) continue
    assert(Array.isArray(parameters[key]), key)
    for (const step of parameters[key]) {
      assert(typeof step === 'string' && /^\+?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?[mhd]$/i.test(step), key)
      const unit = step.slice(-1)
      const numeric = step.slice(0, -1)
      // Keep the installed engine's parseInt semantics, including fractional legacy steps.
      const minutes = Number.parseInt(numeric, 10) * ({ m: 1, h: 60, d: 1440 }[unit] ?? NaN)
      assert(Number.isFinite(Number(numeric)) && Number.isFinite(minutes) && minutes >= 0, key)
    }
  }
}

/** Validate settings consumed by migration, practice and audio before any repair side effects. */
export function validateStoredSettings(value: any): void {
  if (
    !record(value) ||
    !record(value.shortcutKeyMap) ||
    !Object.values(value.shortcutKeyMap).every(shortcut => typeof shortcut === 'string')
  ) {
    throw new Error('Invalid settings shortcutKeyMap')
  }
  // Missing historical fields are supplied by migration, not by this boundary.
  for (const key of ['repeatCount', 'repeatCustomCount']) {
    if (!(key in value)) continue
    // Null is the current default even while the custom-count option is selected.
    if (key === 'repeatCustomCount' && value[key] === null) continue
    if (!Number.isSafeInteger(value[key]) || value[key] <= 0) {
      throw new Error(`Invalid settings ${key}`)
    }
  }
  for (const key of ['waitTimeForChangeWord', 'spaceCooldownTime', 'wordReviewRatio']) {
    if (key in value && (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0)) {
      throw new Error(`Invalid settings ${key}`)
    }
  }
  for (const key of ['waitTimeForChangeWord', 'spaceCooldownTime']) {
    if (key in value && value[key] > SIGNED_32_TIMER_MAX) {
      throw new Error(`Invalid settings ${key}`)
    }
  }
  for (const key of [
    'wordSoundVolume',
    'sentenceSoundVolume',
    'articleSoundVolume',
    'keyboardSoundVolume',
    'effectSoundVolume',
  ]) {
    if (
      key in value &&
      (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 100)
    ) {
      throw new Error(`Invalid settings ${key}`)
    }
  }
  for (const key of ['wordSoundSpeed', 'sentenceSoundSpeed', 'articleSoundSpeed']) {
    if (key in value && (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] <= 0)) {
      throw new Error(`Invalid settings ${key}`)
    }
  }
  validateFsrsGradeLimits(value)
  if ('fsrsParameters' in value) validateFsrsParameters(value.fsrsParameters)
  // Older versions omit these collections; the existing migrator supplies their defaults.
  if ('fontSize' in value) {
    if (!record(value.fontSize)) throw new Error('Invalid settings fontSize')
    for (const key of [
      'articleForeignFontSize',
      'articleTranslateFontSize',
      'wordForeignFontSize',
      'wordTranslateFontSize',
    ]) {
      if (
        key in value.fontSize &&
        (typeof value.fontSize[key] !== 'number' || !Number.isFinite(value.fontSize[key]) || value.fontSize[key] <= 0)
      ) {
        throw new Error(`Invalid settings fontSize.${key}`)
      }
    }
  }
  if (
    'ttsVoiceMap' in value &&
    (!Array.isArray(value.ttsVoiceMap) ||
      !value.ttsVoiceMap.every(
        (entry: any) => record(entry) && typeof entry.key === 'string' && typeof entry.voice === 'string'
      ))
  ) {
    throw new Error('Invalid settings ttsVoiceMap')
  }
}
