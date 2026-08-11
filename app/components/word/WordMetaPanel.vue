<script setup lang="ts">
/**
 * WordMetaPanel — 只读元信息面板
 *
 * 从 TypeWord 拆出，负责纯展示（不承载输入逻辑）：
 * - 音标行（phonetic0/phonetic1 + 发音 VolumeIcon）
 * - 翻译区（TranslationList）
 * - 例句列表（ClickableEnglishText + VolumeIcon 只读展示）
 * - 短语列表
 * - 近义词 / 词源 / 关联词
 */
import type { Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import ClickableEnglishText from '@/components/word/ClickableEnglishText.vue'
import ClickableWord from '@/components/word/ClickableWord.vue'
import { Toast, VolumeIcon } from '@/base'
import { useI18n } from 'vue-i18n'
import TranslationList from '@/components/word/TranslationList.vue'
import TypingSentence from '~/components/practice-sentences/TypingSentence.vue'
import type { PracticeViewState } from '@/core/composables/practice-words/practice-flow-types.ts'
import { useEventsByWatch } from '@/core/utils/eventBus.ts'
import { SENTENCE_PLAY_SHORTCUT_KEYS, ShortcutKey } from '@/core'
import { WordPracticeType } from '@/core/types/enum.ts'
import { computed } from 'vue'
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { getBrowserKey, useTTsPlayAudio } from '@/core/hooks/sound.ts'

const { t: $t } = useI18n()

interface IProps {
  word: Word
  effective: PracticeViewState
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
})

const emit = defineEmits<{
  complete: []
  wrong: []
}>()

const settingStore = useSettingStore()
const router = useRouter()
const ttsPlayAudio = useTTsPlayAudio()
let highlightedSentenceIndex = $ref(-1)
let ttsVoiceHintShown = false
const showDetails = computed(
  () =>
    props.effective.revealAll ||
    [WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(props.effective.practiceType)
)
const showTranslation = computed(() => props.effective.revealAll || props.effective.isShowTranslate)
const showEtymology = computed(
  () =>
    props.effective.revealAll ||
    (props.effective.practiceType === WordPracticeType.FollowWrite &&
      !props.effective.isWordMasked &&
      props.effective.isShowTranslate)
)
let activeSentenceIndex = $ref(-1)
let sentenceRefMap = new Map()
function setRef(index, el) {
  if (el) {
    sentenceRefMap.set(index, el)
  }
}

useEventsByWatch(
  SENTENCE_PLAY_SHORTCUT_KEYS.map((key, index) => [key, () => noticePlaySentence(index)]),
  () => (props.word.sentences?.length ?? 0) > 0
)

function noticePlaySentence(index: number) {
  if (index < 0 || index >= props.word.sentences.length) return
  sentenceRefMap.get(index)?.play?.()
}

function playTtsWithGuide(text: string, onEnd?: () => void) {
  if (!ttsVoiceHintShown) {
    const hasVoice = settingStore.ttsVoiceMap?.some(v => v.key === getBrowserKey() && v.voice)
    if (!hasVoice) {
      ttsVoiceHintShown = true
      const ins = Toast.warning(
        '例句默认使用浏览器内置 TTS 发音，若无声请前往「设置 → 音效设置 → TTS 声色」选择可用声色',
        {
          duration: 10000,
          action: {
            text: '设置',
            onClick: () => {
              router.push('/setting?index=4')
              ins.close()
            },
          },
        }
      )
    }
  }
  ttsPlayAudio(text, {
    onEnd,
    volume: settingStore.sentenceSoundVolume / 100,
    rate: settingStore.sentenceSoundSpeed,
  })
}

function playSentence(index: number, options?: { highlight?: boolean }) {
  const text = props.word.sentences?.[index]?.c
  if (!text) return
  const wordKey = props.word.word
  const highlight = options?.highlight ?? false
  if (highlight) highlightedSentenceIndex = index
  playTtsWithGuide(text, () => {
    if (props.word.word === wordKey && highlight && highlightedSentenceIndex === index) {
      highlightedSentenceIndex = -1
    }
  })
}

watch(
  () => props.word.word,
  () => {
    highlightedSentenceIndex = -1
    sentenceRefMap = new Map<any, any>()
  }
)

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

defineExpose({ startPracticeSentence, playSentence })
</script>

<template>
  <div class="word-meta">
    <!-- 翻译区 -->
    <template v-if="word?.trans?.length">
      <div class="translate flex flex-col items-center gap-2 my-2" v-opacity:noAnim="showTranslation">
        <TranslationList :word="word" :showFull="!effective.isWordMasked" />
      </div>
    </template>

    <!-- 例句列表 -->
    <template v-if="word?.sentences?.length">
      <div v-opacity="showDetails">
        <div class="line-white my-2"></div>
        <div
          class="sentence-typing"
          :class="{
            'sentence-highlight': highlightedSentenceIndex === j || activeSentenceIndex === j,
          }"
          v-for="(i, j) in word.sentences"
          :key="i.c"
        >
          <TypingSentence
            :ref="el => setRef(j, el)"
            :key="i.c"
            :index="j"
            :sentence="i"
            :isHighlightWordsMask="effective.isWordMasked"
            :showSentenceTranslation="showTranslation"
            :active="activeSentenceIndex === j"
            :highlight-words="[word.word.toLowerCase()]"
            @complete="onCompleteSentence"
            @play="playSentence(j, { highlight: true })"
          />
        </div>
      </div>
    </template>

    <!-- 短语列表 -->
    <template v-if="word?.phrases?.length">
      <div v-opacity="showDetails">
        <div class="line-white my-2"></div>
        <div class="flex">
          <div class="label">{{ $t('phrases') }}</div>
          <div class="flex flex-col">
            <div class="flex items-center gap-4" v-for="(item, index) in word.phrases" :key="index">
              <div class="flex gap-space items-center">
                <ClickableEnglishText class="en" :text="item.c" :word="word.word" :dictation="effective.isWordMasked" />
                <VolumeIcon :simple="false" title="发音" @click.stop="() => playTtsWithGuide(item.c)" />
              </div>
              <div class="anim" v-opacity="showTranslation">
                {{ item.cn }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 近义词 -->
    <template v-if="word?.synos?.length">
      <div v-opacity="showDetails">
        <div class="line-white my-2"></div>
        <div class="flex">
          <div class="label">{{ $t('synonyms') }}</div>
          <div class="flex flex-col gap-3">
            <div class="flex" v-for="item in word.synos">
              <div class="pos en">{{ item.pos }}</div>
              <div>
                <div v-opacity="showTranslation">
                  {{ item.cn }}
                </div>
                <div>
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
        <div v-opacity="showEtymology">
          <div class="line-white my-2"></div>
          <div class="flex">
            <div class="label">{{ $t('etymology') }}</div>
            <div>
              <div v-for="item in word.etymology">
                <div>{{ item.t }}</div>
                <div>{{ item.d }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="word?.relWords?.root">
        <div v-opacity="showEtymology">
          <div class="line-white my-2"></div>
          <div class="flex">
            <div class="label">{{ $t('related_words') }}</div>
            <div class="flex flex-col">
              <div v-if="word.relWords.root">
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

  .label {
    width: 7rem;
    padding-top: 0.2rem;
    flex-shrink: 0;
  }

  .sentence {
    @apply rounded-lg px-3 py-2 -mx-3;
    background: transparent;
    transition:
      background-color 0.3s ease,
      box-shadow 0.3s ease;
  }

  .sentence-typing {
    @apply rounded-lg px-3 py-1 -mx-3;
    background: transparent;
    transition:
      background-color 0.3s ease,
      box-shadow 0.3s ease;
  }

  .sentence-highlight {
    background: color-mix(in srgb, var(--color-link) 10%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 25%, transparent);
  }
}

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
