import type { Article, Sentence } from '../types'
import { Baidu, Translator, translateTextsBatch } from '@/libs'
import { TranslateEngine } from '../types'

export function getSentenceAllTranslateText(article: Article) {
  return article.sections
    .map(v =>
      v
        .map(s => s.translate.trim())
        .filter(v => v)
        .join(' \n')
    )
    .filter(v => v)
    .join(' \n\n')
}

export function getSentenceAllText(article: Article) {
  return article.sections
    .map(v =>
      v
        .map(s => s.text)
        .filter(v => v)
        .join('\n')
    )
    .filter(v => v)
    .join('\n\n')
}

/***
 * @desc
 * @param article 文章实体
 * @param translateEngine 翻译引擎
 * @param allShow 是否翻译完所有之后才显示
 * @param progressCb 进度回调
 * */
export async function getNetworkTranslate(
  article: Article,
  translateEngine: TranslateEngine,
  allShow: boolean = false,
  progressCb?: (val: number) => void
) {
  //本地模型走整篇批量翻译。
  //逐句循环时每个请求都要重跑一遍完整 prompt，一篇文章几百句就是几百次 prefill，
  //prompt 开销远大于输出本身，本地推理上这个浪费会被放大得非常明显
  if (translateEngine === TranslateEngine.LocalLLM) {
    const sentences: Sentence[] = article.sections.flat()
    if (!article.titleTranslate) {
      const [titleTranslate] = await translateTextsBatch([article.title], 'en', 'zh-CN')
      article.titleTranslate = titleTranslate || ''
    }
    const results = await translateTextsBatch(
      sentences.map(s => s.text),
      'en',
      'zh-CN',
      { onProgress: progressCb }
    )
    results.forEach((v, i) => {
      if (v) sentences[i].translate = v
    })
    article.textTranslate = getSentenceAllTranslateText(article)
    return
  }

  let translator: Translator
  if (translateEngine === TranslateEngine.Baidu) {
    translator = new Baidu({
      config: {
        appid: '',
        key: '',
      },
    }) as any
  }

  if (translator) {
    if (!article.titleTranslate) {
      translator.translate(article.title, 'en', 'zh-CN').then(r => {
        article.titleTranslate = r.trans.paragraphs[0]
      })
    }

    let promiseList = []
    let retryCount = 0
    let retryCountMap = new Map()

    const translate = async (sentence: Sentence) => {
      try {
        let r = await translator.translate(sentence.text, 'en', 'zh-CN')
        console.log(r)

        if (r) {
          const cb = () => {
            sentence.translate = r.trans.paragraphs[0]
            if (!allShow) {
              //一次显示所有，顺序会乱
              article.textTranslate += sentence.translate + '\n'
            }
          }
          return Promise.resolve(cb)
        } else {
          return Promise.reject(() => translate(sentence))
        }
      } catch (e) {
        return Promise.reject(() => translate(sentence))
      }
    }

    let total = 0
    let index = 0
    article.sections.map(v => (total += v.length))

    for (let i = 0; i < article.sections.length; i++) {
      let v = article.sections[i]
      for (let j = 0; j < v.length; j++) {
        let sentence = v[j]
        let promise = translate(sentence)
        if (allShow) {
          promiseList.push(promise)
        } else {
          retryCountMap.set(sentence.text, 0)
          let errResult: any
          let cb = await promise.catch(err => {
            errResult = err
          })

          while (errResult) {
            let count = retryCountMap.get(sentence.text)
            if (count > 2) break
            cb = await errResult().catch(err => {
              errResult = err
            })
            retryCountMap.set(sentence.text, count + 1)
          }
          if (cb) cb()
          index++
          if (progressCb) {
            progressCb(Math.floor((index / total) * 100))
          }
        }
      }
    }

    if (promiseList.length) {
      let timer: any = -1
      let progress = 0
      if (progressCb) {
        timer = setInterval(() => {
          progress++
          if (progress > 90) {
            return clearInterval(timer)
          }
          progressCb(progress)
        }, 100)
      }

      return new Promise(async resolve => {
        let cbs = []
        do {
          if (retryCount > 2) {
            return resolve(true)
          }
          let results = await Promise.allSettled(promiseList)
          promiseList = []
          results.map(results => {
            if (results.status === 'fulfilled') {
              cbs.push(results.value)
            } else {
              promiseList.push(results.reason())
            }
          })
          retryCount++
        } while (promiseList.length)
        cbs.map(v => v())
        article.textTranslate = getSentenceAllTranslateText(article)

        if (progressCb) {
          clearInterval(timer)
          progress = 100
          progressCb(100)
        }
        resolve(true)
      })
    } else {
      article.textTranslate = getSentenceAllTranslateText(article)
    }
  }
}
