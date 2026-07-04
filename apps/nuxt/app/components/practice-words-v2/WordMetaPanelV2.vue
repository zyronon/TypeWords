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
import type { Word } from '@typewords/core/types/types.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import { ShortcutKey, WordPracticeType } from '@typewords/core/types/enum.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import SentenceHightLightWord from '@typewords/core/components/word/SentenceHightLightWord.vue'
import ClickableEnglishText from '@typewords/core/components/word/ClickableEnglishText.vue'
import ClickableWord from '@typewords/core/components/word/ClickableWord.vue'
import { VolumeIcon } from '@typewords/base'
import { useI18n } from 'vue-i18n'
import TranslationList from '@typewords/core/components/word/TranslationList.vue'

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

interface DisplayPolicy {
  showSentences: boolean
  showSentenceTranslation: boolean
  showWordTranslation: boolean
  showPhrases: boolean
  showEtymology: boolean
  showRelWords: boolean
  showPhoneticShadow: boolean
  dictation: boolean
  translate: boolean
}

interface IProps {
  word: Word
  effective: DisplayPolicy
  showFullWord: boolean
  showWordResult: boolean
  /** 当前例句高亮索引 */
  highlightedSentenceIndex: number
  /** 外部注入的 playSentence 函数 */
  playSentence: (index: number, opts?: { highlight?: boolean }) => void
  /** 外部注入的 playTtsWithGuide 函数 */
  playTtsWithGuide: (text: string) => void
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  showFullWord: false,
  showWordResult: false,
  highlightedSentenceIndex: -1,
  effective: () => ({
    showSentences: true,
    showSentenceTranslation: true,
    showWordTranslation: true,
    showPhrases: true,
    showEtymology: true,
    showRelWords: true,
    showPhoneticShadow: false,
    dictation: false,
    translate: true,
  }),
  playSentence: () => {},
  playTtsWithGuide: () => {},
})

const emit = defineEmits<{
  volumeIconClick: []
}>()

const settingStore = useSettingStore()

function getSentenceShortcut(index: number) {
  const key = SENTENCE_PLAY_SHORTCUT_KEYS[index]
  return key ? settingStore.shortcutKeyMap[key] : ''
}

defineExpose({
  // 由父组件通过 template ref 获取 VolumeIcon 的 DOM ref
})
</script>

<template>
  <div class="word-meta">
    <!-- 音标 + 发音按钮 -->
    <div class="flex gap-1">
      <div
        class="phonetic"
        :class="(effective.showPhoneticShadow && !showFullWord && !showWordResult && 'word-shadow')"
        v-if="settingStore.soundType === 'uk' && word.phonetic0"
      >
        / {{ word.phonetic0 }} /
      </div>
      <div
        class="phonetic"
        :class="(effective.showPhoneticShadow && !showFullWord && !showWordResult && 'word-shadow')"
        v-if="settingStore.soundType === 'us' && word.phonetic1"
      >
        / {{ word.phonetic1 }} /
      </div>
      <slot name="volumeIcon" />
    </div>

    <!-- 翻译区 -->
    <div
      class="translate flex flex-col gap-2 my-3"
      v-opacity="effective.showWordTranslation || showWordResult || showFullWord"
      :style="{
        fontSize: settingStore.fontSize.wordTranslateFontSize + 'px',
      }"
    >
      <TranslationList :word="word" :showFull="!effective.dictation || showWordResult || showFullWord" />
    </div>

    <!-- 例句 / 短语 / 词源 -->
    <div
      class="other anim"
      v-opacity="effective.showSentences"
    >
      <!-- 例句列表 -->
      <template v-if="word?.sentences?.length">
        <div class="line-white my-3"></div>
        <div
          class="sentence"
          :class="{
            'sentence-highlight': highlightedSentenceIndex === index,
          }"
          v-for="(item, index) in word.sentences"
          :key="index"
        >
          <div class="flex gap-space text-xl">
            <ClickableEnglishText
              :text="item.c"
              :word="word.word"
              :dictation="!(!effective.dictation || showFullWord || showWordResult)"
            />
            <VolumeIcon
              :title="getSentenceShortcut(index) ? `发音(${getSentenceShortcut(index)})` : '发音'"
              :simple="false"
              @click.stop="() => playSentence(index)"
            />
          </div>
          <div class="text-base anim" v-opacity="effective.showSentenceTranslation || showFullWord || showWordResult">
            {{ item.cn }}
          </div>
        </div>
      </template>

      <!-- 短语列表 -->
      <template v-if="word?.phrases?.length">
        <div class="line-white my-3"></div>
        <div class="flex">
          <div class="label">{{ $t('phrases') }}</div>
          <div class="flex flex-col">
            <div class="flex items-center gap-4" v-for="(item, index) in word.phrases" :key="index">
              <div class="flex gap-space items-center">
                <ClickableEnglishText
                  class="en"
                  :text="item.c"
                  :word="word.word"
                  :dictation="!(!effective.dictation || showFullWord || showWordResult)"
                />
                <VolumeIcon :simple="false" title="发音" @click.stop="() => playTtsWithGuide(item.c)" />
              </div>
              <div class="cn anim" v-opacity="effective.showSentenceTranslation || showFullWord || showWordResult">
                {{ item.cn }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 近义词 -->
      <template v-if="effective.showPhrases || effective.showEtymology || effective.showRelWords">
        <template v-if="word?.synos?.length">
          <div class="line-white my-3"></div>
          <div class="flex">
            <div class="label">{{ $t('synonyms') }}</div>
            <div class="flex flex-col gap-3">
              <div class="flex" v-for="item in word.synos">
                <div class="pos line-height-1.4rem!">{{ item.pos }}</div>
                <div>
                  <div class="cn anim" v-opacity="effective.showSentenceTranslation || showFullWord || showWordResult">
                    {{ item.cn }}
                  </div>
                  <div class="anim" v-opacity="!effective.dictation || showFullWord || showWordResult">
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
      </template>

      <!-- 词源 / 关联词 -->
      <div
        class="anim"
        v-opacity="
          ((effective.showEtymology || effective.showRelWords) || showFullWord || showWordResult) &&
          settingStore.showEtymologyAndRelWords
        "
      >
        <template v-if="word?.etymology?.length">
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

        <template v-if="word?.relWords?.root">
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
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.word-meta {
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
    transition: all .3s;
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
