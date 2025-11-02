<script setup lang="ts">

import BasePage from "@/components/BasePage.vue";
import BackIcon from "@/components/BackIcon.vue";
import Empty from "@/components/Empty.vue";
import ArticleList from "@/components/list/ArticleList.vue";
import { useBaseStore } from "@/stores/base.ts";
import { Article, Dict, DictId, DictType } from "@/types/types.ts";
import { useRuntimeStore } from "@/stores/runtime.ts";
import BaseButton from "@/components/BaseButton.vue";
import { useRoute, useRouter } from "vue-router";
import EditBook from "@/pages/article/components/EditBook.vue";
import { computed, onMounted } from "vue";
import { _dateFormat, _getDictDataByUrl, msToHourMinute, resourceWrap, total, useNav } from "@/utils";
import BaseIcon from "@/components/BaseIcon.vue";
import { useArticleOptions } from "@/hooks/dict.ts";
import { getDefaultArticle, getDefaultDict } from "@/types/func.ts";
import Toast from "@/components/base/toast/Toast.ts";
import ArticleAudio from "@/pages/article/components/ArticleAudio.vue";
import { MessageBox } from "@/utils/MessageBox.tsx";
import { useSettingStore } from "@/stores/setting.ts";
import { useFetch } from "@vueuse/core";
import { CAN_REQUEST, DICT_LIST } from "@/config/env.ts";
import { detail } from "@/apis";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const runtimeStore = useRuntimeStore()
const settingStore = useSettingStore()
const base = useBaseStore()
const router = useRouter()
const route = useRoute()
const {nav} = useNav()

let isEdit = $ref(false)
let isAdd = $ref(false)
let loading = $ref(false)
let studyLoading = $ref(false)

let selectArticle: Article = $ref(getDefaultArticle())

// 计算当前选中文章的索引
const currentArticleIndex = computed(() => {
  return runtimeStore.editDict.articles.findIndex(article => article.id === selectArticle.id)
})

// 处理播放下一个音频
const handlePlayNext = (nextArticle: Article) => {
  selectArticle = nextArticle
}

function handleCheckedChange(val) {
  selectArticle = val.item
}

async function addMyStudyList() {
  let sbook = runtimeStore.editDict
  if (!sbook.articles.length) {
    return Toast.warning(t('NoArticlesToLearn'))
  }

  studyLoading = true
  await base.changeBook(sbook)
  studyLoading = false

  window.umami?.track('startStudyArticle', {
    name: sbook.name,
    index: sbook.lastLearnIndex,
    custom: sbook.custom,
    complete: sbook.complete,
  })
  nav('/practice-articles/' + sbook.id)
}

const showBookDetail = computed(() => {
  return !(isAdd || isEdit);
})

async function init() {
  if (route.query?.isAdd) {
    isAdd = true
    runtimeStore.editDict = getDefaultDict()
  } else {
    if (!runtimeStore.editDict.id) {
      await router.push("/articles")
    } else {
      if (!runtimeStore.editDict?.articles?.length
          && !runtimeStore.editDict?.custom
          && ![DictId.articleCollect].includes(runtimeStore.editDict.en_name || runtimeStore.editDict.id)
          && !runtimeStore.editDict?.is_default
      ) {
        loading = true
        let r = await _getDictDataByUrl(runtimeStore.editDict, DictType.article)
        runtimeStore.editDict = r
      }

      if (base.article.bookList.find(book => book.id === runtimeStore.editDict.id)) {
        if (CAN_REQUEST) {
          let res = await detail({id: runtimeStore.editDict.id})
          if (res.success) {
            runtimeStore.editDict.statistics = res.data.statistics
            if (res.data.articles.length) {
              runtimeStore.editDict.articles = res.data.articles
            }
          }
        }
      }
      if (runtimeStore.editDict.articles.length) {
        selectArticle = runtimeStore.editDict.articles[0]
      }
      loading = false
    }
  }
}

onMounted(init)

function formClose() {
  if (isEdit) isEdit = false
  else router.back()
}

const {
  isArticleCollect,
  toggleArticleCollect
} = useArticleOptions()

const {data: book_list} = useFetch(resourceWrap(DICT_LIST.ARTICLE.ALL)).json()

function reset() {
  MessageBox.confirm(
      t('RestoreDefaultConfirm'),
      t('RestoreDefault'),
      async () => {
        let dict = book_list.value.find(v => v.url === runtimeStore.editDict.url) as Dict
        if (dict && dict.id) {
          dict = await _getDictDataByUrl(dict, DictType.article)
          let rIndex = base.article.bookList.findIndex(v => v.id === runtimeStore.editDict.id)
          if (rIndex > -1) {
            let item = base.article.bookList[rIndex]
            item.custom = false
            item.id = dict.id
            item.articles = dict.articles
            if (item.lastLearnIndex >= item.articles.length) {
              item.lastLearnIndex = item.articles.length - 1
            }
            runtimeStore.editDict = item
            Toast.success(t('RestoreSuccess'))
            return
          }
        }
        Toast.error(t('RestoreFailed'))
      }
  )
}

const currentPractice = $computed(() => {
  if (runtimeStore.editDict.statistics?.length) {
    return runtimeStore.editDict.statistics.filter(v => v.title === selectArticle.title)
  }
  return []
})

const totalSpend = $computed(() => {
  if (runtimeStore.editDict.statistics?.length) {
    return msToHourMinute(total(runtimeStore.editDict.statistics, 'spend'), t)
  }
  return 0
})

function next() {
  if (!settingStore.articleAutoPlayNext) return
  let index = runtimeStore.editDict.articles.findIndex(v => v.id === selectArticle.id)
  if (index > -1) {
    //如果是最后一个
    if (index === runtimeStore.editDict.articles.length - 1) index = -1
    selectArticle = runtimeStore.editDict.articles[index + 1]
  }
}
</script>

<template>
  <BasePage>
    <div class="card mb-0 h-[95vh] flex flex-col" v-if="showBookDetail">
      <div class="flex justify-between items-center relative">
        <BackIcon class="z-2"/>
        <div class="absolute text-2xl text-align-center w-full">{{ runtimeStore.editDict.name }}</div>
        <div class="flex">
          <BaseButton v-if="runtimeStore.editDict.custom && runtimeStore.editDict.url" type="info" @click="reset">
            {{ t('RestoreDefault') }}
          </BaseButton>
          <BaseButton :loading="studyLoading||loading" type="info" @click="isEdit = true">{{ t('Edit') }}</BaseButton>
          <BaseButton type="info" @click="router.push('batch-edit-article')">{{ t('ArticleManagement') }}</BaseButton>
          <BaseButton :loading="studyLoading||loading" @click="addMyStudyList">{{ t('Learn') }}</BaseButton>
        </div>
      </div>
      <div class="text-lg  ">{{ t('Introduction') }}{{ runtimeStore.editDict.description }}</div>
      <div class="text-base  " v-if="totalSpend">{{ t('TotalLearningTime') }}：{{ totalSpend }}</div>

      <div class="line my-3"></div>

      <div class="flex flex-1 overflow-hidden">
        <div class="left flex-[2] scroll p-0">
          <ArticleList
              v-if="runtimeStore.editDict.length"
              @title="handleCheckedChange"
              @click="handleCheckedChange"
              :list="runtimeStore.editDict.articles"
              :active-id="selectArticle.id">
            <template v-slot:suffix="{item,index}">
              <BaseIcon
                  :class="!isArticleCollect(item)?'collect':'fill'"
                  @click.stop="toggleArticleCollect(item)"
                  :title="!isArticleCollect(item) ? t('Collect') : t('Uncollect')">
                <IconFluentStar16Regular v-if="!isArticleCollect(item)"/>
                <IconFluentStar16Filled v-else/>
              </BaseIcon>
            </template>
          </ArticleList>
          <Empty v-else/>
        </div>
        <div class="right flex-[4] shrink-0 pl-4 overflow-auto">
          <div v-if="selectArticle.id">
            <div class="font-family text-base mb-4 pr-2" v-if="currentPractice.length">
              <div class="text-2xl font-bold">{{ t('LearningRecord') }}</div>
              <div class="mt-1 mb-3">{{ t('TotalLearningTime') }}：{{ msToHourMinute(total(currentPractice, 'spend'), t) }}</div>
              <div
                  class="item border border-item border-solid mt-2 p-2 bg-[var(--bg-history)] rounded-md flex justify-between"
                  v-for="i in currentPractice">
                <span class="color-gray">{{ _dateFormat(i.startDate, 'YYYY/MM/DD HH:mm') }}</span>
                <span>{{ msToHourMinute(i.spend, t) }}</span>
              </div>
            </div>
            <div class="en-article-family title text-xl">
              <div class="text-center text-2xl my-2">
                <ArticleAudio
                    :article="selectArticle"
                    :autoplay="settingStore.articleAutoPlayNext"
                    @ended="next"/>
              </div>
              <div class="text-center text-2xl">{{ selectArticle.title }}</div>
              <div class="text-2xl" v-if="selectArticle.text">
                <div class="my-5" v-for="t in selectArticle.text.split('\n\n')">{{ t }}</div>
              </div>
            </div>
            <div class="mt-2">
              <div class="text-center text-2xl">{{ selectArticle.titleTranslate }}</div>
              <div class="text-xl" v-if="selectArticle.textTranslate">
                <div class="my-5" v-for="t in selectArticle.textTranslate.split('\n\n')">{{ t }}</div>
              </div>
              <Empty v-else/>
            </div>
          </div>
          <Empty v-else/>
        </div>
      </div>
    </div>

    <div class="card mb-0 h-[95vh]" v-else>
      <div class="flex justify-between items-center relative">
        <BackIcon class="z-2" @click="isAdd ? $router.back():(isEdit = false)"/>
        <div class="absolute text-2xl text-align-center w-full">{{ runtimeStore.editDict.id ? t('ModifyBook') : t('CreateBook') }}{{ t('Book') }}
        </div>
      </div>
      <div class="center">
        <EditBook
            :is-add="isAdd"
            :is-book="true"
            @close="formClose"
            @submit="isEdit = isAdd = false"
        />
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">

</style>
