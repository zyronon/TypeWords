<script setup lang="ts">
import { useBaseStore } from "@/stores/base.ts";
import { useRouter } from "vue-router";
import BaseIcon from "@/components/BaseIcon.vue";
import { _getAccomplishDate, _getDictDataByUrl, resourceWrap, useNav } from "@/utils";
import BasePage from "@/components/BasePage.vue";
import { DictResource } from "@/types/types.ts";
import { watch } from "vue";
import { getCurrentStudyWord } from "@/hooks/dict.ts";
import { useRuntimeStore } from "@/stores/runtime.ts";
import Book from "@/components/Book.vue";
import PopConfirm from "@/components/PopConfirm.vue";
import Progress from '@/components/base/Progress.vue';
import Toast from '@/components/base/toast/Toast.ts';
import BaseButton from "@/components/BaseButton.vue";
import { getDefaultDict } from "@/types/func.ts";
import DeleteIcon from "@/components/icon/DeleteIcon.vue";
import PracticeSettingDialog from "@/pages/word/components/PracticeSettingDialog.vue";
import ChangeLastPracticeIndexDialog from "@/pages/word/components/ChangeLastPracticeIndexDialog.vue";
import { useSettingStore } from "@/stores/setting.ts";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage();
import CollectNotice from "@/components/CollectNotice.vue";
import { useFetch } from "@vueuse/core";
import { CAN_REQUEST, DICT_LIST, PracticeSaveWordKey } from "@/config/env.ts";
import { myDictList } from "@/apis";


const store = useBaseStore()
const settingStore = useSettingStore()
const router = useRouter()
const {nav} = useNav()
const runtimeStore = useRuntimeStore()
let loading = $ref(true)
let isSaveData = $ref(false)
let currentStudy = $ref({
  new: [],
  review: [],
  write: []
})

watch(() => store.load, n => {
  if (n) init()
}, {immediate: true})

async function init() {
  if (CAN_REQUEST) {
    let res = await myDictList({type: "word"})
    if (res.success) {
      store.setState(Object.assign(store.$state, res.data))
    }
  }
  if (store.word.studyIndex >= 3) {
    if (!store.sdict.custom && !store.sdict.words.length) {
      store.word.bookList[store.word.studyIndex] = await _getDictDataByUrl(store.sdict)
    }
  }
  if (!currentStudy.new.length && store.sdict.words.length) {
    let d = localStorage.getItem(PracticeSaveWordKey.key)
    if (d) {
      try {
        let obj = JSON.parse(d)
        currentStudy = obj.val.taskWords
        isSaveData = true
      } catch (e) {
        localStorage.removeItem(PracticeSaveWordKey.key)
        currentStudy = getCurrentStudyWord()
      }
    } else {
      currentStudy = getCurrentStudyWord()
    }
  }
  loading = false
}

function startPractice() {
  if (store.sdict.id) {
    if (!store.sdict.words.length) {
      return Toast.warning(t('NoWordsToLearn'))
    }
    window.umami?.track('startStudyWord', {
      name: store.sdict.name,
      index: store.sdict.lastLearnIndex,
      perDayStudyNumber: store.sdict.perDayStudyNumber,
      custom: store.sdict.custom,
      complete: store.sdict.complete,
      wordPracticeMode: settingStore.wordPracticeMode
    })
    nav('practice-words/' + store.sdict.id, {}, currentStudy)
  } else {
    window.umami?.track('no-dict')
    Toast.warning(t('SelectDictionary'))
  }
}

let showPracticeSettingDialog = $ref(false)
let showChangeLastPracticeIndexDialog = $ref(false)

async function goDictDetail(val: DictResource) {
  runtimeStore.editDict = getDefaultDict(val)
  nav('dict-detail', {})
}

let isMultiple = $ref(false)
let selectIds = $ref([])

function handleBatchDel() {
  selectIds.forEach(id => {
    let r = store.word.bookList.findIndex(v => v.id === id)
    if (r !== -1) {
      if (store.word.studyIndex === r) {
        store.word.studyIndex = -1
      }
      if (store.word.studyIndex > r) {
        store.word.studyIndex--
      }
      store.word.bookList.splice(r, 1)
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

const progressTextLeft = $computed(() => {
  if (store.sdict.complete) return t('CompletedTotalReviewPhase')
  return t('LearnedProgress', { progress: store.currentStudyProgress })
})
const progressTextRight = $computed(() => {
  // if (store.sdict.complete) return store.sdict?.length
  return store.sdict?.lastLearnIndex
})

function check(cb: Function) {
  if (!store.sdict.id) {
    Toast.warning(t('SelectDictionary'))
  } else {
    runtimeStore.editDict = getDefaultDict(store.sdict)
    cb()
  }
}

async function savePracticeSetting() {
  Toast.success(t('ModificationSuccessful'))
  isSaveData = false
  localStorage.removeItem(PracticeSaveWordKey.key)
  await store.changeDict(runtimeStore.editDict)
  currentStudy = getCurrentStudyWord()
}

async function saveLastPracticeIndex(e) {
  Toast.success(t('ModificationSuccessful'))
  runtimeStore.editDict.lastLearnIndex = e
  showChangeLastPracticeIndexDialog = false
  isSaveData = false
  localStorage.removeItem(PracticeSaveWordKey.key)
  await store.changeDict(runtimeStore.editDict)
  currentStudy = getCurrentStudyWord()
}

const {
  data: recommendDictList,
  isFetching
} = useFetch(resourceWrap(DICT_LIST.WORD.RECOMMENDED)).json()

</script>

<template>
  <BasePage>
    <div class="card flex gap-10">
      <div class="flex-1 flex flex-col gap-2">
        <div class="flex">
          <div class="bg-third px-3 h-14 rounded-md flex items-center ">
            <span @click="goDictDetail(store.sdict)"
                  class="text-lg font-bold cursor-pointer">{{ store.sdict.name || t('SelectDictionaryToStart') }}</span>
            <BaseIcon :title="t('SwitchDictionary')"
                      class="ml-4"
                      @click="router.push('/dict-list')"

            >
              <IconFluentArrowSort20Regular v-if="store.sdict.name"/>
              <IconFluentAdd20Filled v-else/>
            </BaseIcon>
          </div>
        </div>
        <div class="flex items-end gap-space">
          <div class="flex-1">
            <div class="text-sm flex justify-between">
              <span>{{ progressTextLeft }}</span>
              <span>{{ progressTextRight }} / {{ store.sdict.words.length }}</span>
            </div>
            <Progress class="mt-1" :percentage="store.currentStudyProgress" :show-text="false"></Progress>
          </div>
          <PopConfirm
              :disabled="!isSaveData"
              :title="t('UnfinishedLearningTask')"
              @confirm="check(()=>showChangeLastPracticeIndexDialog = true)">
            <div class="color-blue cursor-pointer">{{ t('Change') }}</div>
          </PopConfirm>

        </div>
        <div class="text-sm text-align-end">
          {{ t('EstimatedCompletionDate') }} {{ _getAccomplishDate(store.sdict.words.length, store.sdict.perDayStudyNumber) }}
        </div>
      </div>

      <div class="w-3/10 flex flex-col justify-evenly">
        <div class="center text-xl">{{ isSaveData ? t('LastLearningTask') : t('TodayTask') }}</div>
        <div class="flex">
          <div class="flex-1 flex flex-col items-center">
            <div class="text-4xl font-bold">{{ currentStudy.new.length }}</div>
            <div class="text">{{ t('NewWordCount') }}</div>
          </div>
          <template v-if="settingStore.wordPracticeMode === 0">
            <div class="flex-1 flex flex-col items-center">
              <div class="text-4xl font-bold">{{ currentStudy.review.length }}</div>
              <div class="text">{{ t('Review') }}</div>
            </div>
            <div class="flex-1 flex flex-col items-center">
              <div class="text-4xl font-bold">{{ currentStudy.write.length }}
              </div>
              <div class="text">{{ t('Dictation') }}</div>
            </div>
          </template>
        </div>
      </div>

      <div class="flex flex-col items-end justify-around ">
        <div class="flex gap-1 items-center">
          {{ t('DailyGoal') }}
          <div style="color:#ac6ed1;" @click="check(()=>showPracticeSettingDialog = true)"
               class="bg-third px-2 h-10 flex center text-2xl rounded cursor-pointer">
            {{ store.sdict.id ? store.sdict.perDayStudyNumber : 0 }}
          </div>
          {{ t('Words') }}
          <PopConfirm
              :disabled="!isSaveData"
              :title="t('UnfinishedLearningTask')"
              @confirm="check(()=>showPracticeSettingDialog = true)">
            <span class="color-blue cursor-pointer">{{ t('Change') }}</span>
          </PopConfirm>
        </div>
        <BaseButton size="large" :disabled="!store.sdict.name"
                    :loading="loading"
                    @click="startPractice">
          <div class="flex items-center gap-2">
            <span class="line-height-[2]">{{ isSaveData ? t('ContinueLearning') : t('StartLearning') }}</span>
            <IconFluentArrowCircleRight16Regular class="text-xl"/>
          </div>
        </BaseButton>
      </div>
    </div>

    <div class="card  flex flex-col">
      <div class="flex justify-between">
        <div class="title">{{ t('MyDictionaries') }}</div>
        <div class="flex gap-4 items-center">
          <PopConfirm :title="t('DeleteSelectedDictionaries')" @confirm="handleBatchDel" v-if="selectIds.length">
            <BaseIcon class="del" :title="t('Delete')">
              <DeleteIcon/>
            </BaseIcon>
          </PopConfirm>

          <div class="color-blue cursor-pointer" v-if="store.word.bookList.length > 3"
               @click="isMultiple = !isMultiple; selectIds = []">{{ isMultiple ? t('Cancel') : t('ManageDictionaries') }}
          </div>
          <div class="color-blue cursor-pointer" @click="nav('dict-detail', { isAdd: true })">{{ t('CreatePersonalDictionary') }}</div>
        </div>
      </div>
      <div class="flex gap-4 flex-wrap  mt-4">
        <Book :is-add="false" :quantifier="t('WordQuantifier')" :item="item" :checked="selectIds.includes(item.id)"
              @check="() => toggleSelect(item)" :show-checkbox="isMultiple && j >= 3"
              v-for="(item, j) in store.word.bookList" @click="goDictDetail(item)"/>
        <Book :is-add="true" @click="router.push('/dict-list')"/>
      </div>
    </div>

    <div class="card  flex flex-col overflow-hidden" v-loading="isFetching">
      <div class="flex justify-between">
        <div class="title">{{ t('Recommended') }}</div>
        <div class="flex gap-4 items-center">
          <div class="color-blue cursor-pointer" @click="router.push('/dict-list')">{{ t('More') }}</div>
        </div>
      </div>

      <div class="flex gap-4 flex-wrap  mt-4 min-h-50">
        <Book :is-add="false"
              :quantifier="t('WordQuantifier')"
              :item="item as any"
              v-for="(item, j) in recommendDictList" @click="goDictDetail(item as any)"/>
      </div>
    </div>
  </BasePage>

  <PracticeSettingDialog
      :show-left-option="false"
      v-model="showPracticeSettingDialog"
      @ok="savePracticeSetting"/>

  <ChangeLastPracticeIndexDialog
      v-model="showChangeLastPracticeIndexDialog"
      @ok="saveLastPracticeIndex"
  />

  <CollectNotice/>
</template>

<style scoped lang="scss">
</style>
