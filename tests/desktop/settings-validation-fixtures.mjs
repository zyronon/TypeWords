export const invalidSettings = [
  ...['repeatCount', 'repeatCustomCount'].flatMap(field =>
    ['2', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(bad => [
      `${field} rejects ${JSON.stringify(bad)}`,
      value => (value[field] = bad),
    ])
  ),
  ['null repeat count', value => (value.repeatCount = null)],
  ...['waitTimeForChangeWord', 'spaceCooldownTime', 'wordReviewRatio'].flatMap(field =>
    ['1', null, -1].map(bad => [`${field} rejects ${JSON.stringify(bad)}`, value => (value[field] = bad)])
  ),
  ...['waitTimeForChangeWord', 'spaceCooldownTime'].map(field => [
    `${field} rejects signed 32-bit overflow`,
    value => (value[field] = 2147483648),
  ]),
  ...['fsrsEasyLimit', 'fsrsGoodLimit', 'fsrsHardLimit'].flatMap(field =>
    ['0', -1, 1.5, null, Number.MAX_SAFE_INTEGER + 1].map(bad => [
      `${field} rejects ${JSON.stringify(bad)}`,
      value => (value[field] = bad),
    ])
  ),
  [
    'inverted easy/good FSRS limits',
    value => {
      value.fsrsEasyLimit = 4
      value.fsrsGoodLimit = 2
    },
  ],
  [
    'inverted good/hard FSRS limits',
    value => {
      value.fsrsGoodLimit = 8
      value.fsrsHardLimit = 3
    },
  ],
  [
    'inverted easy/hard FSRS limits',
    value => {
      value.fsrsEasyLimit = 5
      value.fsrsHardLimit = 1
    },
  ],
  ...[
    'wordSoundVolume',
    'sentenceSoundVolume',
    'articleSoundVolume',
    'keyboardSoundVolume',
    'effectSoundVolume',
  ].flatMap(field =>
    ['100', null, -1, 101].map(bad => [`${field} rejects ${JSON.stringify(bad)}`, value => (value[field] = bad)])
  ),
  ...['wordSoundSpeed', 'sentenceSoundSpeed', 'articleSoundSpeed'].flatMap(field =>
    ['1', null, 0, -1].map(bad => [`${field} rejects ${JSON.stringify(bad)}`, value => (value[field] = bad)])
  ),
  ['missing shortcuts', value => delete value.shortcutKeyMap],
  ['null shortcuts', value => (value.shortcutKeyMap = null)],
  ['non-string shortcut', value => (value.shortcutKeyMap = { Next: 42 })],
  ['null font sizes', value => (value.fontSize = null)],
  ['non-numeric font size', value => (value.fontSize = { wordForeignFontSize: '48' })],
  ['non-array voices', value => (value.ttsVoiceMap = {})],
  ['null voice entry', value => (value.ttsVoiceMap = [null])],
  ['non-string voice name', value => (value.ttsVoiceMap = [{ key: 'win+edge', voice: 42 }])],
  ...[
    ['null container', null],
    ['array container', []],
    ['string retention', { request_retention: '0.9' }],
    ['zero retention', { request_retention: 0 }],
    ['negative retention', { request_retention: -0.1 }],
    ['retention above one', { request_retention: 1.1 }],
    ['null retention', { request_retention: null }],
    ['string interval', { maximum_interval: '36500' }],
    ['zero interval', { maximum_interval: 0 }],
    ['negative interval', { maximum_interval: -1 }],
    ['sub-day interval', { maximum_interval: 0.5 }],
    ['null interval', { maximum_interval: null }],
    ['string fuzz flag', { enable_fuzz: 'false' }],
    ['numeric short-term flag', { enable_short_term: 1 }],
    ['null weights', { w: null }],
    ['object weights', { w: {} }],
    ['empty weights', { w: [] }],
    ['unsupported weights length', { w: Array(18).fill(1) }],
    ['string weight', { w: [...Array(20).fill(1), '1'] }],
    ['null weight', { w: [...Array(20).fill(1), null] }],
    ['null learning steps', { learning_steps: null }],
    ['object relearning steps', { relearning_steps: {} }],
    ['numeric step', { learning_steps: [1] }],
    ['null step', { relearning_steps: [null] }],
    ['invalid step unit', { learning_steps: ['1s'] }],
    ['negative step', { relearning_steps: ['-1m'] }],
    ['malformed step', { learning_steps: ['1oopsm'] }],
    ['non-finite step', { learning_steps: ['Infinitym'] }],
    ['overflowing step', { relearning_steps: [`${'9'.repeat(309)}d`] }],
  ].map(([label, parameters]) => [
    `FSRS parameters ${label}`,
    value => (value.fsrsParameters = structuredClone(parameters)),
  ]),
]
