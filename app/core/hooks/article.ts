import type { Article, Sentence } from '../types'
import { getDefaultArticleWord, getDefaultDict, PracticeArticleWordType } from '../types'
import { _nextTick, cloneDeep, ensureCustomDictCopy } from '../utils'
import { usePlayWordAudio, useTTsPlayAudio } from './sound'
import { getSentenceAllText, getSentenceAllTranslateText } from './translate'
import { useBaseStore } from '../stores/base'
import { useRuntimeStore } from '../stores/runtime'
import { useSettingStore } from '../stores/setting'

export function parseSentence(sentence: string) {
  // 先统一一些常见的“智能引号” -> 直引号，避免匹配问题
  sentence = sentence
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // 各种单引号 → '
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // 各种双引号 → "

  const len = sentence.length
  const tokens = []
  let i = 0

  while (i < len) {
    const ch = sentence[i]

    // 跳过空白（但不把空白作为 token）
    if (/\s/.test(ch)) {
      i++
      continue
    }

    const rest = sentence.slice(i)

    // 1) 货币 + 数字（$1,000.50 或 ¥200 或 €100.5）
    let m = rest.match(/^[\$¥€£]\d{1,3}(?:,\d{3})*(?:\.\d+)?%?/)
    if (m) {
      tokens.push({ word: m[0], start: i, end: i + m[0].length, type: PracticeArticleWordType.Number })
      i += m[0].length
      continue
    }

    // 2) 数字/小数/百分比（100% 3.14 1,000.00）
    m = rest.match(/^\d{1,3}(?:,\d{3})*(?:\.\d+)?%?/)
    if (m) {
      tokens.push({ word: m[0], start: i, end: i + m[0].length, type: PracticeArticleWordType.Number })
      i += m[0].length
      continue
    }

    // 3) 带点缩写或多段缩写（U.S. U.S.A. e.g. i.e. Ph.D.）
    m = rest.match(/^[A-Za-z]+(?:\.[A-Za-z]+)+\.?/)
    if (m) {
      tokens.push({ word: m[0], start: i, end: i + m[0].length, type: PracticeArticleWordType.Word })
      i += m[0].length
      continue
    }

    // 4) 单词（包含撇号/连字符，如 it's, o'clock, we'll, mother-in-law）
    m = rest.match(/^[A-Za-z0-9]+(?:[\'\-][A-Za-z0-9]+)*/)
    if (m) {
      tokens.push({ word: m[0], start: i, end: i + m[0].length, type: PracticeArticleWordType.Word })
      i += m[0].length
      continue
    }

    // 5) 其它可视符号（标点）——单字符处理（连续标点会被循环拆为单字符）
    //    包括：.,!?;:"'()-[]{}<>/\\@#%^&*~`等非单词非空白字符
    if (/[^\w\s]/.test(ch)) {
      tokens.push({ word: ch, start: i, end: i + 1, type: PracticeArticleWordType.Symbol })
      i += 1
      continue
    }

    // 6) 回退方案：把当前字符当作一个 token（防止意外丢失）
    tokens.push({ word: ch, start: i, end: i + 1, type: PracticeArticleWordType.Symbol })
    i += 1
  }

  // 计算 nextSpace：查看当前 token 的 end 到下一个 token 的 start 之间是否含空白
  const result = tokens.map((t, idx) => {
    const next = tokens[idx + 1]
    const between = next ? sentence.slice(t.end, next.start) : sentence.slice(t.end)
    const nextSpace = /\s/.test(between)
    return getDefaultArticleWord({ word: t.word, nextSpace, type: t.type })
  })

  return result
}

//生成文章段落数据
export function genArticleSectionData(article: Article): number {
  let text = article.text.trim()
  let sections: Sentence[][] = []
  text
    .split('\n\n')
    .filter(Boolean)
    .map((sectionText, i) => {
      let section: Sentence[] = []
      sections.push(section)
      sectionText
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((item, i, arr) => {
          item = item.trim()
          //如果没有空格，导致修改一行一行的数据时，汇总时全没有空格了，库无法正常断句
          //所以要保证最后一个是空格，但防止用户打N个空格，就去掉再加上一个空格，只需要一个即可
          //2025/10/1:最后一句不需要空格
          if (i < arr.length - 1) item += ' '
          let sentence: Sentence = cloneDeep({
            text: item,
            translate: '',
            words: parseSentence(item),
            audioPosition: [0, 0],
          })
          section.push(sentence)
        })
    })

  sections = sections.filter(v => v.length)
  article.sections = sections

  let failCount = 0
  let translateList = article.textTranslate?.split('\n\n') || []
  for (let i = 0; i < article.sections.length; i++) {
    let v = article.sections[i]
    let sList = []
    try {
      let s = translateList[i]
      sList = s.split('\n')
    } catch (e) {}

    for (let j = 0; j < v.length; j++) {
      let sentence = v[j]
      try {
        let trans = sList[j]
        if (trans.trim()) {
          sentence.translate = trans
        } else {
          failCount++
        }
      } catch (e) {
        failCount++
        // console.log('没有对应的翻译', sentence.text)
      }
    }
  }

  text = getSentenceAllText(article)
  let translate = getSentenceAllTranslateText(article)

  article.text = text
  article.textTranslate = translate

  let count = 0
  if (article?.lrcPosition?.length) {
    article.sections.map((v, i) => {
      v.map((w, j) => {
        w.audioPosition = article?.lrcPosition?.[count]
        count++
      })
    })
  }
  return failCount
}

export function splitEnArticle2(text: string): string {
  text = text.trim()
  if (!text && false) {
    //     text = `It was Sunday. I never get up early on Sundays. I sometimes stay in bed until lunchtime. Last Sunday I got up very late. I looked out of the window. It was dark outside. 'What a day!' I thought. 'It's raining again. ' Just then, the telephone rang. It was my aunt Lucy. 'I've just arrived by train, ' she said. 'I'm coming to see you. '
    //
    // 'But I'm still having breakfast, ' I said.
    // 'What are you doing?' she asked.
    // 'I'm having breakfast, ' I repeated.
    // 'Dear me,$3.000' she said. 'Do you always get up so late? It's one o'clock!'`
    //     text = `While it is yet to be seen what direction the second Trump administration will take globally in its China policy, VOA traveled to the main island of Mahe in Seychelles to look at how China and the U.S. have impacted the country, and how each is fairing in that competition for influence there.`
    // text = "It was Sunday. I never get up early on Sundays. I sometimes stay in bed until lunchtime. Last Sunday I got up very late. I looked out of the window. It was dark outside. 'What a day!' I thought. 'It's raining again.' Just then, the telephone rang. It was my aunt Lucy. 'I've just arrived by train,' she said. 'I'm coming to see you.'\n\n     'But I'm still having breakfast,' I said.\n\n     'What are you doing?' she asked.\n\n     'I'm having breakfast,' I repeated.\n\n     'Dear me,' she said. 'Do you always get up so late? It's one o'clock!'"
  }

  if (!text) return ''

  const abbreviations = [
    'Mr',
    'Mrs',
    'Ms',
    'Dr',
    'Prof',
    'Sr',
    'Jr',
    'St',
    'Co',
    'Ltd',
    'Inc',
    'e.g',
    'i.e',
    'U.S.A',
    'U.S',
    'U.K',
    'etc',
  ]

  function isSentenceEnd(text, idx) {
    const before = text.slice(0, idx + 1)
    const after = text.slice(idx + 1)

    const abbrevPattern = new RegExp('\\b(' + abbreviations.join('|') + ')\\.$', 'i')
    if (abbrevPattern.test(before)) return false
    if (/\d+\.$/.test(before)) return false
    if (/\d+\.\d/.test(text.slice(idx - 1, idx + 2))) return false
    if (/%/.test(after)) return false
    if (/[\$¥€]\d/.test(before + after)) return false

    return true
  }

  function normalizeQuotes(text) {
    const isWord = ch => /\w/.test(ch)
    let res = []
    let singleOpen = false
    let doubleOpen = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === "'") {
        const prev = i > 0 ? text[i - 1] : ''
        const nxt = i + 1 < text.length ? text[i + 1] : ''
        if (isWord(prev) && isWord(nxt)) {
          res.push("'")
          continue
        }
        if (singleOpen) {
          if (res.length && res[res.length - 1] === ' ') res.pop()
          res.push("'")
          singleOpen = false
        } else {
          res.push("'")
          singleOpen = true
        }
      } else if (ch === '"') {
        if (doubleOpen) {
          if (res.length && res[res.length - 1] === ' ') res.pop()
          res.push('"')
          doubleOpen = false
        } else {
          res.push('"')
          doubleOpen = true
        }
      } else {
        res.push(ch)
      }
    }
    return res.join('')
  }

  let rawParagraphs = text.replaceAll('\n\n', '`^`').replaceAll('\n', '').split('`^`')

  const formattedParagraphs = rawParagraphs.map(p => {
    p = p.trim()
    if (!p) return ''

    p = p.replace(/\n/g, ' ')
    p = normalizeQuotes(p)

    const tentative: string[] = p.match(/[^.!?。！？]+[.!?。！？'"”’)]*/g) || []

    const sentences = []
    tentative.forEach(segment => {
      segment = segment.trim()
      if (!segment) return

      const lastCharIdx = segment.length - 1
      if (/[.!?。！？]/.test(segment[lastCharIdx])) {
        const globalIdx = p.indexOf(segment)
        if (!isSentenceEnd(p, globalIdx + segment.length - 1)) {
          if (sentences.length > 0) {
            sentences[sentences.length - 1] += ' ' + segment
          } else {
            sentences.push(segment)
          }
          return
        }
      }
      sentences.push(segment)
    })

    const finalSentences = []
    let i = 0
    while (i < sentences.length) {
      let cur = sentences[i]
      if (i + 1 < sentences.length) {
        const nxt = sentences[i + 1]
        if (/['"”’)\]]$/.test(cur) && /^[a-z]|^(I|You|She|He|They|We)\b/i.test(nxt)) {
          finalSentences.push(cur + ' ' + nxt)
          i += 2
          continue
        }
      }
      finalSentences.push(cur)
      i += 1
    }

    return finalSentences.join('\n')
  })

  return formattedParagraphs.filter(p => p).join('\n\n')
}

export function splitCNArticle2(text: string): string {
  if (!text && false) {
    // text = "飞机误点了，侦探们在机场等了整整一上午。他们正期待从南非来的一个装着钻石的贵重包裹。数小时以前，有人向警方报告，说有人企图偷走这些钻石。当飞机到达时，一些侦探等候在主楼内，另一些侦探则守候在停机坪上。有两个人把包裹拿下飞机，进了海关。这时两个侦探把住门口，另外两个侦探打开了包裹。令他们吃惊的是，那珍贵的包裹里面装的全是石头和沙子！"
    //     text = `那是个星期天，而在星期天我是从来不早起的，有时我要一直躺到吃午饭的时候。上个星期天，我起得很晚。我望望窗外，外面一片昏暗。“鬼天气！”我想，“又下雨了。”正在这时，电话铃响了。是我姑母露西打来的。“我刚下火车，”她说，“我这就来看你。”
    // “但我还在吃早饭，”我说。
    // “你在干什么？”她问道。
    // “我正在吃早饭，”我又说了一遍。
    // “天啊，”她说，“你总是起得这么晚吗？现在已经1点钟了！”`
    //     text = `上星期我去看戏。我的座位很好，戏很有意思，但我却无法欣赏。一青年男子与一青年女子坐在我的身后，大声地说着话。我非常生气，因为我听不见演员在说什么。我回过头去怒视着那一男一女，他们却毫不理会。最后，我忍不住了，又一次回过头去，生气地说：“我一个字也听不见了！”
    // “不关你的事，”那男的毫不客气地说，“这是私人间的谈话！”`
  }
  const segmenterJa = new Intl.Segmenter('zh-CN', { granularity: 'sentence' })

  let sectionTextList = text.replaceAll('\n\n', '`^`').replaceAll('\n', '').split('`^`')

  let s = sectionTextList
    .filter(v => v)
    .map((rowSection, i) => {
      const segments = segmenterJa.segment(rowSection)
      let ss = ''
      Array.from(segments).map(sentenceRow => {
        let row = sentenceRow.segment
        if (row) {
          //这个库总是会把反引号给断句到上一行末尾
          //而 sentence-splitter 这个库总是会把反引号给断句到下一行开头
          if (row[row.length - 1] === '“') {
            row = row.substring(0, row.length - 1)
            ss += row + '\n' + '“'
          } else {
            ss += row + '\n'
          }
        }
      })
      return ss
    })
    .join('\n')
    .trim()
  return s
}

export function usePlaySentenceAudio() {
  const playWordAudio = usePlayWordAudio()
  let timer = 0
  let onEndCb = null

  function playSentenceAudio(sentence: Sentence, ref?: HTMLAudioElement, onEnd?: () => void) {
    if (sentence.audioPosition?.length && ref && ref.src) {
      if (onEndCb) {
        onEndCb()
        onEndCb = null
      }
      clearTimeout(timer)
      onEndCb = () => onEnd?.()
      ref.onerror = onEndCb
      if (ref.played) {
        ref.pause()
      }
      let start = sentence.audioPosition[0]
      // ref.volume = settingStore.wordSoundVolume / 100
      ref.currentTime = start
      ref.play()
      let end = sentence.audioPosition?.[1]
      // console.log(sentence.audioPosition,(end - start) * 1000)

      if (end && end !== -1) {
        timer = setTimeout(
          () => {
            ref.pause()
            onEndCb()
          },
          ((end - start) / ref.playbackRate) * 1000
        )
      } else {
        ref.onended = onEndCb
      }
    } else {
      playWordAudio(sentence.text, false, onEnd)
    }
  }

  return { playSentenceAudio }
}

export interface ArticleTextAudio {
  text: string
  start?: number
  end?: number
}

function hasValidArticleTextAudioPosition(target: ArticleTextAudio) {
  if (target.start === undefined || target.start === null) return false
  let start = Number(target.start)
  let end = Number(target.end)
  return Number.isFinite(start) && (end === -1 || (Number.isFinite(end) && end > start))
}

export function usePlayArticleTextAudio() {
  const settingStore = useSettingStore()
  const ttsPlayAudio = useTTsPlayAudio()
  let timer: ReturnType<typeof setTimeout> | undefined

  function playArticleTextAudio(target: ArticleTextAudio, ref?: HTMLAudioElement) {
    if (!target.text) return
    clearTimeout(timer)

    if (hasValidArticleTextAudioPosition(target) && ref?.src) {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
      ref.pause()
      let start = Number(target.start)
      ref.volume = settingStore.articleSoundVolume / 100
      ref.playbackRate = settingStore.articleSoundSpeed
      ref.currentTime = start
      ref.play()

      let end = Number(target.end)
      if (Number.isFinite(end) && end !== -1) {
        timer = setTimeout(
          () => {
            ref.pause()
          },
          ((end - start) / ref.playbackRate) * 1000
        )
      }
      return
    }

    if (ref?.src) ref.pause()
    ttsPlayAudio(target.text, {
      rate: settingStore.articleSoundSpeed,
      volume: settingStore.articleSoundVolume / 100,
    })
  }

  return {
    playArticleTextAudio,
  }
}

//todo 考虑与syncDictInMyStudyList、changeDict方法合并
export function syncBookInMyStudyList(study = false) {
  _nextTick(() => {
    const base = useBaseStore()
    const runtimeStore = useRuntimeStore()
    const originalId = runtimeStore.editDict.id
    let temp = ensureCustomDictCopy(runtimeStore.editDict)
    let rIndex = base.article.bookList.findIndex(v => v.id === originalId)
    temp.length = temp.articles.length
    runtimeStore.editDict = temp
    if (rIndex > -1) {
      base.article.bookList[rIndex] = getDefaultDict(temp)
      if (study) base.article.studyIndex = rIndex
    } else {
      base.article.bookList.push(getDefaultDict(temp))
      if (study) base.article.studyIndex = base.article.bookList.length - 1
    }
  }, 100)
}
