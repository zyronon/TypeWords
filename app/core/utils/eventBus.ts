import mitt from 'mitt'
import { onMounted, onUnmounted, watch } from 'vue'

export const emitter = mitt()
export const EventKey = {
  resetWord: 'resetWord',
  openStatModal: 'openStatModal',
  openWordListModal: 'openWordListModal',
  closeOther: 'closeOther',
  keydown: 'keydown',
  keyup: 'keyup',
  onTyping: 'onTyping',
  repeatStudy: 'repeatStudy',
  continueStudy: 'continueStudy',
  write: 'write',
  editDict: 'editDict',
  openMyDictDialog: 'openMyDictDialog',
  stateInitEnd: 'stateInitEnd',
}

export function useEvents(arrs: any[]) {
  onMounted(() => {
    arrs.map(arr => emitter.on(arr[0], arr[1]))
  })

  onUnmounted(() => {
    arrs.map(arr => emitter.off(arr[0], arr[1]))
  })
}

//特定条件才监听
export function useEventsByWatch(arrs: any[], watchVal: any) {
  watch(
    watchVal,
    newVal => {
      if (newVal) {
        arrs.map(arr => emitter.on(arr[0], arr[1]))
      } else {
        arrs.map(arr => emitter.off(arr[0], arr[1]))
      }
    },
    {
      immediate: true,
    }
  )

  onUnmounted(() => {
    arrs.map(arr => emitter.off(arr[0], arr[1]))
  })
}
