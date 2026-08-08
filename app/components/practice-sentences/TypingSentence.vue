<script setup lang="ts">
/**
 * TypingSentence — 句子练习包装组件
 */
import { Toast, VolumeIcon } from '@/base'
import { useSettingStore } from '@/core/stores/setting.ts'
import type { ArticleWord, Sentence, WordSubContent } from '@/core/types/types.ts'
import { getDefaultSentence } from '@/core/types/func.ts'
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import { useI18n } from 'vue-i18n'
import TypingSentenceItem from './TypingSentenceItem.vue'
import { parseSentence } from '@/core/hooks/article.ts'
import { SENTENCE_PLAY_SHORTCUT_KEYS } from '@/core'

const { t: $t } = useI18n()

interface IProps {
  /** 要练习的句子 */
  sentence: WordSubContent
  /** 是否激活键盘监听 */
  active?: boolean
  showSentenceTranslation?: boolean
  index: number
  /** 需要高亮标注的词列表 */
  highlightWords?: string[]
}

const props = withDefaults(defineProps<IProps>(), {
  showSentenceTranslation: true,
  active: false,
  highlightWords: () => [],
})

const emit = defineEmits<{
  complete: [text: string]
  play: []
}>()

const settingStore = useSettingStore()
let data = $ref<Sentence>(getDefaultSentence())

const itemRef = $ref<InstanceType<typeof TypingSentenceItem>>()

// ============ 右键菜单 ============

function onContextMenu(e: MouseEvent, word: ArticleWord, wordIndex: number) {
  e.preventDefault()
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      // todo 后续优化
      // {
      //   label: $t('collect_word'),
      //   onClick: () => {
      //     let text = word.word
      //     let doc = nlp(text)
      //     // 优先判断是不是动词
      //     if (doc.verbs().found) {
      //       text = doc.verbs().toInfinitive().text()
      //     }
      //     // 如果是名词（复数 → 单数）
      //     if (doc.nouns().found) {
      //       text = doc.nouns().toSingular().text()
      //     }
      //     if (!text.length) text = word.word
      //
      //
      //     setTimeout(() => {
      //       openWordCollectPicker(getDefaultWord({ word: text, id: nanoid() }), { x: e.x, y: e.y + 15 })
      //     }, 300)
      //   },
      // },
      {
        label: $t('copy'),
        children: [
          {
            label: $t('copy_sentence'),
            onClick: () => {
              navigator.clipboard.writeText(data.text).then(() => {
                Toast.success($t('copied'))
              })
            },
          },
          {
            label: $t('copy_word'),
            onClick: () => {
              navigator.clipboard.writeText(word.word).then(() => {
                Toast.success($t('copied'))
              })
            },
          },
        ],
      },
      {
        label: $t('play_sentence'),
        onClick: play,
      },
      {
        label: $t('grammar_analysis'),
        onClick: () => {
          navigator.clipboard.writeText(data.text).then(() => {
            Toast.success($t('copied_open_grammar'))
            setTimeout(() => {
              window.open('https://enpuz.com/')
            }, 1000)
          })
        },
      },
      {
        label: $t('youdao_translate'),
        children: [
          {
            label: $t('translate_word'),
            onClick: () => {
              window.open(`https://www.youdao.com/result?word=${word.word}&lang=en`, '_blank')
            },
          },
          {
            label: $t('translate_sentence'),
            onClick: () => {
              window.open(`https://www.youdao.com/result?word=${data.text}&lang=en`, '_blank')
            },
          },
        ],
      },
    ],
  })
}

// ============ 播放 ============
let volumeIconRef = useTemplateRef('volumeIcon')
function play() {
  volumeIconRef.value.animate()
  emit('play')
}

function init() {
  data = {
    text: props.sentence.c,
    translate: props.sentence.cn,
    words: parseSentence(props.sentence.c),
    audioPosition: [0, 0],
  }
  data.words.map(s => {
    s.input = ''
  })
}

function getSentenceShortcut(index: number) {
  const key = SENTENCE_PLAY_SHORTCUT_KEYS[index]
  return key ? settingStore.shortcutKeyMap[key] : ''
}

onMounted(init)
defineExpose({
  play,
  reset: () => itemRef?.reset(),
  del: () => itemRef?.del(),
  getItemRef: () => itemRef,
})
</script>

<template>
  <div class="typing-sentence" :class="[active ? 'active' : 'display']">
    <div class="flex items-start gap-2">
      <TypingSentenceItem
        ref="itemRef"
        :sentence="data"
        :active="active"
        :isPractice="active"
        :play="play"
        :isHighlightWordsMask="$attrs.isHighlightWordsMask"
        :highlight-words="highlightWords"
        :dictation="settingStore.dictation"
        @complete="e => emit('complete', e)"
        @context-menu="e => onContextMenu(e.event, e.word, e.wordIndex)"
      />
      <VolumeIcon
        ref="volumeIcon"
        class="ml-1"
        :title="getSentenceShortcut(index) ? `发音(${getSentenceShortcut(index)})` : '发音'"
        @click="emit('play')"
      />
    </div>
    <div v-if="data.translate" v-opacity="showSentenceTranslation" class="mb-1">
      {{ data.translate }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.typing-sentence {
  position: relative;

  &.display {
    :deep(.sentence-item) {
      color: unset;
      font-family: unset;
    }
  }

  &.active {
    :deep(.sentence-item) {
      font-size: 1.3em;
    }
  }
}
</style>
