<script setup lang="ts">
import { Toast, VolumeIcon } from '@typewords/base'
import { openWordCollectPicker } from '@typewords/core/hooks/useWordCollectPicker.ts'
import { usePlayBeep, usePlayKeyboardAudio, usePlayWordAudio } from '@typewords/core/hooks/sound'
import Space from '@typewords/core/components/article/Space.vue'
import TypingWord from '@typewords/core/components/article/TypingWord.vue'
import WordLookupPopover from '@typewords/core/components/word/WordLookupPopover.vue'
import { lookupWord } from '@typewords/core/hooks/useWordLookup.ts'
import { useBaseStore } from '@typewords/core/stores/base'
import { usePracticeStore } from '@typewords/core/stores/practice'
import { useRuntimeStore } from '@typewords/core/stores/runtime'
import { useSettingStore } from '@typewords/core/stores/setting'
import type { Article, ArticleWord, Sentence, Word } from '@typewords/core/types'
import { getDefaultArticle, getDefaultWord } from '@typewords/core/types/func.ts'
import { PracticeArticleWordType, ShortcutKey } from '@typewords/core/types/enum.ts'
import { _nextTick, debounce } from '@typewords/core/utils'
import { emitter, EventKey, useEvents } from '@typewords/core/utils/eventBus'
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import nlp from 'compromise/three'
import { nanoid } from 'nanoid'
import { onMounted, onUnmounted, watch } from 'vue'

import { usePracticeArticlePersistence } from '@typewords/core/composables/usePracticePersistence'
import type { PracticeArticleCache } from '@typewords/core/utils/cache'
import { genArticleSectionData } from '@typewords/core/hooks/article.ts'

interface IProps {
  article: Article
  sectionIndex?: number
  sentenceIndex?: number
  wordIndex?: number
  stringIndex?: number
  active?: boolean
  index?: number
  highlightWords?: string[]
}

const props = withDefaults(defineProps<IProps>(), {
  article: () => getDefaultArticle(),
  sectionIndex: 0,
  sentenceIndex: 0,
  wordIndex: 0,
  stringIndex: 0,
  index: 0,
  active: false,
  highlightWords: [],
})

const emit = defineEmits<{
  ignore: []
  wrong: [val: Word]
  play: [
    val: {
      sentence: Sentence
      handle: boolean
    },
  ]
  playArticleTextAudio: [
    val: {
      text: string
      start?: number
      end?: number
    },
  ]
  nextWord: [val: ArticleWord]
  complete: []
  next: []
  replay: []
}>()

let typeArticleRef = $ref<HTMLInputElement>()
let articleWrapperRef = $ref<HTMLInputElement>(null)
let sectionIndex = $ref(0)
let sentenceIndex = $ref(0)
let wordIndex = $ref(0)
let stringIndex = $ref(0)
let input = $ref('')
let wrong = $ref('')
let article = $ref(getDefaultArticle())
//是否是输入空格
let isSpace = $ref(false)
let isEnd = $ref(false)
let hoverIndex = $ref({
  sectionIndex: -1,
  sentenceIndex: -1,
  wordIndex: -1,
})
let cursor = $ref({
  top: 0,
  left: 0,
})

const currentIndex = $computed(() => {
  return `${sectionIndex}${sentenceIndex}${wordIndex}`
})

const playBeep = usePlayBeep()
const playKeyboardAudio = usePlayKeyboardAudio()
const playWordAudio = usePlayWordAudio()

const store = useBaseStore()
const settingStore = useSettingStore()
const statStore = usePracticeStore()
const runtimeStore = useRuntimeStore()
const articlePersistence = usePracticeArticlePersistence()

const savePracticeData = async () => {
  if (runtimeStore.globalLoading || isEnd) return
  runtimeStore.globalLoading = true
  try {
    await articlePersistence.save({
      practiceData: {
        sectionIndex,
        sentenceIndex,
        wordIndex,
      },
      statStoreData: statStore.$state,
    })
  } finally {
    runtimeStore.globalLoading = false
  }
}

const save = debounce(() => {
  void savePracticeData()
}, 1500)

watch([() => sectionIndex, () => sentenceIndex, () => wordIndex], ([a, b, c]) => {
  if (a !== 0 || b !== 0 || c !== 0) {
    save()
  }
})

watch([() => sectionIndex, () => sentenceIndex, () => wordIndex, () => stringIndex], ([a, b, c]) => {
  checkCursorPosition(a, b, c)
})

watch(
  () => settingStore.translate,
  () => {
    checkTranslateLocation().then(() => checkCursorPosition())
  }
)

watch(
  () => isEnd,
  n => {
    if (n) {
      _nextTick(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth',
        })
      })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
)

async function init() {
  if (!props.article.id) return
  isSpace = isEnd = false
  wrong = input = ''
  sectionIndex = 0
  sentenceIndex = 0
  wordIndex = 0
  stringIndex = 0
  article = getDefaultArticle(props.article)
  genArticleSectionData(article)
  //todo 这在直接修改不太合理
  article.sections.map(v => {
    v.map(w => {
      w.words.map(s => {
        s.input = ''
      })
    })
  })
  window.scrollTo({ top: 0 })
  _nextTick(() => {
    emit('play', { sentence: article.sections[sectionIndex][sentenceIndex], handle: false })
    if (isNameWord()) next()
  })
  checkTranslateLocation().then(() => checkCursorPosition())
}

function checkCursorPosition(a = sectionIndex, b = sentenceIndex, c = wordIndex) {
  // console.log('checkCursorPosition')
  _nextTick(() => {
    // 选中目标元素
    const currentWord = document.querySelector(
      `#article_${props.index} .section:nth-of-type(${a + 1}) .sentence:nth-of-type(${b + 1}) .word:nth-of-type(${c + 1})`
    )
    if (currentWord) {
      // 在 currentWord 内找 .word-end
      const end = currentWord.querySelector('.word-end')
      if (end) {
        // 获取 articleWrapper 的位置
        const articleRect = articleWrapperRef.getBoundingClientRect()
        const endRect = end.getBoundingClientRect()
        // 判断元素是否在视口内
        const isInViewport = endRect.top >= 0 && endRect.top <= window.innerHeight
        if (isInViewport) {
          // 如果在视口内且位置大于屏幕的0.7高度，就滚动屏幕的1/3
          if (endRect.y > window.innerHeight * 0.7) {
            window.scrollTo({
              top: document.documentElement.scrollTop + window.innerHeight * 0.3,
              behavior: 'smooth',
            })
          }
        } else {
          // 如果不在视口内，滚动到屏幕中间
          window.scrollTo({
            top: document.documentElement.scrollTop + endRect.top - window.innerHeight / 2,
            behavior: 'smooth',
          })
        }
        // 计算相对位置
        cursor = {
          top: endRect.top - articleRect.top,
          left: endRect.left - articleRect.left,
        }
      }
    }
  })
}

function checkTranslateLocation() {
  // console.log('checkTranslateLocation')
  return new Promise<void>(resolve => {
    _nextTick(() => {
      let articleRect = articleWrapperRef.getBoundingClientRect()
      article.sections.map((v, i) => {
        v.map((w, j) => {
          let location = i + '-' + j
          let wordClassName = `#article_${props.index} .word${location}`
          let word = document.querySelector(wordClassName)
          let wordRect = word.getBoundingClientRect()
          let translateClassName = `#article_${props.index} .translate${location}`
          let translate: HTMLDivElement = document.querySelector(translateClassName)

          translate.style.opacity = '1'
          translate.style.top = wordRect.top - articleRect.top + 24 + 'px'
          // @ts-ignore
          translate.firstChild.style.width = wordRect.left - articleRect.left + 'px'
          // console.log(word, wordRect.left - articleRect.left)
          // console.log('word-wordRect', wordRect)
        })
      })
      resolve()
    }, 10)
  })
}

const normalize = (s: string) => s.toLowerCase().trim()
const namePatterns = $computed(() => {
  return Array.from(
    new Set(
      (article?.nameList ?? [])
        .map(normalize)
        .filter(Boolean)
        .map(s => s.split(/\s+/).filter(Boolean))
        .flat()
        .concat(['Mr', 'Mrs', 'Ms', 'Dr', 'Miss'].map(normalize))
    )
  )
})

const isNameWord = () => {
  let currentSection = article.sections[sectionIndex]
  let currentSentence = currentSection[sentenceIndex]
  let w: ArticleWord = currentSentence.words[wordIndex]
  return w?.type === PracticeArticleWordType.Word && namePatterns.length > 0 && namePatterns.includes(normalize(w.word))
}

let isTyping = false
//专用锁，因为这个方法父级要调用
let lock = false

async function nextSentence() {
  if (lock || isEnd) return
  checkTranslateLocation()
  lock = true
  let currentSection = article.sections[sectionIndex]
  let currentSentence = currentSection[sentenceIndex]
  //这里把未输入的单词补全，因为删除时会用到input
  currentSentence.words.forEach((word, i) => {
    word.input = word.input + word.word.slice(word.input?.length ?? 0)
  })

  //todo 计得把略过的单词加上统计里面去
  // if (!store.allIgnoreWords.includes(currentWord.word.toLowerCase()) && currentWord.type === PracticeArticleWordType.Word) {
  //   statisticsStore.inputNumber++
  // }
  isSpace = false
  input = wrong = ''
  stringIndex = 0
  wordIndex = 0
  sentenceIndex++
  if (!currentSection[sentenceIndex]) {
    sentenceIndex = 0
    sectionIndex++
    if (!article.sections[sectionIndex]) {
      console.log('打完了')
      runtimeStore.globalLoading = true
      await articlePersistence.clear()
      runtimeStore.globalLoading = false
      isEnd = true
      emit('complete')
    } else {
      if (isNameWord()) next()
      emit('play', { sentence: article.sections[sectionIndex][0], handle: false })
    }
  } else {
    if (isNameWord()) next()
    emit('play', { sentence: currentSection[sentenceIndex], handle: false })
  }
  lock = false
}

const next = () => {
  isSpace = false
  input = wrong = ''
  stringIndex = 0

  let currentSection = article.sections[sectionIndex]
  let currentSentence = currentSection[sentenceIndex]
  let currentWord: ArticleWord = currentSentence.words[wordIndex]

  // 检查下一个单词是否存在
  if (wordIndex + 1 < currentSentence.words.length) {
    wordIndex++
    currentWord = currentSentence.words[wordIndex]
    //这里把未输入的单词补全，因为删除时会用到input
    currentSentence.words.slice(0, wordIndex).forEach((word, i) => {
      word.input = word.input + word.word.slice(word.input?.length ?? 0)
    })
    if (
      [PracticeArticleWordType.Symbol, PracticeArticleWordType.Number].includes(currentWord.type) &&
      settingStore.ignoreSymbol
    ) {
      next()
    } else if (isNameWord()) {
      next()
    } else {
      emit('nextWord', currentWord)
    }
  } else {
    nextSentence()
  }
}

function onTyping(e: KeyboardEvent) {
  // console.log('keyDown', e.key, e.code, e.keyCode)
  if (e.code === 'Backspace') return del()

  if (!article.sections.length) return
  if (isTyping || isEnd) return
  isTyping = true
  try {
    let currentSection = article.sections[sectionIndex]
    let currentSentence = currentSection[sentenceIndex]
    let currentWord: ArticleWord = currentSentence.words[wordIndex]
    wrong = ''

    if (isSpace) {
      if (e.code === 'Space') {
        next()
      } else {
        // 如果在第一个单词的最后一位上， 不按空格的直接输入下一个字母的话
        next()
        isTyping = false
        onTyping(e)
        // wrong = ' '
        // playBeep()
        // setTimeout(() => {
        //   wrong = ''
        //   wrong = input = ''
        // }, 500)
      }
    } else {
      // if (isNameWord(currentWord)) {
      //   isSpace = false
      //   next()
      //   isTyping = false
      //   return onTyping(e)
      // }
      let letter = e.key
      let key = currentWord.word[stringIndex]
      // console.log('key', key,)

      let isRight = false
      if (settingStore.ignoreCase) {
        isRight = key.toLowerCase() === letter.toLowerCase()
      } else {
        isRight = key === letter
      }
      if (!isRight) {
        if (currentWord.type === PracticeArticleWordType.Word) {
          emit('wrong', currentWord)
        }
        playBeep()
      }

      input += letter
      currentWord.input = input
      stringIndex++
      //单词输入完毕
      if (!currentWord.word[stringIndex]) {
        input = ''
        if (currentWord.nextSpace) {
          isSpace = true
        } else {
          next()
        }
      }
    }
    playKeyboardAudio()
    e.preventDefault()
  } catch (e) {
    //todo 上报
    articlePersistence.clear()
    init()
  } finally {
    isTyping = false
  }
}

function play(handle: boolean = true) {
  let currentSection = article.sections[sectionIndex]
  emit('play', { sentence: currentSection[sentenceIndex], handle })
}

function del() {
  if (wrong) {
    wrong = ''
  } else {
    if (isEnd) return
    if (isSpace) {
      isSpace = false
    }
    let endSentence = false
    let endWord = false
    let endString = false
    if (stringIndex === 0) {
      if (wordIndex === 0) {
        if (sentenceIndex === 0) {
          if (sectionIndex === 0) {
            return
          } else {
            endSentence = endString = endWord = true
            sectionIndex--
          }
        } else {
          endString = endWord = true
          sentenceIndex--
        }
      } else {
        endString = true
        wordIndex--
      }
    } else stringIndex--
    let currentSection = article.sections[sectionIndex]
    if (endSentence) sentenceIndex = currentSection.length - 1
    let currentSentence = currentSection[sentenceIndex]
    if (endWord) wordIndex = currentSentence.words.length - 1
    let currentWord: ArticleWord = currentSentence.words[wordIndex]
    if (endString) {
      checkTranslateLocation()
      if (currentWord.nextSpace) {
        isSpace = true
        stringIndex = currentWord.word.length
      } else {
        stringIndex = currentWord.word.length - 1
      }
    }
    input = currentWord.input = currentWord.input.slice(0, stringIndex)
    checkCursorPosition()
  }
}

function onArticleWordClick(e: MouseEvent, wordText: string) {
  lookupWord(e, wordText, playWordAudio)
}

function showSentence(i1: number = sectionIndex, i2: number = sentenceIndex, i3: number = wordIndex) {
  hoverIndex = { sectionIndex: i1, sentenceIndex: i2, wordIndex: i3 }
}

function hideSentence() {
  hoverIndex = { sectionIndex: -1, sentenceIndex: -1, wordIndex: -1 }
}

function jump(i, j, w, sentence?) {
  sectionIndex = i
  sentenceIndex = j
  //todo 这里有可能是符号，要处理下
  wordIndex = w
  stringIndex = 0
  input = wrong = ''
  isEnd = isSpace = false
  article.sections.map((v, i) => {
    v.map((w, j) => {
      w.words.map((v, k) => {
        if (i <= sectionIndex && j <= sentenceIndex && k < wordIndex) {
          v.input = v.word
        } else {
          v.input = ''
        }
      })
    })
  })
  if (sentence) {
    emit('play', { sentence: sentence, handle: false })
  }
}

function applyPracticeCache(cache: PracticeArticleCache) {
  if (!cache?.practiceData) return
  const { sectionIndex: i = 0, sentenceIndex: j = 0, wordIndex: w = 0 } = cache.practiceData
  statStore.$patch(cache.statStoreData ?? {})
  jump(i, j, w)
  _nextTick(() => {
    const sentence = article.sections?.[sectionIndex]?.[sentenceIndex]
    if (sentence) {
      emit('play', { sentence, handle: false })
    }
    checkTranslateLocation().then(() => checkCursorPosition())
  })
}


function onContextMenu(e: MouseEvent, sentence: Sentence, i, j, w) {
  const selectedText = window.getSelection().toString()
  console.log(selectedText)
  //prevent the browser's default menu
  e.preventDefault()
  //show your menu
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: $t('collect_word'),
        onClick: () => {
          let word = article.sections[i][j].words[w]
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
              navigator.clipboard.writeText(sentence.text).then(r => {
                Toast.success($t('copied'))
              })
            },
          },
          {
            label: $t('copy_word'),
            onClick: () => {
              let word = article.sections[i][j].words[w]
              navigator.clipboard.writeText(word.word).then(r => {
                Toast.success($t('copied'))
              })
            },
          },
        ],
      },
      {
        label: $t('start_from_here'),
        onClick: () => {
          jump(i, j, w + 1, sentence)
        },
      },
      {
        label: $t('play_sentence'),
        onClick: () => play(),
      },
      {
        label: $t('grammar_analysis'),
        onClick: () => {
          navigator.clipboard.writeText(sentence.text).then(r => {
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
              let word = article.sections[i][j].words[w]
              window.open(`https://www.youdao.com/result?word=${word.word}&lang=en`, '_blank')
            },
          },
          {
            label: $t('translate_sentence'),
            onClick: () => {
              window.open(`https://www.youdao.com/result?word=${sentence.text}&lang=en`, '_blank')
            },
          },
        ],
      },
    ],
  })
}

onMounted(init)

function clear() {
  emitter.off(EventKey.resetWord)
  emitter.off(EventKey.onTyping, onTyping)
}

watch(
  () => props.active,
  v => {
    if (v) {
      emitter.on(EventKey.resetWord, () => {
        wrong = input = ''
      })
      emitter.on(EventKey.onTyping, onTyping)
    } else {
      clear()
    }
  },
  { immediate: true }
)

onUnmounted(clear)

useEvents([
  [ShortcutKey.ChooseA, onTyping],
  [ShortcutKey.ChooseB, onTyping],
  [ShortcutKey.ChooseC, onTyping],
  [ShortcutKey.ChooseD, onTyping],
])

defineExpose({
  showSentence,
  play,
  hideSentence,
  nextSentence,
  init,
  applyPracticeCache,
  getIndex: () => {
    return {
      sectionIndex,
      sentenceIndex,
      wordIndex,
      stringIndex,
    }
  },
})

function isCurrent(i: number, j: number, w: number) {
  return `${i}${j}${w}` === currentIndex
}
</script>

<template>
  <div class="typing-article" ref="typeArticleRef">
    <div
      :id="`article_` + index"
      class="article-content"
      :class="[settingStore.translate && 'tall', settingStore.dictation && 'dictation']"
      ref="articleWrapperRef"
    >
      <article>
        <div class="section" v-for="(section, indexI) in article.sections">
          <span class="sentence" v-for="(sentence, indexJ) in section">
            <span
              v-for="(word, indexW) in sentence.words"
              @contextmenu="e => onContextMenu(e, sentence, indexI, indexJ, indexW)"
              class="word"
              :class="[
                sectionIndex > indexI
                  ? 'wrote'
                  : sectionIndex >= indexI && sentenceIndex > indexJ
                    ? 'wrote'
                    : sectionIndex >= indexI && sentenceIndex >= indexJ && wordIndex > indexW
                      ? 'wrote'
                      : sectionIndex >= indexI &&
                          sentenceIndex >= indexJ &&
                          wordIndex >= indexW &&
                          stringIndex >= word.word.length
                        ? 'wrote'
                        : '',
                indexW === 0 && `word${indexI}-${indexJ}`,
              ]"
            >
              <span
                class="word-wrap"
                @mouseenter="settingStore.allowWordTip && showSentence(indexI, indexJ, indexW)"
                @mouseleave="hideSentence"
                :class="[
                  hoverIndex.sectionIndex === indexI &&
                    hoverIndex.sentenceIndex === indexJ &&
                    hoverIndex.wordIndex === indexW &&
                    'hover-show',
                  word.type === PracticeArticleWordType.Number && 'font-family text-xl',
                ]"
                @click.stop="onArticleWordClick($event, word.word)"
              >
                <TypingWord :word="word" :is-typing="true" v-if="isCurrent(indexI, indexJ, indexW) && !isSpace" />
                <TypingWord :isHighLight="highlightWords.includes(word.word)" :word="word" :is-typing="false" v-else />
                <span class="border-bottom" v-if="settingStore.dictation"></span>
              </span>
              <Space
                v-if="word.nextSpace"
                class="word-end"
                :is-wrong="false"
                :is-wait="isCurrent(indexI, indexJ, indexW) && isSpace"
                :is-shake="isCurrent(indexI, indexJ, indexW) && isSpace && wrong !== ''"
              />
            </span>
            <VolumeIcon class="ml-2" />
          </span>
        </div>
      </article>
      <div class="translate">
        <template v-for="(v, indexI) in article.sections">
          <div
            class="row"
            :class="[
              `translate${indexI + '-' + indexJ}`,
              sectionIndex > indexI ? 'wrote' : sectionIndex >= indexI && sentenceIndex > indexJ ? 'wrote' : '',
            ]"
            v-for="(item, indexJ) in v"
          >
            <span class="space"></span>
            <Transition name="fade">
              <span class="text" v-if="item.translate">{{ item.translate }}</span>
            </Transition>
          </div>
        </template>
      </div>
      <div class="cursor" v-if="!isEnd && active" :style="{ top: cursor.top + 'px', left: cursor.left + 'px' }"></div>
    </div>
    <WordLookupPopover />
  </div>
</template>

<style scoped lang="scss">
.wrote {
  color: grey;
}

$translate-lh: 3.2;
$article-lh: 2.4;

.typing-article {
  color: var(--color-article);
  width: var(--article-width);
  font-size: 1.6rem;

  .article-content {
    position: relative;
  }

  .dictation {
    .border-bottom {
      display: inline-block !important;
    }
    .translate {
      color: var(--color-reverse-black);
    }
  }

  .tall {
    article {
      line-height: $article-lh;
    }
  }

  article {
    word-break: keep-all;
    word-wrap: break-word;
    white-space: pre-wrap;
    font-family: var(--en-article-family);
    //@apply bg-green!;

    .wrote,
    .hover-show {
      :deep(.hide) {
        opacity: 1 !important;
      }

      .border-bottom {
        display: none !important;
      }
    }

    .hover-show {
      border-radius: 0.2rem;
      @apply bg-green/70!;

      :deep(.hide) {
        opacity: 1 !important;
      }
      :deep(span) {
        color: black !important;
      }
    }

    .section {
      &:not(:last-child) {
        margin-bottom: 1.5rem;
      }

      .sentence {
        transition: all 0.3s;
      }

      .word {
        display: inline-block;

        .word-wrap {
          position: relative;
          transition: background-color 0.3s;
          cursor: pointer;
        }

        .border-bottom {
          position: absolute;
          width: 100%;
          height: 100%;
          left: 0;
          top: 0;
          border-bottom: 2px solid var(--color-article);
          display: none;
          transform: translateY(-0.2rem);
        }
      }
    }
  }

  .translate {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    font-size: 1.2rem;
    line-height: $translate-lh;
    letter-spacing: 0.2rem;
    font-family: var(--zh-article-family);
    font-weight: bold;
    color: #818181;

    .row {
      position: absolute;
      left: 0;
      width: 100%;
      opacity: 0;
      transition: all 0.3s;

      .space {
        transition: all 0.3s;
        display: inline-block;
      }
    }
  }
}

.sentence-translate-mobile {
  display: none;
}
</style>
