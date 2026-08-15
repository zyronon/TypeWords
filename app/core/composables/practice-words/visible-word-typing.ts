export interface PracticeInputCharacterState {
  character: string
  isCorrect: boolean
}

export interface PracticeKeyboardInput {
  key: string
  code: string
  shiftKey: boolean
}

const SHIFT_FULL_WIDTH_CHARACTER_CODE_MAP: Record<string, string[]> = {
  '！': ['Digit1'],
  '￥': ['Digit4'],
  '…': ['Digit6'],
  '（': ['Digit9'],
  '—': ['Minus'],
  '？': ['Slash'],
  '》': ['Period'],
  '《': ['Comma'],
  '“': ['Quote'],
  '”': ['Quote'],
  '：': ['Semicolon'],
  '）': ['Digit0'],
}

const FULL_WIDTH_CHARACTER_CODE_MAP: Record<string, string[]> = {
  '、': ['Slash'],
  '。': ['Period'],
  '，': ['Comma'],
  '‘': ['Quote'],
  '’': ['Quote'],
  '；': ['Semicolon'],
  '【': ['BracketLeft'],
  '】': ['BracketRight'],
}

export function normalizePracticeInputCharacter(event: PracticeKeyboardInput, targetCharacter = ''): string {
  const characterCodeMap = event.shiftKey ? SHIFT_FULL_WIDTH_CHARACTER_CODE_MAP : FULL_WIDTH_CHARACTER_CODE_MAP
  if (characterCodeMap[targetCharacter]?.includes(event.code)) {
    return targetCharacter
  }
  return event.key
}

export function isPracticeCharacterCorrect(input: string, target: string | undefined, ignoreCase: boolean): boolean {
  if (target === undefined) return false
  if (!ignoreCase) return input === target
  return input.localeCompare(target, undefined, { sensitivity: 'accent', usage: 'search' }) === 0
}

export function getPracticeInputCharacterStates(
  input: string,
  target: string,
  ignoreCase: boolean
): PracticeInputCharacterState[] {
  return [...input].map((character, index) => ({
    character,
    isCorrect: isPracticeCharacterCorrect(character, target[index], ignoreCase),
  }))
}

export function getFirstWrongCharacterIndex(input: string, target: string, ignoreCase: boolean): number {
  return getPracticeInputCharacterStates(input, target, ignoreCase).findIndex(item => !item.isCorrect)
}

export function isWholePracticeInputComplete(input: string, target: string): boolean {
  return input.length === target.length
}

export function isWholePracticeInputCorrect(input: string, target: string, ignoreCase: boolean): boolean {
  return isWholePracticeInputComplete(input, target) && getFirstWrongCharacterIndex(input, target, ignoreCase) === -1
}

export function getWholeInputAfterWrongBackspace(input: string, target: string, ignoreCase: boolean): string {
  const firstWrongIndex = getFirstWrongCharacterIndex(input, target, ignoreCase)
  return firstWrongIndex === -1 ? input.slice(0, -1) : input.slice(0, firstWrongIndex)
}
