<script setup lang="ts">
/**
 * WordMetaPanelV2 — 只读元信息面板
 *
 * 从 TypeWordV2 拆出，负责纯展示（不承载输入逻辑）：
 * - 音标行（phonetic0/phonetic1 + 发音 VolumeIcon）
 * - 翻译区（TranslationList）
 * - 例句列表（ClickableEnglishText + VolumeIcon 只读展示）
 * - 短语列表
 * - 近义词 / 词源 / 关联词
 */
import type { Sentence, Word } from '@typewords/core/types/types.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import { ShortcutKey, WordPracticeType } from '@typewords/core/types/enum.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import SentenceHightLightWord from '@typewords/core/components/word/SentenceHightLightWord.vue'
import ClickableEnglishText from '@typewords/core/components/word/ClickableEnglishText.vue'
import ClickableWord from '@typewords/core/components/word/ClickableWord.vue'
import { Toast, VolumeIcon } from '@typewords/base'
import { useI18n } from 'vue-i18n'
import TranslationList from '@typewords/core/components/word/TranslationList.vue'
import TypingSentence from '~/components/practice-sentences/TypingSentence.vue'
import type { EffectiveDisplay } from '~/composables/practice-words/registry-types.ts'

const SENTENCE_PLAY_SHORTCUT_KEYS = [
  ShortcutKey.PlaySentence1,
  ShortcutKey.PlaySentence2,
  ShortcutKey.PlaySentence3,
  ShortcutKey.PlaySentence4,
  ShortcutKey.PlaySentence5,
  ShortcutKey.PlaySentence6,
  ShortcutKey.PlaySentence7,
  ShortcutKey.PlaySentence8,
  ShortcutKey.PlaySentence9,
] as const

const { t: $t } = useI18n()

interface IProps {
  word: Word
  effective: EffectiveDisplay
  /** 当前例句高亮索引 */
  highlightedSentenceIndex: number
  /** 外部注入的 playSentence 函数 */
  playSentence: (index: number, opts?: { highlight?: boolean }) => void
  /** 外部注入的 playTtsWithGuide 函数 */
  playTtsWithGuide: (text: string) => void
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  highlightedSentenceIndex: -1,
  playSentence: () => {},
  playTtsWithGuide: () => {},
})

const emit = defineEmit('complete')

const settingStore = useSettingStore()

function getSentenceShortcut(index: number) {
  const key = SENTENCE_PLAY_SHORTCUT_KEYS[index]
  return key ? settingStore.shortcutKeyMap[key] : ''
}

let sentenceIndex = $ref(-1)

function onCompleteSentence() {
  if (sentenceIndex < props.word.sentences.length - 1) {
    sentenceIndex++
  } else {
    sentenceIndex = -1
    emit('complete')
    // Toast.success('句子练习完成')
  }
}

function startPracticeSentence() {
  sentenceIndex = 0
}

defineExpose({ startPracticeSentence })
</script>

<template>
  <div class="word-meta">
    <!-- 翻译区 -->
    <div
      class="translate flex flex-col items-center gap-2 my-3"
      v-if="effective.showWordTranslation"
      :style="{
        fontSize: settingStore.fontSize.wordTranslateFontSize + 'px',
      }"
    >
      <TranslationList :word="word" :showFull="!effective.showWordMask" />
    </div>

    <!-- 例句列表 -->
    <template v-if="word?.sentences?.length && effective.showSentences">
      <div class="line-white my-3"></div>
      <div
        class="sentence-typing"
        :class="{
          'sentence-highlight': highlightedSentenceIndex === j || sentenceIndex === j,
        }"
        v-for="(i, j) in word.sentences"
        :key="i.c"
      >
        <TypingSentence
          :key="i.c"
          :index="j"
          :sentence="i"
          :isHighlightWordsMask="effective.showWordMask"
          :active="sentenceIndex === j"
          :highlight-words="[word.word]"
          @complete="onCompleteSentence"
          @play="playSentence(j)"
        />
      </div>
    </template>

    <!-- 短语列表 -->
    <template v-if="word?.phrases?.length && effective.showPhrases">
      <div class="line-white my-3"></div>
      <div class="flex">
        <div class="label">{{ $t('phrases') }}</div>
        <div class="flex flex-col">
          <div class="flex items-center gap-4" v-for="(item, index) in word.phrases" :key="index">
            <div class="flex gap-space items-center">
              <ClickableEnglishText class="en" :text="item.c" :word="word.word" :dictation="effective.showWordMask" />
              <VolumeIcon :simple="false" title="发音" @click.stop="() => playTtsWithGuide(item.c)" />
            </div>
            <div class="cn anim" v-opacity="effective.showSentenceTranslation">
              {{ item.cn }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 近义词 -->
    <template v-if="effective.showSynos && word?.synos?.length">
      <div class="line-white my-3"></div>
      <div class="flex">
        <div class="label">{{ $t('synonyms') }}</div>
        <div class="flex flex-col gap-3">
          <div class="flex" v-for="item in word.synos">
            <div class="pos line-height-1.4rem!">{{ item.pos }}</div>
            <div>
              <div class="cn anim" v-opacity="effective.showSentenceTranslation">
                {{ item.cn }}
              </div>
              <div class="anim" v-opacity="!effective.showWordMask">
                <template v-for="(i, j) in item.ws" :key="j">
                  <ClickableWord :word="i" />
                  <span v-if="j !== item.ws.length - 1"> / </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 词源 / 关联词 -->
    <template class="anim" v-if="settingStore.showEtymologyAndRelWords">
      <template v-if="word?.etymology?.length && effective.showEtymology">
        <div class="line-white my-3"></div>
        <div class="flex">
          <div class="label">{{ $t('etymology') }}</div>
          <div class="text-base">
            <div class="mb-2" v-for="item in word.etymology">
              <div class="">{{ item.t }}</div>
              <div class="">{{ item.d }}</div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="word?.relWords?.root && effective.showRelWords">
        <div class="line-white my-3"></div>
        <div class="flex">
          <div class="label">{{ $t('related_words') }}</div>
          <div class="flex flex-col gap-3">
            <div v-if="word.relWords.root" class=" ">
              {{ $t('word_root') }}：<ClickableWord class="en" :word="word.relWords.root" />
            </div>
            <div class="flex" v-for="item in word.relWords.rels">
              <div class="pos">{{ item.pos }}</div>
              <div>
                <div class="flex items-center gap-4" v-for="itemj in item.words">
                  <ClickableWord class="en" :word="itemj.c" />
                  <div class="cn">{{ itemj.cn }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped lang="scss">
.word-meta {
  width: 100%;
  .phonetic {
    color: var(--color-font-1);
    font-family: var(--word-font-family);
    font-size: 1.2rem;
  }

  .translate {
    font-size: 1.2rem;
  }

  .label {
    width: 6rem;
    padding-top: 0.2rem;
    flex-shrink: 0;
  }

  .cn {
    @apply text-base;
  }

  .en {
    @apply text-lg;
  }

  .pos {
    @apply min-w-10;
  }

  .sentence {
    @apply rounded-lg px-3 py-2 -mx-3;
    background: transparent;
    transition: all 0.3s;
  }
  .sentence-typing {
    @apply rounded-lg px-3 pb-1 -mx-3;
    background: transparent;
    transition: all 0.3s;
  }

  .sentence-highlight {
    background: rgba(124, 58, 237, 0.1);
    box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.25);
  }
}

// 移动端适配
@media (max-width: 768px) {
  .word-meta {
    .label {
      @apply w-unset mr-2;
    }
    :deep(.pos) {
      @apply w-unset mr-2 min-w-unset;
    }
  }
}
</style>
