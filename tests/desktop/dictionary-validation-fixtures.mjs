export const fsrsCardFixture = () => ({
  due: '2026-09-16T00:00:00.000Z',
  stability: 2,
  difficulty: 5,
  elapsed_days: 1,
  scheduled_days: 2,
  reps: 2,
  lapses: 0,
  state: 2,
  last_review: '2026-09-14T00:00:00.000Z',
})

export const dictionaryFixture = () => ({
  word: { studyIndex: 0, bookList: [{ id: 42, en_name: 'legacy', words: [{ word: 'hello' }], articles: [] }] },
  article: { studyIndex: -1, bookList: [{ words: [], articles: [{ text: 'Hello.', audioFileId: 'tone' }] }] },
  simpleWords: ['a'],
  noteData: { hello: 'A note' },
  fsrsData: { hello: fsrsCardFixture() },
})

export const invalidDictionaries = [
  ['missing section', value => delete value.word],
  ['null book list', value => (value.word.bookList = null)],
  ['invalid selection', value => (value.word.studyIndex = 1)],
  ['fractional selection', value => (value.word.studyIndex = 0.5)],
  ['null book', value => (value.word.bookList[0] = null)],
  ['invalid words', value => (value.word.bookList[0].words = {})],
  ['invalid word entry', value => (value.word.bookList[0].words = [{ word: 42 }])],
  ['empty word identifier', value => (value.word.bookList[0].words = [{ word: '' }])],
  ['invalid articles', value => (value.article.bookList[0].articles = null)],
  ['invalid article entry', value => (value.article.bookList[0].articles = [{ text: null }])],
  ['invalid translation', value => (value.article.bookList[0].articles = [{ text: 'Hello.', textTranslate: [] }])],
  ['invalid simple words', value => (value.simpleWords = [42])],
  ['invalid notes', value => (value.noteData = { hello: null })],
  ['invalid FSRS container', value => (value.fsrsData = [])],
  ...[
    ['null card', () => null],
    ['array card', () => []],
    [
      'missing due',
      card => {
        delete card.due
        return card
      },
    ],
    ['invalid due', card => ({ ...card, due: 'not-a-date' })],
    ['null due', card => ({ ...card, due: null })],
    ['object due', card => ({ ...card, due: {} })],
    ['invalid last review', card => ({ ...card, last_review: 'invalid' })],
    ['invalid state', card => ({ ...card, state: 4 })],
    ['fractional state', card => ({ ...card, state: 1.5 })],
    ['unknown state name', card => ({ ...card, state: 'Unknown' })],
    ['negative stability', card => ({ ...card, stability: -1 })],
    [
      'missing stability',
      card => {
        delete card.stability
        return card
      },
    ],
    ['string difficulty', card => ({ ...card, difficulty: '5' })],
    ['excessive difficulty', card => ({ ...card, difficulty: 11 })],
    ['negative elapsed days', card => ({ ...card, elapsed_days: -1 })],
    ['null scheduled days', card => ({ ...card, scheduled_days: null })],
    ['fractional reps', card => ({ ...card, reps: 1.5 })],
    ['negative lapses', card => ({ ...card, lapses: -1 })],
    ['invalid learning steps', card => ({ ...card, learning_steps: '1' })],
  ].map(([label, mutate]) => [`FSRS ${label}`, value => (value.fsrsData = { hello: mutate(fsrsCardFixture()) })]),
]
