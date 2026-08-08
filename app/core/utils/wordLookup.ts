import nlp from 'compromise/three'

export function stripWordPunctuation(word: string): string {
  return word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
}

export function normalizeWordForLookup(raw: string): string[] {
  const cleaned = stripWordPunctuation(raw.trim())
  if (!cleaned) return []

  const candidates = new Set<string>()
  candidates.add(cleaned)
  candidates.add(cleaned.toLowerCase())

  try {
    const doc = nlp(cleaned)
    if (doc.verbs().found) {
      candidates.add(doc.verbs().toInfinitive().text())
    }
    if (doc.nouns().found) {
      candidates.add(doc.nouns().toSingular().text())
    }
  } catch {
    // compromise 解析失败时仅使用原始候选
  }

  return Array.from(candidates).filter(Boolean)
}

export function splitEnglishText(text: string): { text: string; isWord: boolean }[] {
  if (!text) return []
  const tokens: { text: string; isWord: boolean }[] = []
  const regex = /[a-zA-Z]+(?:'[a-zA-Z]+)?|[^a-zA-Z]+/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const token = match[0]
    tokens.push({ text: token, isWord: /[a-zA-Z]/.test(token) })
  }
  return tokens
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getWordRegexes(word: string): RegExp[] {
  const normalized = word.trim().toLowerCase()
  if (!normalized) return []
  const escaped = escapeRegExp(normalized)
  const patterns = [
    `\\b${escaped}\\b`,
    `\\b${escaped}s\\b`,
    `\\b${escaped}es\\b`,
    `\\b${escaped}ed\\b`,
    `\\b${escaped}ing\\b`,
  ]
  return Array.from(new Set(patterns)).map(pattern => new RegExp(pattern, 'gi'))
}

/** 判断单个 token 是否为目标单词（含常见变形），逻辑与 SentenceHightLightWord 一致 */
export function isHighlightToken(token: string, highlightWord: string): boolean {
  if (!highlightWord.trim()) return false
  const regexes = getWordRegexes(highlightWord)
  return regexes.some(regex => {
    regex.lastIndex = 0
    return regex.test(token)
  })
}

/** 生成与 SentenceHightLightWord 相同的高亮 HTML */
export function buildHighlightedHtml(
  text: string,
  highlightWord: string,
  options: { highLight?: boolean; dictation?: boolean } = {}
): string {
  if (!text || !highlightWord) return text

  const classNames = [
    options.highLight !== false ? 'highlight-word' : '',
    options.dictation ? 'word-shadow' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const wrap = (match: string) => `<span class="${classNames}">${match}</span>`

  return getWordRegexes(highlightWord).reduce((result, regex) => result.replace(regex, wrap), text)
}
