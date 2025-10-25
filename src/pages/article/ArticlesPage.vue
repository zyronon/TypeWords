<script setup lang="ts">
import { useBaseStore } from "@/stores/base.ts";
import { useRouter } from "vue-router";
import BasePage from "@/components/BasePage.vue";
import { _getDictDataByUrl, msToHourMinute, resourceWrap, total, useNav } from "@/utils";
import { DictResource, DictType } from "@/types/types.ts";
import { useRuntimeStore } from "@/stores/runtime.ts";
import BaseIcon from "@/components/BaseIcon.vue";
import Book from "@/components/Book.vue";
import Progress from '@/components/base/Progress.vue';
import Toast from '@/components/base/toast/Toast.ts'
import BaseButton from "@/components/BaseButton.vue";
import PopConfirm from "@/components/PopConfirm.vue";
import { watch } from "vue";
import { getDefaultDict } from "@/types/func.ts";
import DeleteIcon from "@/components/icon/DeleteIcon.vue";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isoWeek from 'dayjs/plugin/isoWeek'
import { useFetch } from "@vueuse/core";
import { CAN_REQUEST, DICT_LIST, PracticeSaveArticleKey } from "@/config/env.ts";
import { myDictList } from "@/apis";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()

dayjs.extend(isoWeek)
dayjs.extend(isBetween);

const {nav} = useNav()
const base = useBaseStore()
const store = useBaseStore()
const router = useRouter()
const runtimeStore = useRuntimeStore()
let isSaveData = $ref(false)

watch(() => store.load, n => {
  if (n) init()
}, {immediate: true})

async function init() {
  if (CAN_REQUEST) {
    let res = await myDictList({type: "article"})
    if (res.success) {
      store.setState(Object.assign(store.$state, res.data))
    }
  }
  if (store.article.studyIndex >= 1) {
    if (!store.sbook.custom && !store.sbook.articles.length) {
      store.article.bookList[store.article.studyIndex] = await _getDictDataByUrl(store.sbook, DictType.article)
    }
  }
  let d = localStorage.getItem(PracticeSaveArticleKey.key)
  if (d) {
    try {
      let obj = JSON.parse(d)
      let data = obj.val
      //如果全是0，说明未进行练习，直接重置
      if (
          data.practiceData.sectionIndex === 0 &&
          data.practiceData.sentenceIndex === 0 &&
          data.practiceData.wordIndex === 0
      ) {
        throw new Error()
      }
      isSaveData = true
    } catch (e) {
      localStorage.removeItem(PracticeSaveArticleKey.key)
    }
  }
}

function startStudy() {
  // console.log(store.sbook.articles[1])
  // genArticleSectionData(cloneDeep(store.sbook.articles[1]))
  // return
  if (base.sbook.id) {
    if (!base.sbook.articles.length) {
      return Toast.warning(t('NoArticlesToLearn'))
    }
    nav('/practice-articles/' + store.sbook.id)
  } else {
    window.umami?.track('no-book')
    Toast.warning(t('SelectBookFirst'))
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
  Toast.success(t('DeleteSuccess'))
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
  nav('book-detail')
}

const totalSpend = $computed(() => {
  if (base.sbook.statistics?.length) {
    return msToHourMinute(total(base.sbook.statistics, 'spend'))
  }
  return 0
})
const todayTotalSpend = $computed(() => {
  if (base.sbook.statistics?.length) {
    return msToHourMinute(total(base.sbook.statistics.filter(v => dayjs(v.startDate).isSame(dayjs(), 'day')), 'spend'))
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
  const list = Array(7).fill(false);

  // 获取本周的起止时间
  const startOfWeek = dayjs().startOf('isoWeek'); // 周一
  const endOfWeek = dayjs().endOf('isoWeek');     // 周日

  store.sbook.statistics?.forEach(item => {
    const date = dayjs(item.startDate);
    if (date.isBetween(startOfWeek, endOfWeek, null, '[]')) {
      let idx = date.day();
      // dayjs().day() 0=周日, 1=周一, ..., 6=周六
      // 需要转换为 0=周一, ..., 6=周日
      if (idx === 0) {
        idx = 6; // 周日放到最后
      } else {
        idx = idx - 1; // 其余前移一位
      }
      list[idx] = true;
    }
  });
  return list
})

const {data: recommendBookList, isFetching} = useFetch(resourceWrap(DICT_LIST.ARTICLE.RECOMMENDED)).json()


</script>

<template>
  <BasePage>
    <div class="card flex justify-between gap-space">
      <div>
        <Book
            v-if="base.sbook.id"
            :is-add="false"
            :quantifier="t('ArticleQuantifier')"
            :item="base.sbook"
            :show-progress="false"
            @click="goBookDetail(base.sbook)"/>
        <Book v-else
              :is-add="true"
              @click="router.push('/book-list')"/>
      </div>
      <div class="flex-1">
        <div class="flex items-center">
          <div class="title mr-4">{{ t('WeeklyLearningRecord') }}</div>
          <div class="flex gap-4 color-gray">
            <div
                class="w-8 h-8 rounded-md center"
                :class="item ? 'bg-[#409eff] color-white' : 'bg-gray-200'"
                v-for="(item, i) in weekList"
                :key="i"
            >{{ i + 1 }}
            </div>
          </div>
        </div>
        <div class="flex gap-4 items-center mt-3 gap-space">
          <div class="stat">
            <div class="num">{{ todayTotalSpend }}</div>
            <div class="txt">{{ t('TodayLearningTime') }}</div>
          </div>
          <div class="stat">
            <div class="num">{{ totalDay }}</div>
            <div class="txt">{{ t('TotalLearningDays') }}</div>
          </div>
          <div class="stat">
            <div class="num">{{ totalSpend }}</div>
            <div class="txt">{{ t('TotalLearningTime') }}</div>
          </div>
        </div>

        <Progress class="mt-3"
                  :percentage="base.currentBookProgress"
                  :format="()=> `${ base.sbook?.lastLearnIndex || 0 }/${base.sbook?.length || 0}${t('ArticleQuantifier')}`"
                  :show-text="true"></Progress>
      </div>
      <div class="flex flex-col justify-between items-end">
        <div class="flex gap-4 items-center" v-opacity="base.sbook.id">
          <div class="color-blue cursor-pointer" @click="router.push('/book-list')">{{ t('Change') }}</div>
        </div>
        <BaseButton size="large"
                    @click="startStudy"
                    :disabled="!base.currentBook.name">
          <div class="flex items-center gap-2">
            <span class="line-height-[2]">{{ isSaveData ? t('ContinueLearning') : t('StartLearning') }}</span>
            <IconFluentArrowCircleRight16Regular class="text-xl"/>
          </div>
        </BaseButton>
      </div>
    </div>

    <div class="card  flex flex-col">
      <div class="flex justify-between">
        <div class="title">{{ t('MyBooks') }}</div>
        <div class="flex gap-4 items-center">
          <PopConfirm :title="t('ConfirmDeleteBooks')" @confirm="handleBatchDel" v-if="selectIds.length">
            <BaseIcon class="del" :title="t('Delete')">
              <DeleteIcon/>
            </BaseIcon>
          </PopConfirm>

          <div class="color-blue cursor-pointer" v-if="base.article.bookList.length > 1"
               @click="isMultiple = !isMultiple; selectIds = []">{{ isMultiple ? t('Cancel') : t('ManageBooks') }}
          </div>
          <div class="color-blue cursor-pointer" @click="nav('book-detail', { isAdd: true })">{{ t('CreatePersonalBook') }}</div>
        </div>
      </div>
      <div class="flex gap-4 flex-wrap mt-4">
        <Book :is-add="false"
              :quantifier="t('ArticleQuantifier')"
              :item="item"
              :checked="selectIds.includes(item.id)"
              @check="() => toggleSelect(item)"
              :show-checkbox="isMultiple && j >= 1"
              v-for="(item, j) in base.article.bookList"
              @click="goBookDetail(item)"/>
        <Book :is-add="true" @click="router.push('/book-list')"/>
      </div>
    </div>


    <div class="card flex flex-col min-h-50" v-loading="isFetching">
      <div class="flex justify-between">
        <div class="title">{{ t('Recommended') }}</div>
        <div class="flex gap-4 items-center">
          <div class="color-blue cursor-pointer" @click="router.push('/book-list')">{{ t('More') }}</div>
        </div>
      </div>

      <div class="flex gap-4 flex-wrap  mt-4">
        <Book :is-add="false"
              :quantifier="t('ArticleQuantifier')"
              :item="item as any"
              v-for="(item, j) in recommendBookList" @click="goBookDetail(item as any)"/>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.stat {
  @apply rounded-xl p-4 box-border relative flex-1;
  background: white;
  border: 1px solid gainsboro;

  .num {
    @apply color-[#409eff] text-xl font-bold;
  }

  .txt {
    @apply color-gray-500;
  }
}
</style>
