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
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import ClickableEnglishText from '@typewords/core/components/word/ClickableEnglishText.vue'
import ClickableWord from '@typewords/core/components/word/ClickableWord.vue'
import { VolumeIcon } from '@typewords/base'
import { useI18n } from 'vue-i18n'
import TranslationList from '@typewords/core/components/word/TranslationList.vue'
import TypingSentence from '~/components/practice-sentences/TypingSentence.vue'
import type { EffectiveDisplay } from '~/composables/practice-words/practice-flow-types.ts'
import { useEventsByWatch } from '@typewords/core/utils/eventBus.ts'
import { SENTENCE_PLAY_SHORTCUT_KEYS, ShortcutKey } from '@typewords/core'

const { t: $t } = useI18n()

interface IProps {
  word: Word
  effective: EffectiveDisplay
  highlightedSentenceIndex: number
  playSentence: (index: number, options?: { highlight?: boolean }) => void
  playTtsWithGuide: (text: string, onEnd?: () => void) => void
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
})

const emit = defineEmits<{
  complete: []
  wrong: []
}>()

const settingStore = useSettingStore()
let activeSentenceIndex = $ref(-1)
const sentenceRef = useTemplateRef('sentences')

useEventsByWatch(
  SENTENCE_PLAY_SHORTCUT_KEYS.map((key, index) => [key, () => noticePlaySentence(index)]),
  () => (props.word.sentences?.length ?? 0) > 0
)

function noticePlaySentence(index: number) {
  if (index < 0 || index >= props.word.sentences.length) return
  sentenceRef.value?.[index]?.play?.()
}

function onCompleteSentence(text: string) {
  //简单比对，句子里面是否有当前单词，没有则为错
  if (!text.includes(props.word.word)) emit('wrong')
  if (activeSentenceIndex < props.word.sentences.length - 1) {
    activeSentenceIndex++
  } else {
    activeSentenceIndex = -1
    emit('complete')
    // Toast.success('句子练习完成')
  }
}

function startPracticeSentence() {
  activeSentenceIndex = 0
}

defineExpose({ startPracticeSentence })
</script>

<template>
  <div class="word-meta">
    <!-- 翻译区 -->
    <template v-if="word?.trans?.length">
      <div class="translate flex flex-col items-center gap-2 my-3" v-opacity="effective.showWordTranslation">
        <TranslationList :word="word" :showFull="!effective.isDictation" />
      </div>
    </template>

    <!-- 例句列表 -->
    <template v-if="word?.sentences?.length">
      <div v-opacity="effective.showSentences">
        <div class="line-white my-3"></div>
        <div
          class="sentence-typing"
          :class="{
            'sentence-highlight': highlightedSentenceIndex === j || activeSentenceIndex === j,
          }"
          v-for="(i, j) in word.sentences"
          :key="i.c"
        >
          <TypingSentence
            ref="sentences"
            :key="i.c"
            :index="j"
            :sentence="i"
            :isHighlightWordsMask="effective.isDictation"
            :showSentenceTranslation="effective.showSentenceTranslation"
            :active="activeSentenceIndex === j"
            :highlight-words="[word.word]"
            @complete="onCompleteSentence"
            @play="playSentence(j, { highlight: true })"
          />
        </div>
      </div>
    </template>

    <!-- 短语列表 -->
    <template v-if="word?.phrases?.length">
      <div v-opacity="effective.showPhrases">
        <div class="line-white my-3"></div>
        <div class="flex">
          <div class="label">{{ $t('phrases') }}</div>
          <div class="flex flex-col">
            <div class="flex items-center gap-4" v-for="(item, index) in word.phrases" :key="index">
              <div class="flex gap-space items-center">
                <ClickableEnglishText class="en" :text="item.c" :word="word.word" :dictation="effective.isDictation" />
                <VolumeIcon :simple="false" title="发音" @click.stop="() => playTtsWithGuide(item.c)" />
              </div>
              <div class="anim" v-opacity="effective.showSentenceTranslation">
                {{ item.cn }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 近义词 -->
    <template v-if="word?.synos?.length">
      <div v-opacity="effective.showSynos">
        <div class="line-white my-3"></div>
        <div class="flex">
          <div class="label">{{ $t('synonyms') }}</div>
          <div class="flex flex-col gap-3">
            <div class="flex" v-for="item in word.synos">
              <div class="pos en">{{ item.pos }}</div>
              <div>
                <div class="anim" v-opacity="effective.showSentenceTranslation">
                  {{ item.cn }}
                </div>
                <div class="anim" v-opacity="!effective.isDictation">
                  <template v-for="(i, j) in item.ws" :key="j">
                    <ClickableWord class="en" :word="i" />
                    <span v-if="j !== item.ws.length - 1"> / </span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 词源 / 关联词 -->
    <template v-if="settingStore.showEtymologyAndRelWords">
      <template v-if="word?.etymology?.length">
        <div v-opacity="effective.showEtymology && !effective.isDictation">
          <div class="line-white my-3"></div>
          <div class="flex">
            <div class="label">{{ $t('etymology') }}</div>
            <div class="">
              <div class="mb-2" v-for="item in word.etymology">
                <div class="">{{ item.t }}</div>
                <div class="">{{ item.d }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="word?.relWords?.root">
        <div v-opacity="effective.showRelWords && !effective.isDictation">
          <div class="line-white my-3"></div>
          <div class="flex">
            <div class="label">{{ $t('related_words') }}</div>
            <div class="flex flex-col gap-3">
              <div v-if="word.relWords.root" class=" ">
                {{ $t('word_root') }}：
                <ClickableWord class="en" :word="word.relWords.root" />
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
  }

  .label {
    width: 6rem;
    padding-top: 0.2rem;
    flex-shrink: 0;
  }

  .sentence {
    @apply rounded-lg px-3 py-2 -mx-3;
    background: transparent;
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }

  .sentence-typing {
    @apply rounded-lg px-3 py-1 -mx-3;
    background: transparent;
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }

  .sentence-highlight {
    background: color-mix(in srgb, var(--color-link) 10%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 25%, transparent);
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

@media (prefers-reduced-motion: reduce) {
  .word-meta .sentence,
  .word-meta .sentence-typing {
    transition-duration: 0.01ms;
  }
}
</style>
