<script setup lang="ts">
/**
 * TypingSentence — 句子练习包装组件
 *
 * 基于 TypingSentenceItem，增加：
 * - 发音按钮（可选）
 * - 句子翻译显示（默写模式）
 * - 右键菜单（收藏/复制/翻译/语法/从此处开始）
 */
import { Toast, VolumeIcon } from '@typewords/base'
import { openWordCollectPicker } from '@typewords/core/hooks/useWordCollectPicker.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import type { ArticleWord, Sentence, WordSubContent } from '@typewords/core/types/types.ts'
import { getDefaultSentence, getDefaultWord } from '@typewords/core/types/func.ts'
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import nlp from 'compromise/three'
import { nanoid } from 'nanoid'
import { useI18n } from 'vue-i18n'
import TypingSentenceItem from './TypingSentenceItem.vue'
import { parseSentence } from '@typewords/core/hooks/article.ts'

const { t: $t } = useI18n()

interface IProps {
  /** 要练习的句子 */
  sentence: WordSubContent
  /** 是否激活键盘监听 */
  active?: boolean
  /** 需要高亮标注的词列表 */
  highlightWords?: string[]
}

const props = withDefaults(defineProps<IProps>(), {
  active: false,
  highlightWords: () => [],
})

const emit = defineEmits<{
  complete: []
  play: [
    val: {
      sentence: Sentence
      handle: boolean
    },
  ]
}>()

const settingStore = useSettingStore()
let data = $ref<Sentence>(getDefaultSentence())

const itemRef = $ref<InstanceType<typeof TypingSentenceItem>>()

// ============ 右键菜单 ============

function onContextMenu(e: MouseEvent, word: ArticleWord, wordIndex: number) {
  e.preventDefault()
  const sentence = props.sentence
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: $t('collect_word'),
        onClick: () => {
          let text = word.word
          let doc = nlp(text)
          // 优先判断是不是动词
          if (doc.verbs().found) {
            text = doc.verbs().toInfinitive().text()
          }
          // 如果是名词（复数 → 单数）
          if (doc.nouns().found) {
            text = doc.nouns().toSingular().text()
          }
          if (!text.length) text = word.word
          openWordCollectPicker(getDefaultWord({ word: text, id: nanoid() }), { x: e.x, y: e.y })
        },
      },
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
        onClick: () => {
          emit('play', { sentence: data, handle: true })
        },
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

function play(handle: boolean = true) {
  emit('play', { sentence: data, handle })
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

onMounted(init)
defineExpose({
  play,
  reset: () => itemRef?.reset(),
  del: () => itemRef?.del(),
  getItemRef: () => itemRef,
})
</script>

<template>
  <div class="typing-sentence">
    <div class="flex items-center gap-2">
      <TypingSentenceItem
        ref="itemRef"
        :sentence="data"
        :active="active"
        :highlight-words="highlightWords"
        :dictation="settingStore.dictation"
        @complete="emit('complete')"
        @play="play($event.handle)"
        @context-menu="e => onContextMenu(e.event, e.word, e.wordIndex)"
      />
      <VolumeIcon class="ml-1" title="发音" :cb="() => play(true)" />
    </div>
    <div v-if="data.translate" class="sentence-translate">
      {{ data.translate }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.typing-sentence {
  position: relative;

  .sentence-translate {
    margin-top: -0.5rem;
    font-size: 1.2rem;
    letter-spacing: 0.2rem;
    font-family: var(--zh-article-family);
    font-weight: bold;
    //color: #818181;
  }
}
</style>
