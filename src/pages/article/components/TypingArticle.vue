<script setup lang="ts">
import { inject, onMounted, onUnmounted, watch } from "vue"
import { Article, ArticleWord, PracticeArticleWordType, Sentence, Word } from "@/types/types.ts";
import { useBaseStore } from "@/stores/base.ts";
import { useSettingStore } from "@/stores/setting.ts";
import { usePlayBeep, usePlayCorrect, usePlayKeyboardAudio } from "@/hooks/sound.ts";
import { emitter, EventKey } from "@/utils/eventBus.ts";
import { _dateFormat, _nextTick, msToHourMinute, msToMinute, total } from "@/utils";
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import ContextMenu from '@imengyu/vue3-context-menu'
import { getTranslateText } from "@/hooks/article.ts";
import BaseButton from "@/components/BaseButton.vue";
import QuestionForm from "@/pages/article/components/QuestionForm.vue";
import { getDefaultArticle, getDefaultWord } from "@/types/func.ts";
import Toast from '@/components/base/toast/Toast.ts'
import TypingWord from "@/pages/article/components/TypingWord.vue";
import Space from "@/pages/article/components/Space.vue";
import { useWordOptions } from "@/hooks/dict.ts";
import nlp from "compromise/three";
import { nanoid } from "nanoid";
import { usePracticeStore } from "@/stores/practice.ts";
import { PracticeSaveArticleKey } from "@/config/env.ts";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()

interface IProps {
  article: Article,
  sectionIndex?: number,
  sentenceIndex?: number,
  wordIndex?: number,
  stringIndex?: number,
}

const props = withDefaults(defineProps<IProps>(), {
  article: () => getDefaultArticle(),
  sectionIndex: 0,
  sentenceIndex: 0,
  wordIndex: 0,
  stringIndex: 0,
})

const emit = defineEmits<{
  ignore: [],
  wrong: [val: Word],
  play: [val: {
    sentence: Sentence,
    handle: boolean
  }],
  nextWord: [val: ArticleWord],
  complete: [],
  next: [],
  replay: [],
}>()

let typeArticleRef = $ref<HTMLInputElement>(null)
let articleWrapperRef = $ref<HTMLInputElement>(null)
let sectionIndex = $ref(0)
let sentenceIndex = $ref(0)
let wordIndex = $ref(0)
let stringIndex = $ref(0)
let input = $ref('')
let wrong = $ref('')
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
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()
const {
  toggleWordCollect,
} = useWordOptions()

const store = useBaseStore()
const settingStore = useSettingStore()
const statStore = usePracticeStore()

watch([() => sectionIndex, () => sentenceIndex, () => wordIndex, () => stringIndex], ([a, b, c,]) => {
  localStorage.setItem(PracticeSaveArticleKey.key, JSON.stringify({
    version: PracticeSaveArticleKey.version,
    val: {
      practiceData: {
        sectionIndex,
        sentenceIndex,
        wordIndex,
        stringIndex,
        id: props.article.id
      },
      statStoreData: statStore.$state,
    }
  }))
  checkCursorPosition(a, b, c)
})

// watch(() => props.article.id, init, {immediate: true})

watch(() => settingStore.translate, () => {
  checkTranslateLocation().then(() => checkCursorPosition())
})

watch(() => isEnd, n => {
  if (n) {
    _nextTick(() => {
      typeArticleRef?.scrollTo({top: typeArticleRef.scrollHeight, behavior: "smooth"})
    })
  } else {
    typeArticleRef?.scrollTo({top: 0, behavior: "smooth"})
  }
})

function init() {
  if (!props.article.id) return
  isSpace = isEnd = false
  let d = localStorage.getItem(PracticeSaveArticleKey.key)
  if (d) {
    try {
      let obj = JSON.parse(d)
      let data = obj.val
      statStore.$patch(data.statStoreData)
      jump(data.practiceData.sectionIndex, data.practiceData.sentenceIndex, data.practiceData.wordIndex)
    } catch (e) {
      localStorage.removeItem(PracticeSaveArticleKey.key)
      init()
    }
  } else {
    wrong = input = ''
    sectionIndex = 0
    sentenceIndex = 0
    wordIndex = 0
    stringIndex = 0
    //todo 这在直接修改不太合理
    props.article.sections.map((v) => {
      v.map((w) => {
        w.words.map(s => {
          s.input = ''
        })
      })
    })
    typeArticleRef?.scrollTo({top: 0, behavior: "smooth"})
  }
  checkTranslateLocation().then(() => checkCursorPosition())
}

function checkCursorPosition(a = sectionIndex, b = sentenceIndex, c = wordIndex) {
  // console.log('checkCursorPosition')
  _nextTick(() => {
    // 选中目标元素
    const currentWord = document.querySelector(`.section:nth-of-type(${a + 1}) .sentence:nth-of-type(${b + 1}) .word:nth-of-type(${c + 1})`);
    if (currentWord) {
      // 在 currentWord 内找 .word-end
      const end = currentWord.querySelector('.word-end');
      if (end) {
        // 获取 articleWrapper 的位置
        const articleRect = articleWrapperRef.getBoundingClientRect();
        const endRect = end.getBoundingClientRect();
        //如果当前输入位置大于屏幕的0.7高度，就滚动屏幕的1/3
        if (endRect.y > window.innerHeight * 0.7) {
          typeArticleRef?.scrollTo({top: typeArticleRef.scrollTop + window.innerHeight * 0.3, behavior: "smooth"})
        }
        // 计算相对位置
        cursor = {
          top: endRect.top - articleRect.top,
          left: endRect.left - articleRect.left,
        };
      }
    }
  },)
}

function checkTranslateLocation() {
  // console.log('checkTranslateLocation')
  return new Promise<void>(resolve => {
    _nextTick(() => {
      let articleRect = articleWrapperRef.getBoundingClientRect()
      props.article.sections.map((v, i) => {
        v.map((w, j) => {
          let location = i + '-' + j
          let wordClassName = `.word${location}`
          let word = document.querySelector(wordClassName)
          let wordRect = word.getBoundingClientRect()
          let translateClassName = `.translate${location}`
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
    }, 300)
  })
}

let isTyping = false
//专用锁，因为这个方法父级要调用
let lock = false

function nextSentence() {
  if (lock || isEnd) return
  checkTranslateLocation()
  lock = true
  let currentSection = props.article.sections[sectionIndex]
  let currentSentence = currentSection[sentenceIndex]
  //这里把未输入的单词补全，因为删除时会用到input
  currentSentence.words.forEach((word, i) => {
    word.input = word.input + word.word.slice(word.input?.length ?? 0)
  })

  //todo 计得把略过的单词加上统计里面去
  // if (!store.allIgnoreWords.includes(currentWord.word.toLowerCase()) && currentWord.type === PracticeArticleWordType.Word) {
  //   statisticsStore.inputNumber++
  // }
  isSpace = false;
  input = wrong = ''
  stringIndex = 0;
  wordIndex = 0
  sentenceIndex++
  if (!currentSection[sentenceIndex]) {
    sentenceIndex = 0
    sectionIndex++
    if (!props.article.sections[sectionIndex]) {
      console.log('打完了')
      isEnd = true
      emit('complete')
    } else {
      emit('play', {sentence: props.article.sections[sectionIndex][0], handle: false})
    }
  } else {
    emit('play', {sentence: currentSection[sentenceIndex], handle: false})
  }
  lock = false
}
  
function onTyping(e: KeyboardEvent) {
  if (!props.article.sections.length) return
  if (isTyping || isEnd) return;
  isTyping = true;
  // console.log('keyDown', e.key, e.code, e.keyCode)
  try {
    let currentSection = props.article.sections[sectionIndex]
    let currentSentence = currentSection[sentenceIndex]
    let currentWord: ArticleWord = currentSentence.words[wordIndex]
    wrong = ''

    const next = () => {
      isSpace = false;
      input = wrong = ''
      stringIndex = 0;
      // 检查下一个单词是否存在
      if (wordIndex + 1 < currentSentence.words.length) {
        wordIndex++;
        emit('nextWord', currentWord);
      } else {
        nextSentence()
      }
    }

    if (isSpace) {
      if (e.code === 'Space') {
        next()
      } else {
        wrong = ' '
        playBeep()
        setTimeout(() => {
          wrong = ''
          wrong = input = ''
        }, 500)
      }
    } else {
      //如果是首句首词
      if (sectionIndex === 0 && sentenceIndex === 0 && wordIndex === 0 && stringIndex === 0) {
        emit('play', {sentence: currentSection[sentenceIndex], handle: false})
      }
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
        //如果不是符号，播放完成音效
        if (currentWord.type === PracticeArticleWordType.Word) playCorrect()
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
    localStorage.removeItem(PracticeSaveArticleKey.key)
    init()
  }finally {
    isTyping = false
  }
}
  
function play() {
  let currentSection = props.article.sections[sectionIndex]
  emit('play', {sentence: currentSection[sentenceIndex], handle: true})
}

function del() {
  if (wrong) {
    wrong = ''
  } else {
    if (isEnd) return;
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
    let currentSection = props.article.sections[sectionIndex]
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

function showSentence(i1: number = sectionIndex, i2: number = sentenceIndex, i3: number = wordIndex) {
  hoverIndex = {sectionIndex: i1, sentenceIndex: i2, wordIndex: i3}
}

function hideSentence() {
  hoverIndex = {sectionIndex: -1, sentenceIndex: -1, wordIndex: -1}
}

function jump(i, j, w, sentence?) {
  sectionIndex = i
  sentenceIndex = j
  //todo 这里有可能是符号，要处理下
  wordIndex = w
  stringIndex = 0
  input = wrong = ''
  isEnd = isSpace = false
  props.article.sections.map((v, i) => {
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
    emit('play', {sentence: sentence, handle: false})
  }
}

function onContextMenu(e: MouseEvent, sentence: Sentence, i, j, w) {
  const selectedText = window.getSelection().toString();
  console.log(selectedText);
  //prevent the browser's default menu
  e.preventDefault();
  //show your menu
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: t('CollectWord'),
        onClick: () => {
          let word = props.article.sections[i][j].words[w]
          let doc = nlp(word.word)
          let text = word.word
          // 优先判断是不是动词
          if (doc.verbs().found) {
            text = doc.verbs().toInfinitive().text()
          }
          // 如果是名词（复数 → 单数）
          if (doc.nouns().found) {
            text = doc.nouns().toSingular().text()
          }
          if (!text.length) text = word.word
          console.log('text', text)
          toggleWordCollect(getDefaultWord({word: text, id: nanoid()}))
          Toast.success(t('AddedSuccessfully', {word: text}))
        }
      },
      {
        label: t('Copy'),
        children: [
          {
            label: t('CopySentence'),
            onClick: () => {
              navigator.clipboard.writeText(sentence.text).then(r => {
                Toast.success(t('Copied'))
              })
            }
          },
          {
            label: t('CopyWord'),
            onClick: () => {
              let word = props.article.sections[i][j].words[w]
              navigator.clipboard.writeText(word.word).then(r => {
                Toast.success(t('Copied'))
              })
            }
          }
        ]
      },
      {
        label: t('StartFromHere'),
        onClick: () => {
          jump(i, j, w + 1, sentence)
        }
      },
      {
        label: t('PlaySentence'),
        onClick: () => {
          emit('play', {sentence: sentence, handle: true})
        }
      },
      {
        label: t('GrammarAnalysis'),
        onClick: () => {
          navigator.clipboard.writeText(sentence.text).then(r => {
            Toast.success(t('CopiedOpeningGrammarSite'))
            setTimeout(() => {
              window.open('https://enpuz.com/')
            }, 1000)
          })
        }
      },
      {
        label: t('YoudaoDictionaryTranslation'),
        children: [
          {
            label: t('TranslateWord'),
            onClick: () => {
              let word = props.article.sections[i][j].words[w]
              window.open(`https://www.youdao.com/result?word=${word.word}&lang=en`, '_blank')
            }
          },
          {
            label: t('TranslateSentence'),
            onClick: () => {
              window.open(`https://www.youdao.com/result?word=${sentence.text}&lang=en`, '_blank')
            }
          },
        ]
      },
    ]
  });
}

onMounted(() => {
  emitter.on(EventKey.resetWord, () => {
    wrong = input = ''
  })
  emitter.on(EventKey.onTyping, onTyping)
})

onUnmounted(() => {
  emitter.off(EventKey.resetWord,)
  emitter.off(EventKey.onTyping, onTyping)
})

defineExpose({showSentence, play, del, hideSentence, nextSentence, init})

function isCurrent(i: number, j: number, w: number) {
  return `${i}${j}${w}` === currentIndex
}

let showQuestions = $ref(false)

const currentPractice = inject('currentPractice', [])

</script>

<template>
  <div class="typing-article" ref="typeArticleRef">
    <header class="mb-4">
      <div class="title word"><span class="font-family text-3xl">{{ store.sbook.lastLearnIndex + 1 }}.</span>{{ props.article.title }}</div>
      <div class="titleTranslate" v-if="settingStore.translate">{{ props.article.titleTranslate }}</div>
    </header>

    <div class="article-content" ref="articleWrapperRef">
      <article :class="[
          settingStore.translate && 'tall',
          settingStore.dictation && 'dictation',
      ]">
        <div class="section" v-for="(section,indexI) in props.article.sections">
                <span class="sentence"
                      v-for="(sentence,indexJ) in section">
                  <span
                      v-for="(word,indexW) in sentence.words"
                      @contextmenu="e=>onContextMenu(e,sentence,indexI,indexJ,indexW)"
                      class="word"
                      :class="[(sectionIndex>indexI
                        ?'wrote':
                        (sectionIndex>=indexI &&sentenceIndex>indexJ)
                        ?'wrote' :
                        (sectionIndex>=indexI &&sentenceIndex>=indexJ && wordIndex>indexW)
                        ?'wrote':
                         (sectionIndex>=indexI &&sentenceIndex>=indexJ && wordIndex>=indexW && stringIndex>=word.word.length)
                        ?'wrote':
                        ''),
                        indexW === 0 && `word${indexI}-${indexJ}`,
                        ]">
                    <span class="word-wrap"
                          @mouseenter="settingStore.allowWordTip && showSentence(indexI,indexJ,indexW)"
                          @mouseleave="hideSentence"
                          :class="[
                           hoverIndex.sectionIndex === indexI && hoverIndex.sentenceIndex === indexJ && hoverIndex.wordIndex === indexW
                          &&'hover-show',
                          word.type === PracticeArticleWordType.Number && 'font-family text-xl'
                          ]"
                    >
                      <TypingWord :word="word"
                                  :is-typing="true"
                                  v-if="isCurrent(indexI,indexJ,indexW) && !isSpace"/>
                      <TypingWord :word="word" :is-typing="false" v-else/>
                      <span class="border-bottom" v-if="settingStore.dictation"></span>
                    </span>
                   <Space
                       v-if="word.nextSpace"
                       class="word-end"
                       :is-wrong="false"
                       :is-wait="isCurrent(indexI,indexJ,indexW) && isSpace"
                       :is-shake="isCurrent(indexI,indexJ,indexW) && isSpace && wrong !== ''"
                   />
                  </span>
                </span>
        </div>
      </article>
      <div class="translate" v-show="settingStore.translate">
        <template v-for="(v,indexI) in props.article.sections">
          <div class="row"
               :class="[
                   `translate${indexI+'-'+indexJ}`,
                   (sectionIndex>indexI
                        ?'wrote':
                        (sectionIndex>=indexI &&sentenceIndex>indexJ)
                        ?'wrote' :
                        ''),
                        ]"
               v-for="(item,indexJ) in v">
            <span class="space"></span>
            <Transition name="fade">
              <span class="text" v-if="item.translate">{{ item.translate }}</span>
            </Transition>
          </div>
        </template>
      </div>
      <div class="cursor" v-if="!isEnd" :style="{top:cursor.top+'px',left:cursor.left+'px'}"></div>
    </div>

    <div class="options flex justify-center" v-if="isEnd">
      <BaseButton
          @click="emit('replay')">{{ t('RestartPractice') }}
      </BaseButton>
      <BaseButton
          v-if="store.currentBook.lastLearnIndex < store.currentBook.articles.length - 1"
          @click="emit('next')">{{ t('NextArticle') }}
      </BaseButton>
    </div>

    <div class="font-family text-base pr-2 mb-50 mt-10" v-if="currentPractice.length && isEnd">
      <div class="text-2xl font-bold">{{ t('LearningRecord') }}</div>
      <div class="mt-1 mb-3">{{ t('TotalLearningDuration') }}：{{ msToHourMinute(total(currentPractice, 'spend'), t) }}</div>
      <div class="item border border-item border-solid mt-2 p-2 bg-[var(--bg-history)] rounded-md flex justify-between"
           :class="i === currentPractice.length-1 && 'color-red!'"
           v-for="(item,i) in currentPractice">
        <span :class="i === currentPractice.length-1 ? 'color-red':'color-gray'"
        >{{
            i === currentPractice.length - 1 ? t('Current') : i + 1
          }}.&nbsp;&nbsp;{{ _dateFormat(item.startDate, 'YYYY/MM/DD HH:mm') }}</span>
        <span>{{ msToHourMinute(item.spend, t) }}</span>
      </div>
    </div>

    <template v-if="false">
      <div class="center">
        <BaseButton @click="showQuestions =! showQuestions">{{ t('ShowQuestions') }}</BaseButton>
      </div>
      <div class="toggle" v-if="showQuestions">
        <QuestionForm :questions="article.questions"
                      :duration="300"
                      :immediateFeedback="false"
                      :randomize="true"
        />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">

.wrote {
  color: grey;
}

$translate-lh: 3.2;
$article-lh: 2.4;

.typing-article {
  height: 100%;
  overflow: auto;
  color: var(--color-article);
  width: var(--article-width);
  font-size: 1.6rem;

  header {
    word-wrap: break-word;
    position: relative;
    padding-top: 3rem;

    .title {
      text-align: center;
      font-size: 2.2rem;
      font-family: var(--en-article-family);
    }

    .titleTranslate {
      @extend .title;
      font-size: 1.2rem;
      margin-top: 0.5rem;
      font-family: var(--zh-article-family);
      font-weight: bold;
    }
  }

  .article-content {
    position: relative;
  }

  article {
    word-break: keep-all;
    word-wrap: break-word;
    white-space: pre-wrap;
    font-family: var(--en-article-family);

    &.dictation {
      .border-bottom {
        display: inline-block !important;
      }
    }

    .wrote, .hover-show {
      :deep(.hide) {
        opacity: 1 !important;
      }

      .border-bottom {
        display: none !important;
      }
    }

    .hover-show {
      border-radius: 0.2rem;
      //background: var(--color-select-bg);
      @apply bg-green!;

      :deep(.hide) {
        opacity: 1 !important;
      }
    }

    &.tall {
      line-height: $article-lh;
    }

    .section {
      margin-bottom: 1.5rem;

      .sentence {
        transition: all .3s;
      }

      .word {
        display: inline-block;

        .word-wrap {
          position: relative;
          transition: background-color .3s;
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
    letter-spacing: .2rem;
    font-family: var(--zh-article-family);
    font-weight: bold;

    .row {
      position: absolute;
      left: 0;
      width: 100%;
      opacity: 0;
      transition: all .3s;

      .space {
        transition: all .3s;
        display: inline-block;
      }
    }
  }
}
</style>
