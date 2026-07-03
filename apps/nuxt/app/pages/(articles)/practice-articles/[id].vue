<script setup lang="ts">
import { addStat, setUserDictProp } from '@typewords/core/apis'
import { BaseIcon, Toast, Tooltip } from '@typewords/base'
import ConflictNotice from '@typewords/core/components/dialog/ConflictNotice.vue'
import ArticleList from '@typewords/core/components/list/ArticleList.vue'
import Panel from '@typewords/core/components/Panel.vue'
import PracticeLayout from '@typewords/core/components/PracticeLayout.vue'
import SettingDialog from '@typewords/core/components/setting/SettingDialog.vue'
import { AppEnv, DICT_LIST } from '@typewords/core/config/env.ts'
import { genArticleSectionData, usePlayArticleTextAudio, usePlaySentenceAudio } from '@typewords/core/hooks/article.ts'
import { useArticleOptions } from '@typewords/core/hooks/dict.ts'
import { useOnKeyboardEventListener, useStartKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import { useDisableEventListener } from '@typewords/utils'
import useTheme from '@typewords/core/hooks/theme.ts'
import ArticleAudio from '@typewords/core/components/article/ArticleAudio.vue'
import EditSingleArticleModal from '@typewords/core/components/article/EditSingleArticleModal.vue'
import TypingArticle from '@typewords/core/components/article/TypingArticle.vue'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { getDefaultArticle, getDefaultDict, getDefaultWord } from '@typewords/core/types/func.ts'
import type { Article, ArticleItem, ArticleWord, Dict, Statistics, Word } from '@typewords/core/types/types.ts'
import {
  _getDictDataByUrl,
  _nextTick,
  cloneDeep,
  ensureCustomDictCopy,
  msToMinute,
  resourceWrap,
  total,
} from '@typewords/core/utils'
import { getPracticeArticleCacheLocal } from '@typewords/core/utils/cache.ts'
import { usePracticeArticlePersistence } from '@typewords/core/composables/usePracticePersistence'
import { emitter, EventKey, useEvents } from '@typewords/core/utils/eventBus'
import { computed, onMounted, onUnmounted, provide, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DictType, PracticeArticleWordType, ShortcutKey } from '@typewords/core/types/enum.ts'

const store = useBaseStore()
const runtimeStore = useRuntimeStore()
const settingStore = useSettingStore()
const statStore = usePracticeStore()
const articlePersistence = usePracticeArticlePersistence()
const { toggleTheme } = useTheme()

let articleData = $ref({
  list: [],
  article: getDefaultArticle(),
})
let showEditArticle = $ref(false)
let typingArticleRef = $ref<any>()
let showConflictNotice = $ref(false)
let loading = $ref<boolean>(false)
let allWrongWords = new Set()
let editArticle = $ref<Article>(getDefaultArticle())
let audioRef = $ref<HTMLAudioElement>()
let timer = $ref<ReturnType<typeof setInterval> | number>(0)
let isFocus = true
let isTyped = $ref(false)
//用于解决 手动改文章时改了lastLearnIndex，同时又监听了store.sbook.lastLearnIndex，会冲突
let lock = false

function write() {
  // console.log('write')
  settingStore.dictation = true
  repeat()
}

//TODO 需要判断是否已忽略
//todo 使用场景是？
function repeat() {
  // console.log('repeat')
  getCurrentPractice()
}

function prev() {
  // console.log('next')
  if (store.sbook.lastLearnIndex === 0) {
    Toast.warning('已经在第一章了~')
  } else {
    store.sbook.lastLearnIndex--
    getCurrentPractice()
  }
}

const toggleShowTranslate = () => (settingStore.translate = !settingStore.translate)
const toggleDictation = () => (settingStore.dictation = !settingStore.dictation)
const togglePanel = () => (settingStore.showPanel = !settingStore.showPanel)
const skip = () => typingArticleRef?.nextSentence()
const collect = () => toggleArticleCollect(articleData.article)
const shortcutKeyEdit = () => edit()

function toggleConciseMode() {
  settingStore.showToolbar = !settingStore.showToolbar
  settingStore.showPanel = settingStore.showToolbar
}

function next() {
  articlePersistence.clear()
  if (store.sbook.lastLearnIndex >= articleData.list.length - 1) {
    store.sbook.complete = true
    store.sbook.lastLearnIndex = 0
    //todo 这里应该弹窗
  } else store.sbook.lastLearnIndex++
  getCurrentPractice()
}

const router = useRouter()
const route = useRoute()

async function init() {
  // console.log('load好了开始加载')
  let dict = getDefaultDict()
  let dictId = route.params.id
  if (dictId) {
    //先在自己的词典列表里面找，如果没有再在资源列表里面找
    dict = store.article.bookList.find(v => v.id == dictId)
    let r = await fetch(resourceWrap(DICT_LIST.ARTICLE.ALL))
    let book_list = await r.json()
    if (!dict) dict = book_list.find(v => v.id === dictId) as Dict
    if (dict && dict.id) {
      //如果是不是自定义词典，就请求数据
      if (!dict.custom) dict = await _getDictDataByUrl(dict, DictType.article)
      if (!dict.articles.length) {
        router.push('/articles')
        return Toast.warning('没有文章可学习！')
      }
      await store.changeBook(dict)
      articleData.list = cloneDeep(store.sbook.articles)
      getCurrentPractice()
      loading = false
    } else {
      router.push('/articles')
    }
  } else {
    router.push('/articles')
  }
}

const initAudio = () => {
  _nextTick(() => {
    if (import.meta.server) return
    audioRef.volume = settingStore.articleSoundVolume / 100
    audioRef.playbackRate = settingStore.articleSoundSpeed
  })
}

const handleVolumeUpdate = (volume: number) => {
  settingStore.articleSoundVolume = volume
}

const handleSpeedUpdate = (speed: number) => {
  settingStore.articleSoundSpeed = speed
}

watch(
  [() => store.load, () => loading],
  ([a, b]) => {
    if (a && b) init()
  },
  { immediate: true }
)

watch(
  () => settingStore.$state,
  n => {
    initAudio()
  },
  { immediate: true, deep: true }
)

//用于远程拉了新数据，被动更新当前文章
watch(
  () => store.sbook.lastLearnIndex,
  n => {
    if (lock) return
    getCurrentPractice()
  }
)

onActivated(() => {
  console.log('onActivated')
})
onMounted(() => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)

  console.log('onMounted')
  if (store.sbook?.articles?.length) {
    articleData.list = cloneDeep(store.sbook.articles)
    getCurrentPractice()
  } else {
    loading = true
  }
  if (route.query.guide) {
    showConflictNotice = false
  } else {
    showConflictNotice = true
  }
})

async function unmount() {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  console.log('onUnmounted')
  const cache = await getPracticeArticleCacheLocal()
  //如果有缓存，则更新花费的时间；因为用户不输入不会保存数据
  if (cache) {
    if (runtimeStore.globalLoading) return
    runtimeStore.globalLoading = true
    cache.statStoreData.spend = statStore.spend
    await articlePersistence.save(cache)
    runtimeStore.globalLoading = false
  }
  timer && clearInterval(timer)
}

onUnmounted(unmount)

useStartKeyboardEventListener()
useDisableEventListener(() => loading)

const onvisibilitychange = async () => {
  isFocus = !document.hidden
  if (isFocus) {
    if (runtimeStore.globalLoading) return
    runtimeStore.globalLoading = true
    try {
      const cache = await articlePersistence.fetch()
      if (cache) {
        statStore.$patch(cache.statStoreData)
        typingArticleRef?.applyPracticeCache?.(cache)
      }
    } finally {
      runtimeStore.globalLoading = false
    }
  }
}

function setArticle(val: Article) {
  statStore.wrong = 0
  statStore.total = 0
  statStore.startDate = Date.now()
  statStore.spend = 0
  allWrongWords = new Set()
  articleData.list[store.sbook.lastLearnIndex] = val
  articleData.article = val
  let ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
  articleData.article.sections.map((v, i) => {
    v.map(w => {
      w.words.map(s => {
        if (!ignoreSet.has(s.word.toLowerCase()) && s.type === PracticeArticleWordType.Word) {
          statStore.total++
        }
      })
    })
  })

  isTyped = false
  clearInterval(timer)
  timer = setInterval(() => {
    if (isFocus) {
      statStore.spend += 1000
    }
  }, 1000)

  _nextTick(typingArticleRef?.init)
}

async function complete() {
  clearInterval(timer)
  //todo 有空了改成实时保存
  let data: Partial<Statistics> & { title: string; articleId: number } = {
    articleId: Number(articleData.article.id),
    title: articleData.article.title,
    spend: statStore.spend,
    startDate: statStore.startDate,
    total: statStore.total,
    wrong: statStore.wrong,
  }

  let reportData = {
    name: store.sbook.name,
    index: store.sbook.lastLearnIndex,
    custom: store.sbook.custom,
    complete: store.sbook.complete,
    title: articleData.article.title,
    spend: Number(statStore.spend / 1000 / 60).toFixed(1),
    s: '',
  }
  reportData.s = `name:${store.sbook.name},title:${store.sbook.lastLearnIndex}.${data.title},spend:${Number(statStore.spend / 1000 / 60).toFixed(1)}`
  window.umami?.track('endStudyArticle', reportData)

  if (store.sbook.lastLearnIndex >= store.sbook.length - 1) {
    store.sdict.complete = true
  }
  if (AppEnv.CAN_REQUEST) {
    let res = await addStat({
      ...data,
      type: 'article',
      complete: store.sdict.complete,
    })
    if (!res.success) {
      Toast.error(res.msg)
    }
  }

  store.sbook.statistics.push(data as any)

  //重置
  statStore.wrong = 0
  statStore.startDate = Date.now()
}

function getCurrentPractice() {
  emitter.emit(EventKey.resetWord)
  let currentArticle = articleData.list[store.sbook.lastLearnIndex]
  let article = getDefaultArticle(currentArticle)
  if (article.sections.length) {
    setArticle(article)
  } else {
    genArticleSectionData(article)
    setArticle(article)
  }
}

function saveArticle(val: Article) {
  console.log('saveArticle', val, JSON.stringify(val?.lrcPosition))
  console.log('saveArticle', val.textTranslate)
  showEditArticle = false
  const nextBook = ensureCustomDictCopy(store.sbook)
  const rIndex = nextBook.articles.findIndex(v => v.id === val.id)
  if (rIndex > -1) {
    nextBook.articles[rIndex] = cloneDeep(val)
  }
  if (store.article.studyIndex > -1) {
    store.article.bookList[store.article.studyIndex] = getDefaultDict(nextBook)
  }
  setArticle(val)
}

function edit(val: Article = articleData.article) {
  editArticle = val
  showEditArticle = true
}

function wrong(word: Word) {
  let temp = word.word.toLowerCase()
  //过滤简单词
  if (settingStore.ignoreSimpleWord) {
    if (store.simpleWords.includes(temp)) return
  }
  if (!allWrongWords.has(temp)) {
    allWrongWords.add(temp)
    statStore.wrong++
  }

  if (!store.wrong.words.find((v: Word) => v.word.toLowerCase() === temp)) {
    store.wrong.words.push(getDefaultWord(word))
    store.wrong.length = store.wrong.words.length
  }
}

function nextWord(word: ArticleWord) {
  if (!store.allIgnoreWords.includes(word.word.toLowerCase()) && word.type === PracticeArticleWordType.Word) {
    statStore.inputWordNumber++
  }
}

async function changeArticle(val: ArticleItem) {
  if (lock) return
  lock = true
  await articlePersistence.clear()
  let rIndex = articleData.list.findIndex(v => v.id === val.item.id)
  if (rIndex > -1) {
    store.sbook.lastLearnIndex = rIndex
    getCurrentPractice()

    if (AppEnv.CAN_REQUEST) {
      let res = await setUserDictProp(null, store.sbook)
      if (!res.success) {
        Toast.error(res.msg)
      }
    }
  }
  initAudio()
  lock = false
}

const handlePlayNext = (nextArticle: Article) => {
  let rIndex = articleData.list.findIndex(v => v.id === nextArticle.id)
  if (rIndex > -1) {
    store.sbook.lastLearnIndex = rIndex
    getCurrentPractice()
  }
}

const { isArticleCollect, toggleArticleCollect } = useArticleOptions()

function play() {
  typingArticleRef?.play()
}

function show() {
  typingArticleRef?.showSentence()
}

function onKeyUp() {
  typingArticleRef?.hideSentence()
}

async function onKeyDown(e: KeyboardEvent) {
  switch (e.key) {
    case 'Backspace':
      typingArticleRef.del()
      break
  }
}

useOnKeyboardEventListener(onKeyDown, onKeyUp)

useEvents([
  [EventKey.write, write],
  [EventKey.repeatStudy, repeat],
  [EventKey.continueStudy, next],

  [ShortcutKey.PreviousChapter, prev],
  [ShortcutKey.RepeatChapter, repeat],
  [ShortcutKey.DictationChapter, write],
  [ShortcutKey.ToggleShowTranslate, toggleShowTranslate],
  [ShortcutKey.ToggleDictation, toggleDictation],
  [ShortcutKey.ToggleTheme, toggleTheme],
  [ShortcutKey.ToggleConciseMode, toggleConciseMode],
  [ShortcutKey.TogglePanel, togglePanel],
  [ShortcutKey.NextChapter, next],
  [ShortcutKey.PlayWordPronunciation, play],
  [ShortcutKey.ShowWord, show],
  [ShortcutKey.Next, skip],
  [ShortcutKey.ToggleCollect, collect],
  [ShortcutKey.EditArticle, shortcutKeyEdit],
])

const { playSentenceAudio } = usePlaySentenceAudio()
const { playArticleTextAudio } = usePlayArticleTextAudio()

function play2(e) {
  _nextTick(() => {
    if (settingStore.articleSound || e.handle) {
      playSentenceAudio(e.sentence, audioRef)
    }
  })
}

function playArticleHeadAudio(e) {
  _nextTick(() => {
    playArticleTextAudio(e, audioRef)
  })
}

const currentPractice = computed(() => {
  if (store.sbook.statistics?.length) {
    return store.sbook.statistics.filter((v: any) => v.title === articleData.article.title)
  }
  return []
})

provide('currentPractice', currentPractice)
</script>
<template>
  <PracticeLayout v-loading="loading" panelLeft="var(--article-panel-margin-left)">
    <template v-slot:practice>
      <TypingArticle
        ref="typingArticleRef"
        @wrong="wrong"
        @next="next"
        @nextWord="nextWord"
        @play="play2"
        @play-article-text-audio="playArticleHeadAudio"
        @replay="setArticle(articleData.article)"
        @complete="complete"
        :article="articleData.article"
      />
    </template>
    <template v-slot:panel>
      <Panel :style="{ width: 'var(--article-panel-width)' }">
        <template v-slot:title>
          <span>{{ store.sbook.name }} ({{ store.sbook.lastLearnIndex + 1 }} / {{ articleData.list.length }})</span>
        </template>
        <div class="panel-page-item pl-4">
          <ArticleList
            :isActive="settingStore.showPanel"
            :static="false"
            :show-translate="settingStore.translate"
            @click="changeArticle"
            :active-id="articleData.article.id ?? ''"
            :list="articleData.list"
          >
          </ArticleList>
        </div>
      </Panel>
    </template>
    <template v-slot:footer>
      <div class="footer pb-3">
        <div class="center h-10">
          <Tooltip
            :title="`${settingStore.showToolbar ? $t('collapse') : $t('expand')}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleToolbar]})`"
          >
            <IconFluentChevronLeft20Filled
              @click="settingStore.showToolbar = !settingStore.showToolbar"
              :class="!settingStore.showToolbar && 'down'"
              color="#999"
              class="arrow"
            />
          </Tooltip>
        </div>
        <div class="bottom">
          <div class="flex justify-between items-center gap-2">
            <div class="stat">
              <div class="row">
                <div class="num">{{ currentPractice.length }}次/{{ msToMinute(total(currentPractice, 'spend')) }}</div>
                <div class="line"></div>
                <div class="name">记录</div>
              </div>
              <div class="row">
                <!--                <div class="num">{{statStore.spend }}分钟</div>-->
                <div class="num">{{ Math.floor(statStore.spend / 1000 / 60) }}分钟</div>
                <div class="line"></div>
                <div class="name">时间</div>
              </div>
              <div class="row">
                <div class="num center gap-1">
                  {{ statStore.total }}
                  <Tooltip>
                    <IconFluentQuestionCircle20Regular width="18" />
                    <template #reference>
                      <div>
                        统计词数{{ settingStore.ignoreSimpleWord ? '不包含' : '包含' }}简单词，不包含已掌握
                        <div>简单词可在设置 -> 练习设置 -> 简单词过滤中修改</div>
                      </div>
                    </template>
                  </Tooltip>
                </div>
                <div class="line"></div>
                <div class="name">单词总数</div>
              </div>
            </div>
            <ArticleAudio
              ref="audioRef"
              :article="articleData.article"
              @update-speed="handleSpeedUpdate"
              @update-volume="handleVolumeUpdate"
            ></ArticleAudio>
            <div class="flex flex-col items-center justify-center gap-1">
              <div class="flex gap-2 center">
                <SettingDialog type="article" />

                <BaseIcon :title="`下一句(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`" @click="skip">
                  <IconFluentArrowBounce20Regular class="transform-rotate-180" />
                </BaseIcon>
                <BaseIcon
                  :title="`播放当前句子(${settingStore.shortcutKeyMap[ShortcutKey.PlayWordPronunciation]})`"
                  @click="play"
                >
                  <IconFluentReplay20Regular />
                </BaseIcon>
                <BaseIcon
                  @click="settingStore.dictation = !settingStore.dictation"
                  :title="`开关默写模式(${settingStore.shortcutKeyMap[ShortcutKey.ToggleDictation]})`"
                >
                  <IconFluentEyeOff16Regular v-if="settingStore.dictation" />
                  <IconFluentEye16Regular v-else />
                </BaseIcon>

                <BaseIcon
                  :title="`开关释义显示(${settingStore.shortcutKeyMap[ShortcutKey.ToggleShowTranslate]})`"
                  @click="settingStore.translate = !settingStore.translate"
                >
                  <IconPhTranslate v-if="settingStore.translate" />
                  <IconFluentTranslateOff16Regular v-else />
                </BaseIcon>

                <!--              <BaseIcon-->
                <!--                  :title="`编辑(${settingStore.shortcutKeyMap[ShortcutKey.EditArticle]})`"-->
                <!--                  icon="tabler:edit"-->
                <!--                  @click="emitter.emit(ShortcutKey.EditArticle)"-->
                <!--              />-->
                <BaseIcon
                  @click="settingStore.showPanel = !settingStore.showPanel"
                  :title="`面板(${settingStore.shortcutKeyMap[ShortcutKey.TogglePanel]})`"
                >
                  <IconFluentTextListAbcUppercaseLtr20Regular />
                </BaseIcon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </PracticeLayout>

  <EditSingleArticleModal v-model="showEditArticle" :article="editArticle" @save="saveArticle" />

  <ConflictNotice v-if="showConflictNotice" />
</template>

<style scoped lang="scss">
.footer {
  width: var(--article-toolbar-width);
  @apply bg-primary;

  .bottom {
    @apply relative w-full box-border rounded-lg bg-second shadow-lg z-2;
    padding: 0.5rem var(--space);
    border: 1px solid var(--color-item-border);

    .stat {
      margin-top: 0.5rem;
      display: flex;
      justify-content: space-around;
      gap: var(--stat-gap);

      .row {
        @apply flex flex-col items-center gap-1 text-gray-500;

        .num,
        .name {
          word-break: keep-all;
          padding: 0 0.4rem;
        }

        .line {
          height: 1px;
          width: 100%;
          background: var(--color-sub-gray);
        }
      }
    }
  }

  .arrow {
    cursor: pointer;
    transition: all 0.5s;
    transform: rotate(-90deg);
    padding: 0.5rem;
    font-size: 1.2rem;

    &.down {
      transform: rotate(90deg);
    }
  }
}

// 移动端适配
@media (max-width: 768px) {
  // 优化练习区域布局
  .practice-article {
    padding-top: 3rem; // 为固定标题留出空间
  }

  // 优化标题区域
  .typing-article {
    header {
      position: fixed;
      top: 4.5rem; // 避开顶部导航栏
      left: 0;
      right: 0;
      z-index: 100;
      background: var(--bg-color);
      padding: 0.5rem 1rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      margin-bottom: 0;

      .title {
        font-size: 1rem;
        line-height: 1.4;
        word-break: break-word;

        .font-family {
          font-size: 0.9rem;
        }
      }

      .titleTranslate {
        font-size: 0.8rem;
        margin-top: 0.2rem;
        opacity: 0.8;
      }
    }

    .article-content {
      margin-top: 2rem; // 为固定标题留出空间
    }
  }

  .footer {
    width: 100%;

    .bottom {
      padding: 0.3rem 0.5rem 0.5rem 0.5rem;
      border-radius: 0.4rem;

      .stat {
        margin-top: 0.3rem;
        gap: 0.2rem;
        flex-direction: row;
        overflow-x: auto;

        .row {
          min-width: 3.5rem;
          gap: 0.2rem;

          .num {
            font-size: 0.8rem;
            font-weight: bold;
          }

          .name {
            font-size: 0.7rem;
          }
        }
      }

      .flex.flex-col.items-center.justify-center.gap-1 {
        .flex.gap-2.center {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.4rem;

          .base-icon {
            padding: 0.3rem;
            font-size: 1rem;
            min-height: 44px;
            min-width: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
      }
    }

    .arrow {
      font-size: 1rem;
      padding: 0.3rem;
    }
  }
}
</style>
