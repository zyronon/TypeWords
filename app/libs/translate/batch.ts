import { LocalLLM, langName } from './local-llm'
import type { LocalLLMConfig } from './local-llm'
import type { Language } from './translator'

/**
 * 整篇批量翻译。
 *
 * 为什么需要它：
 *   getNetworkTranslate() 是「一句一个请求」的循环。走云端 API 无所谓，
 *   但走本地模型时每个请求都要重跑一遍完整 prompt —— 一篇文章 200 句就是 200 次 prefill，
 *   prompt 开销远大于输出本身。
 *
 *   Hy-MT2 官方明确支持「分隔符保留」和「结构化数据翻译」两类翻译指令，
 *   所以可以整篇一次发过去，用编号当分隔符，让它按编号逐行返回。
 *   一篇文章从 200 次请求降到 5 次左右。
 */

const DELIM = '|||'

/** 只认「行首编号 + 分隔符」，避免把 prompt 里的说明文字误当成译文行 */
const DELIM_LINE_RE = new RegExp('^(\\d+)\\s*' + DELIM.replace(/\|/g, '\\|') + '\\s*(.*)$')

export interface BatchTranslateOptions extends LocalLLMConfig {
  /** 每次请求塞多少句。太大容易截断或串行，太小失去意义。默认 40 */
  chunkSize?: number
  /** 进度回调 0-100 */
  onProgress?: (percent: number) => void
}

/**
 * 批量翻译。返回数组长度与入参一致，个别句失败时该位为空字符串，不影响其它句。
 */
export async function translateTextsBatch(
  texts: string[],
  from: Language,
  to: Language,
  options: BatchTranslateOptions = {}
): Promise<string[]> {
  const { chunkSize = 40, onProgress, ...config } = options
  const engine = new LocalLLM({ config })
  const result: string[] = new Array(texts.length).fill('')

  if (!texts.length) return result

  let done = 0

  for (let start = 0; start < texts.length; start += chunkSize) {
    const chunk = texts.slice(start, start + chunkSize)

    try {
      const answers = await translateChunk(engine, chunk, from, to, config)
      answers.forEach((v, i) => {
        if (start + i < texts.length) result[start + i] = v
      })
    } catch {
      // 整块失败 → 降级成逐句重试，尽量不丢内容
      for (let i = 0; i < chunk.length; i++) {
        try {
          const r = await engine.translate(chunk[i], from, to)
          result[start + i] = r.trans.paragraphs.join('\n')
        } catch {
          result[start + i] = ''
        }
      }
    }

    done += chunk.length
    onProgress?.(Math.round((done / texts.length) * 100))
  }

  return result
}

async function translateChunk(
  engine: LocalLLM,
  chunk: string[],
  from: Language,
  to: Language,
  config: LocalLLMConfig
): Promise<string[]> {
  const body = chunk.map((s, i) => `${i + 1}${DELIM}${s}`).join('\n')

  const prompt = [
    `把下面编号的每一行翻译成${langName(to)}。`,
    '严格按以下规则输出：',
    `1. 每一行格式为「编号${DELIM}译文」，编号必须与原文一致，不能改、不能漏、不能多。`,
    '2. 不要输出任何解释、标题、空行或多余文字。',
    '3. 译文本身不要包含换行。',
    config.glossary?.length
      ? `4. 术语约束（必须严格按此翻译）：\n${config.glossary.map(g => '  ' + g).join('\n')}`
      : '',
    '',
    body,
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await engine.chat(prompt, config)
  return parseDelimited(raw, chunk.length)
}

/** 解析 "编号|||译文"，容忍模型少写/多写编号 */
function parseDelimited(raw: string, expect: number): string[] {
  const out: string[] = new Array(expect).fill('')
  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    const matched = DELIM_LINE_RE.exec(line)
    if (!matched) continue

    const num = Number.parseInt(matched[1], 10)
    if (!Number.isFinite(num) || num < 1 || num > expect) continue

    out[num - 1] = matched[2].trim()
  }

  // 一行都没解析出来 → 说明模型没守格式，当作整段单句处理
  if (out.every(v => !v)) out[0] = raw.trim()

  return out
}
