<script setup lang="ts">
import { BaseButton, BaseIcon, BasePage, DeleteIcon, PopConfirm, Progress, Toast } from '@/base'
import Book from '@/components/Book.vue'
import { APP_NAME, DICT_LIST } from '@/core/config/env.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { getDefaultDict } from '@/core/types/func.ts'
import type { DictResource } from '@/core/types/types.ts'
import { _getDictDataByUrl, msToHourMinute, resourceWrap, total, useNav } from '@/core/utils'
import { useFetch } from '@vueuse/core'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isoWeek from 'dayjs/plugin/isoWeek'
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { DictType } from '@/core/types/enum.ts'
import { usePracticeArticlePersistence } from '@/core/composables/usePracticePersistence.ts'

dayjs.extend(isoWeek)
dayjs.extend(isBetween)

useSeoMeta({
  title: `英语文章跟打练习｜${APP_NAME}`,
  description: '在电脑上进行英语文章跟打、逐句精听和键盘输入练习，通过真实语境提升英语阅读、听力与拼写能力。',
  ogTitle: `英语文章跟打练习｜${APP_NAME}`,
  ogDescription: '使用英语文章跟打、逐句精听和键盘输入练习，在真实语境中提升英语能力。',
  twitterTitle: `英语文章跟打练习｜${APP_NAME}`,
  twitterDescription: '使用英语文章跟打、逐句精听和键盘输入练习，在真实语境中提升英语能力。',
})

const { nav } = useNav()
const base = useBaseStore()
const store = useBaseStore()
const settingStore = useSettingStore()
const router = useRouter()
const runtimeStore = useRuntimeStore()
let isSaveData = $ref(false)
const articlePersistence = usePracticeArticlePersistence()

watch(
  [() => store.load, () => runtimeStore.globalLoading],
  ([a, b]) => {
    if (a && !b) {
      init()
    }
  },
  { immediate: true }
)

async function onvisibilitychange() {
  if (!document.hidden) {
    //当页面可见时，检查是否需要从远程拉取数据
    const d = await articlePersistence.load()
    if (d) {
      isSaveData = true
    }
  }
}

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
})

async function init() {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)
  let studyIndex = store.article.studyIndex
  if (studyIndex >= 1) {
    if (!store.sbook.custom && !store.sbook.articles.length) {
      let dictList = await fetch(resourceWrap(DICT_LIST.ARTICLE.ALL)).then(r => r.json())
      let dict = await _getDictDataByUrl(store.sbook, DictType.article)
      let r = dictList.find(v => [v.enName, v.id].includes(store.sbook.id))
      if (r) {
        store.article.bookList[studyIndex].articles = dict.articles
        store.article.bookList[studyIndex].id = r.id
        store.article.bookList[studyIndex].enName = r.enName
        store.article.bookList[studyIndex].cover = r.cover
        store.article.bookList[studyIndex].category = r.category
        store.article.bookList[studyIndex].tags = r.tags
        store.article.bookList[studyIndex].url = r.url
        store.article.bookList[studyIndex].description = r.description
        store.article.bookList[studyIndex].name = r.name
      } else {
        store.article.bookList[studyIndex] = dict
      }
      store.article.bookList[studyIndex].length = dict.articles.length
      let s = store.article.bookList[studyIndex]
      if (s.lastLearnIndex > s.length) {
        store.article.bookList[studyIndex].lastLearnIndex = s.length
        store.article.bookList[studyIndex].complete = true
        //todo 后续加上
        // await resetCacheData()
      }
    }
  }
  const d = await articlePersistence.load()
  if (d) {
    isSaveData = true
  }
}

function startStudy() {
  // console.log(store.sbook.articles[1])
  // genArticleSectionData(cloneDeep(store.sbook.articles[1]))
  // return
  if (base.sbook.id) {
    if (!base.sbook.articles.length) {
      return Toast.warning('没有文章可学习！')
    }
    window.umami?.track('startStudyArticle', {
      name: base.sbook.name,
      custom: base.sbook.custom,
      complete: base.sbook.complete,
      s: `name:${base.sbook.name},index:${base.sbook.lastLearnIndex},title:${base.sbook.articles[base.sbook.lastLearnIndex].title}`,
    })
    nav('/practice-articles/' + store.sbook.id)
  } else {
    window.umami?.track('no-book')
    Toast.warning('请先选择一本书籍')
  }
}

let isMultiple = $ref(false)
let selectIds = $ref([])

function handleBatchDel() {
  selectIds.forEach(id => {
    let r = base.article.bookList.findIndex(v => v.id === id)
    if (r !== -1) {
      if (base.article.studyIndex === r) {
        base.article.studyIndex = -1
      }
      if (base.article.studyIndex > r) {
        base.article.studyIndex--
      }
      base.article.bookList.splice(r, 1)
    }
  })
  selectIds = []
  Toast.success('删除成功！')
}

function toggleSelect(item) {
  let rIndex = selectIds.findIndex(v => v === item.id)
  if (rIndex > -1) {
    selectIds.splice(rIndex, 1)
  } else {
    selectIds.push(item.id)
  }
}

async function goBookDetail(val: DictResource) {
  runtimeStore.editDict = getDefaultDict(val)
  // nav('book',{id: val.id})
  nav('/book/' + val.id)
}

const totalSpend = $computed(() => {
  if (base.sbook.statistics?.length) {
    return msToHourMinute(total(base.sbook.statistics, 'spend'))
  }
  return 0
})
const todayTotalSpend = $computed(() => {
  if (base.sbook.statistics?.length) {
    return msToHourMinute(
      total(
        base.sbook.statistics.filter(v => dayjs(v.startDate).isSame(dayjs(), 'day')),
        'spend'
      )
    )
  }
  return 0
})

const totalDay = $computed(() => {
  if (base.sbook.statistics?.length) {
    return new Set(base.sbook.statistics.map(v => dayjs(v.startDate).format('YYYY-MM-DD'))).size
  }
  return 0
})

const weekList = $computed(() => {
  const list = Array(7).fill(false)

  // 获取本周的起止时间
  const startOfWeek = dayjs().startOf('isoWeek') // 周一
  const endOfWeek = dayjs().endOf('isoWeek') // 周日

  store.sbook.statistics?.forEach(item => {
    const date = dayjs(item.startDate)
    if (date.isBetween(startOfWeek, endOfWeek, null, '[]')) {
      let idx = date.day()
      // dayjs().day() 0=周日, 1=周一, ..., 6=周六
      // 需要转换为 0=周一, ..., 6=周日
      if (idx === 0) {
        idx = 6 // 周日放到最后
      } else {
        idx = idx - 1 // 其余前移一位
      }
      list[idx] = true
    }
  })
  return list
})

const { data: recommendBookList, isFetching } = useFetch(resourceWrap(DICT_LIST.ARTICLE.RECOMMENDED)).json()
</script>

<template>
  <BasePage>
    <div class="card flex flex-col md:flex-row justify-between gap-space p-4 md:p-6">
      <div class="">
        <Book
          v-if="base.sbook.id"
          :is-add="false"
          quantifier="篇"
          :item="base.sbook"
          :show-progress="false"
          @click="goBookDetail(base.sbook)"
        />
        <Book v-else :is-add="true" @click="router.push('/book-list')" />
      </div>
      <div class="flex-1">
        <div class="flex justify-between items-start">
          <div class="flex items-center min-w-0">
            <div class="title mr-4 truncate">{{ $t('this_week_record') }}</div>
            <div class="flex gap-4 color-gray">
              <div
                class="w-6 h-6 md:w-8 md:h-8 rounded-md center text-sm md:text-base"
                :class="item ? 'bg-[#409eff] color-white' : 'bg-gray-200'"
                v-for="(item, i) in weekList"
                :key="i"
              >
                {{ i + 1 }}
              </div>
            </div>
          </div>
          <div class="flex gap-4 items-center" v-opacity="base.sbook.id">
            <div class="color-link cursor-pointer" @click="router.push('/book-list')">{{ $t('change_book') }}</div>
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-3 items-center mt-3 gap-space w-full">
          <div
            class="w-full sm:flex-1 rounded-xl p-4 box-border relative bg-[var(--bg-history)] border border-gray-200"
          >
            <div class="text-[#409eff] text-xl font-bold">{{ todayTotalSpend }}</div>
            <div class="text-gray-500">{{ $t('today_study_time') }}</div>
          </div>
          <div
            class="w-full sm:flex-1 rounded-xl p-4 box-border relative bg-[var(--bg-history)] border border-gray-200"
          >
            <div class="text-[#409eff] text-xl font-bold">{{ totalDay }}</div>
            <div class="text-gray-500">{{ $t('total_study_days') }}</div>
          </div>
          <div
            class="w-full sm:flex-1 rounded-xl p-4 box-border relative bg-[var(--bg-history)] border border-gray-200"
          >
            <div class="text-[#409eff] text-xl font-bold">{{ totalSpend }}</div>
            <div class="text-gray-500">{{ $t('total_study_time') }}</div>
          </div>
        </div>
        <div class="flex gap-3 mt-3">
          <Progress
            class="w-full md:w-auto"
            size="large"
            :percentage="base.currentBookProgress"
            :format="() => `${base.sbook?.lastLearnIndex || 0}/${base.sbook?.length || 0}篇`"
            :show-text="true"
          ></Progress>

          <BaseButton size="large" class="w-full md:w-auto" @click="startStudy" :disabled="!base.sbook.name">
            <div class="flex items-center gap-2 justify-center w-full">
              <span class="line-height-[2]">{{ isSaveData ? $t('continue_learning') : $t('start_learning') }}</span>
              <IconFluentArrowCircleRight16Regular class="text-xl" />
            </div>
          </BaseButton>
        </div>
      </div>
    </div>

    <div class="card flex flex-col">
      <div class="flex justify-between">
        <div class="title">{{ $t('my_books') }}</div>
        <div class="flex gap-4 items-center">
          <PopConfirm title="确认删除所有选中书籍？" @confirm="handleBatchDel" v-if="selectIds.length">
            <BaseIcon class="del" :title="$t('delete')">
              <DeleteIcon />
            </BaseIcon>
          </PopConfirm>

          <div
            class="color-link cursor-pointer"
            v-if="base.article.bookList.length > 1"
            @click="
              () => {
                isMultiple = !isMultiple
                selectIds = []
              }
            "
          >
            {{ isMultiple ? $t('cancel') : $t('manage_books') }}
          </div>
          <div class="color-link cursor-pointer" @click="nav('/book/new', { isAdd: true })">
            {{ $t('create_personal_book') }}
          </div>
        </div>
      </div>
      <div class="flex gap-4 flex-wrap mt-4">
        <Book
          :is-add="false"
          :is-user="true"
          quantifier="篇"
          :item="item"
          :checked="selectIds.includes(item.id)"
          @check="() => toggleSelect(item)"
          :show-checkbox="isMultiple && j >= 1"
          v-for="(item, j) in base.article.bookList"
          @click="goBookDetail(item)"
        />
        <Book :is-add="true" @click="router.push('/book-list')" />
      </div>
    </div>

    <div class="card flex flex-col min-h-50" v-loading="isFetching">
      <div class="flex justify-between">
        <div class="title">{{ $t('recommend') }}</div>
        <div class="flex gap-4 items-center">
          <div class="color-link cursor-pointer" @click="router.push('/book-list')">{{ $t('more') }}</div>
        </div>
      </div>

      <div class="flex gap-4 flex-wrap mt-4">
        <Book
          :is-add="false"
          quantifier="篇"
          :item="item as any"
          v-for="(item, j) in recommendBookList"
          @click="goBookDetail(item as any)"
        />
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.stat {
  @apply rounded-xl p-4 box-border relative flex-1 bg-[var(--bg-history)];
  border: 1px solid gainsboro;

  .num {
    @apply color-[#409eff] text-xl font-bold;
  }

  .txt {
    @apply color-gray-500;
  }
}
</style>
