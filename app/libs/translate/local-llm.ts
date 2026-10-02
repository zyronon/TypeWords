import type { Language, TranslateQueryResult } from './translator'
import { Translator, TranslateError } from './translator'

/**
 * 本地大模型翻译引擎（OpenAI 兼容 /chat/completions）
 *
 * 默认按腾讯 Hy-MT2 的调用约定实现。模型卡片上有几条硬性要求，踩了就翻不出东西：
 *  1. 模型没有默认 system_prompt，所有要求必须写在 user message 里
 *  2. 源语言/目标语言必须用全称（本文件 prompt 用中文，所以用中文全称）
 *  3. 必须显式要求「只输出译文」，否则会把原文和解释一起吐出来
 *  推荐生成参数：temperature 0.7 / top_p 0.6 / top_k 20 / repetition_penalty 1.05
 *
 * 任何 OpenAI 兼容端点都能用，改 baseURL / model 即可：
 *  llama.cpp  llama serve -hf tencent/Hy-MT2-1.8B-GGUF:Q4_K_M --port 8080
 *  ollama     ollama run hf.co/tencent/Hy-MT2-1.8B-GGUF:Q4_K_M
 *  LM Studio  http://127.0.0.1:1234
 */

/** 语言代码 → 中文全称。没命中的回退成代码本身 */
const langNameMap: [Language, string][] = [
  ['auto', '自动识别'],
  ['zh-CN', '简体中文'],
  ['zh-TW', '繁体中文'],
  ['yue', '粤语'],
  ['en', '英语'],
  ['ja', '日语'],
  ['ko', '韩语'],
  ['fr', '法语'],
  ['de', '德语'],
  ['es', '西班牙语'],
  ['pt', '葡萄牙语'],
  ['it', '意大利语'],
  ['ru', '俄语'],
  ['ar', '阿拉伯语'],
  ['th', '泰语'],
  ['vi', '越南语'],
  ['id', '印尼语'],
  ['ms', '马来语'],
  ['hi', '印地语'],
  ['tr', '土耳其语'],
  ['pl', '波兰语'],
  ['nl', '荷兰语'],
  ['uk', '乌克兰语'],
  ['cs', '捷克语'],
  ['fa', '波斯语'],
  ['he', '希伯来语'],
  ['bn', '孟加拉语'],
  ['ta', '泰米尔语'],
  ['kk', '哈萨克语'],
  ['mn', '蒙古语'],
  ['ug', '维吾尔语'],
]

export interface LocalLLMConfig {
  /** 服务根地址，不含 /v1。默认 /hymt（走 nuxt devProxy） */
  baseURL?: string
  /** 传给服务端的 model 名。llama.cpp / ollama 会忽略这个字段 */
  model?: string
  apiKey?: string
  /** 术语约束，每项一行 "原文=译文"，利用模型自带的术语约束能力锁死译法 */
  glossary?: string[]
  /** 风格控制，例如 "直译，逐词对应" / "意译，符合中文表达习惯" / "口语化" */
  style?: string
  temperature?: number
  topP?: number
  topK?: number
  repetitionPenalty?: number
  maxTokens?: number
  timeout?: number
}

const DEFAULT_CONFIG: Required<Omit<LocalLLMConfig, 'glossary' | 'style' | 'apiKey'>> & { apiKey: string } = {
  baseURL: '/hymt',
  model: 'hymt2',
  apiKey: '',
  temperature: 0.7,
  topP: 0.6,
  topK: 20,
  repetitionPenalty: 1.05,
  maxTokens: 4096,
  timeout: 120000,
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

export class LocalLLM extends Translator<LocalLLMConfig> {
  readonly name = 'local-llm'

  getSupportLanguages(): Language[] {
    return langNameMap.map(([lang]) => lang)
  }

  protected async query(
    text: string,
    from: Language,
    to: Language,
    config: LocalLLMConfig
  ): Promise<TranslateQueryResult> {
    const translated = await this.chat(buildTranslatePrompt(text, from, to, config), config)
    const originParagraphs = splitParagraphs(text)
    const transParagraphs = splitParagraphs(translated)

    return {
      text,
      from,
      to,
      origin: {
        paragraphs: originParagraphs,
      },
      trans: {
        // 段落数对不齐就整段返回，宁可少排版也不能丢内容
        paragraphs: transParagraphs.length === originParagraphs.length ? transParagraphs : [translated.trim()],
      },
    }
  }

  /** 发一条 user message 给本地模型。批量翻译也走这里 */
  async chat(prompt: string, config: LocalLLMConfig = {}): Promise<string> {
    const { baseURL, model, apiKey, temperature, topP, topK, repetitionPenalty, maxTokens, timeout } = {
      ...DEFAULT_CONFIG,
      ...config,
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const res = await this.request<ChatCompletionResponse>(`${baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      timeout,
      data: {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        top_p: topP,
        top_k: topK,
        repeat_penalty: repetitionPenalty,
        max_tokens: maxTokens,
        stream: false,
      },
    }).catch(() => {
      throw new TranslateError('NETWORK_ERROR')
    })

    const data = res.data
    if (data?.error) {
      console.error('[LocalLLM] ' + data.error.message)
      throw new TranslateError('API_SERVER_ERROR')
    }

    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new TranslateError('API_SERVER_ERROR')

    return stripModelNoise(content)
  }
}

export function buildTranslatePrompt(text: string, from: Language, to: Language, config: LocalLLMConfig = {}): string {
  const lines = [
    from === 'auto' ? `把下面这段文本翻译成${langName(to)}。` : `把下面的${langName(from)}翻译成${langName(to)}。`,
    '要求：',
    '1. 只输出译文，不要解释、不要加引号、不要重复原文。',
    '2. 保持原有的分段和换行结构。',
    '3. 人名、地名、专有名词保持通行译法。',
  ]

  if (config.style) lines.push(`4. 风格要求：${config.style}。`)
  if (config.glossary?.length) {
    lines.push('术语约束（必须严格按此翻译）：')
    config.glossary.forEach(g => lines.push(`  ${g}`))
  }

  lines.push('', '原文：', text)
  return lines.join('\n')
}

export function langName(lang: Language): string {
  return langNameMap.find(([l]) => l === lang)?.[1] || lang
}

function splitParagraphs(text: string): string[] {
  return text
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

/** 模型偶尔会带上「译文：」前缀或把整段包在引号里，清掉 */
function stripModelNoise(s: string): string {
  let out = s.trim()
  out = out.replace(/^(译文|翻译)\s*[:：]\s*/i, '')
  if (out.length > 1 && ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith('「') && out.endsWith('」')))) {
    out = out.slice(1, -1)
  }
  return out.trim()
}

export default LocalLLM
