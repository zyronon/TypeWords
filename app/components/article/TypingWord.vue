<script setup lang="tsx">
import { useSettingStore } from '@/core/stores/setting.ts'
import Space from './Space.vue'

import { PracticeArticleWordType } from '@/core/types'
import type { ArticleWord } from '@/core/types'
import { watchEffect } from 'vue'

const props = defineProps<{
  word: ArticleWord
  isTyping: boolean
  isHighLight?: boolean
}>()
const settingStore = useSettingStore()

function compare(a: string, b: string) {
  return settingStore.ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b
}

const isHide = $computed(() => {
  if (settingStore.dictation && props.word.type === PracticeArticleWordType.Word) return 'hide'
  return ''
})

const isHighLight = $computed(() => {
  if (props.isHighLight && props.word.type === PracticeArticleWordType.Word) return 'highlight-word'
  return ''
})

const classNames = $computed(() => {
  return [isHide, isHighLight]
})

const list = $computed(() => {
  let t = []
  let right = ''
  let wrong = ''
  if (props.word.input.length) {
    if (props.word.input.length === props.word.word.length) {
      if (
        settingStore.ignoreCase
          ? props.word.input.toLowerCase() === props.word.word.toLowerCase()
          : props.word.input === props.word.word
      ) {
        t.push({ type: 'word-complete', val: props.word.input })
        return t
      }
    }
    props.word.input.split('').forEach((k, i) => {
      if (k === ' ') {
        right = wrong = ''
        t.push({ type: 'space' })
      } else {
        if (compare(k, props.word.word[i])) {
          right += k
          wrong = ''
          if (t.length) {
            let last = t[t.length - 1]
            if (last.type === 'input-right') {
              last.val = right
            } else {
              t.push({ type: 'input-right', val: right })
            }
          } else {
            t.push({ type: 'input-right', val: right })
          }
        } else {
          wrong += k
          right = ''
          if (t.length) {
            let last = t[t.length - 1]
            if (last.type === 'input-wrong') {
              last.val = wrong
            } else {
              t.push({ type: 'input-wrong', val: wrong })
            }
          } else {
            t.push({ type: 'input-wrong', val: wrong })
          }
        }
      }
    })
    if (props.word.input.length < props.word.word.length) {
      t.push({ type: 'word-end', val: props.word.word.slice(props.word.input.length) })
    }
  } else {
    //word-end这个class用于光标定位，光标会定位到第一个word-end的位置
    t.push({ type: 'word-end', val: props.word.word })
  }
  return t
})

defineRender(() => {
  return list.map((item, i) => {
    if (item.type === 'word-complete') {
      return <span className={isHighLight}>{item.val}</span>
    }
    if (item.type === 'word-end') {
      return <span className={'word-end ' + classNames.join(' ')}>{item.val}</span>
    }
    if (item.type === 'input-right') {
      return <span className={props.isTyping && 'input-right'}>{item.val}</span>
    }
    if (item.type === 'input-wrong') {
      return <span className="input-wrong">{item.val}</span>
    }
    if (item.type === 'space') {
      return <Space isWrong={true} />
    }
  })
})
</script>

<style scoped lang="scss">
.input-right {
  color: var(--color-select-bg);
}

.input-wrong {
  @apply color-red;
}

.hide {
  opacity: 0;
}
</style>
