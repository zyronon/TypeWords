const record = (value: any): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function assert(condition: boolean, field: string): asserts condition {
  if (!condition) throw new Error(`Invalid dictionary: ${field}`)
}

function validCardDate(value: any): boolean {
  if (typeof value === 'string') return value.trim() !== '' && Number.isFinite(Date.parse(value))
  if (typeof value === 'number') return Number.isFinite(value) && Number.isFinite(new Date(value).getTime())
  // Dates can originate in another realm; do not coerce arbitrary objects into dates.
  try {
    return Number.isFinite(Date.prototype.getTime.call(value))
  } catch {
    return false
  }
}

function validateCard(card: any): void {
  const field = 'fsrsData.card'
  assert(record(card), field)
  assert(validCardDate(card.due), `${field}.due`)
  if (card.last_review != null) assert(validCardDate(card.last_review), `${field}.last_review`)
  assert(
    (Number.isInteger(card.state) && card.state >= 0 && card.state <= 3) ||
      (typeof card.state === 'string' &&
        ['new', 'learning', 'review', 'relearning'].includes(card.state.toLowerCase())),
    `${field}.state`
  )
  for (const key of ['stability', 'difficulty', 'elapsed_days', 'scheduled_days']) {
    assert(typeof card[key] === 'number' && Number.isFinite(card[key]) && card[key] >= 0, `${field}.${key}`)
  }
  assert(card.difficulty <= 10, `${field}.difficulty`)
  for (const key of ['reps', 'lapses', 'learning_steps']) {
    // Pre-learning-step cards remain readable; validation must not rewrite historical records.
    if (key === 'learning_steps' && !(key in card)) continue
    assert(Number.isSafeInteger(card[key]) && card[key] >= 0, `${field}.${key}`)
  }
}

/** Shared ZIP/remote boundary; preserve legacy identifiers and omitted optional collections. */
export function validateStoredDictionary(value: any): void {
  assert(record(value), 'data')
  if ('simpleWords' in value)
    assert(
      Array.isArray(value.simpleWords) && value.simpleWords.every((word: any) => typeof word === 'string'),
      'simpleWords'
    )
  if ('noteData' in value)
    assert(record(value.noteData) && Object.values(value.noteData).every(note => typeof note === 'string'), 'noteData')
  if ('fsrsData' in value) {
    assert(record(value.fsrsData), 'fsrsData')
    for (const card of Object.values(value.fsrsData)) validateCard(card)
  }
  for (const kind of ['word', 'article']) {
    const section = value[kind]
    assert(record(section) && Array.isArray(section.bookList), kind)
    assert(
      Number.isSafeInteger(section.studyIndex) &&
        section.studyIndex >= -1 &&
        section.studyIndex < section.bookList.length,
      `${kind}.studyIndex`
    )
    for (const book of section.bookList) {
      assert(record(book) && Array.isArray(book.words) && Array.isArray(book.articles), `${kind}.book`)
      assert(
        book.words.every((word: any) => record(word) && typeof word.word === 'string' && word.word.length > 0),
        `${kind}.words`
      )
      assert(
        book.articles.every(
          (article: any) =>
            record(article) &&
            typeof article.text === 'string' &&
            (!('textTranslate' in article) || typeof article.textTranslate === 'string')
        ),
        `${kind}.articles`
      )
    }
  }
}
