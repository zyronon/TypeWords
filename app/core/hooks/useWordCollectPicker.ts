import { reactive } from 'vue'
import type { Word } from '../types'

export const wordCollectPickerState = reactive({
  visible: false,
  word: null as Word | null,
  excludeDictId: '',
  x: 0,
  y: 0,
  creating: false,
  newDictName: '',
})

function updatePosition(anchor: HTMLElement | { x: number; y: number }) {
  if (anchor instanceof HTMLElement) {
    const rect = anchor.getBoundingClientRect()
    wordCollectPickerState.x = rect.left + rect.width / 2
    wordCollectPickerState.y = rect.bottom + 8
  } else {
    wordCollectPickerState.x = anchor.x
    wordCollectPickerState.y = anchor.y
  }
}

export function closeWordCollectPicker() {
  wordCollectPickerState.visible = false
  wordCollectPickerState.creating = false
  wordCollectPickerState.newDictName = ''
  wordCollectPickerState.word = null
  wordCollectPickerState.excludeDictId = ''
}

export function openWordCollectPicker(word: Word, anchor: HTMLElement, options?: { excludeDictId?: string }) {
  wordCollectPickerState.word = word
  wordCollectPickerState.excludeDictId = options?.excludeDictId ?? ''
  wordCollectPickerState.creating = false
  wordCollectPickerState.newDictName = ''
  updatePosition(anchor)
  wordCollectPickerState.visible = true
}

export function useWordCollectPicker() {
  return {
    state: wordCollectPickerState,
    open: openWordCollectPicker,
    close: closeWordCollectPicker,
  }
}
