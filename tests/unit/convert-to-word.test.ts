import { describe, expect, it } from 'vitest'
import { convertToWord } from '@/core/utils'

describe('convertToWord', () => {
  it('parses Windows line breaks in custom word fields', () => {
    const word = convertToWord({
      word: 'clarification',
      trans: 'n.澄清，阐明；净化',
      sentences:
        'I am seeking clarification of the regulations.\r\n我正在努力弄清楚这些规则。\r\n\r\nThe second one needs some clarification.\r\n第二项承诺需要进行一些说明。',
      phrases: 'clarification on\r\n解答',
      synos: 'n.澄清，说明；净化\r\nexplanation/notes/purification',
      relWords: '词根:clarify\r\n\r\nadj.\r\nclarified:澄清的；透明的',
      etymology: 'clarification:\r\n说明',
    })

    expect(word.sentences).toEqual([
      {
        c: 'I am seeking clarification of the regulations.',
        cn: '我正在努力弄清楚这些规则。',
      },
      {
        c: 'The second one needs some clarification.',
        cn: '第二项承诺需要进行一些说明。',
      },
    ])
    expect(word.phrases).toEqual([{ c: 'clarification on', cn: '解答' }])
    expect(word.synos).toEqual([
      {
        pos: 'n.',
        cn: '澄清，说明；净化',
        ws: ['explanation', 'notes', 'purification'],
      },
    ])
    expect(word.relWords).toEqual({
      root: 'clarify',
      rels: [{ pos: 'adj.', words: [{ c: 'clarified', cn: '澄清的；透明的' }] }],
    })
    expect(word.etymology).toEqual([{ t: 'clarification:', d: '说明' }])
  })
})
