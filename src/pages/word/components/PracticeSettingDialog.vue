<script setup lang="ts">

import {_getAccomplishDays} from "@/utils";
import Radio from "@/components/base/radio/Radio.vue";
import RadioGroup from "@/components/base/radio/RadioGroup.vue";
import BaseButton from "@/components/BaseButton.vue";
import Checkbox from "@/components/base/checkbox/Checkbox.vue";
import Slider from "@/components/base/Slider.vue";
import {useBaseStore} from "@/stores/base.ts";
import {defineAsyncComponent, watch} from "vue";
import {useSettingStore} from "@/stores/setting.ts";
import Toast from "@/components/base/toast/Toast.ts";
import ChangeLastPracticeIndexDialog from "@/pages/word/components/ChangeLastPracticeIndexDialog.vue";
import Tooltip from "@/components/base/Tooltip.vue";
import { useRuntimeStore } from "@/stores/runtime.ts";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const Dialog = defineAsyncComponent(() => import('@/components/dialog/Dialog.vue'))

const store = useBaseStore()
const settings = useSettingStore()
const runtimeStore = useRuntimeStore()

const model = defineModel()

defineProps<{
  showLeftOption: boolean,
}>()

const emit = defineEmits<{
  ok: [];
}>()

let show = $ref(false)
let tempPerDayStudyNumber = $ref(0)
let tempLastLearnIndex = $ref(0)
let temPracticeMode = $ref(0)
let tempDisableShowPracticeSettingDialog = $ref(false)


function changePerDayStudyNumber() {
  runtimeStore.editDict.perDayStudyNumber = tempPerDayStudyNumber
  runtimeStore.editDict.lastLearnIndex = tempLastLearnIndex
  settings.wordPracticeMode = temPracticeMode
  settings.disableShowPracticeSettingDialog = tempDisableShowPracticeSettingDialog
  emit('ok')
}

watch(() => model.value, (n) => {
  if (n) {
    if (runtimeStore.editDict.id) {
      tempPerDayStudyNumber = runtimeStore.editDict.perDayStudyNumber
      tempLastLearnIndex = runtimeStore.editDict.lastLearnIndex
      temPracticeMode = settings.wordPracticeMode
      tempDisableShowPracticeSettingDialog = settings.disableShowPracticeSettingDialog
    } else {
      Toast.warning(t('PleaseSelectDict'))
    }
  }
})
</script>

<template>
  <Dialog v-model="model" :title="t('LearningSettings')" :footer="true"
          @ok="changePerDayStudyNumber">
    <div class="target-modal color-main">
      <div class="text-center mt-2 mb-8">
        <span>{{ t('StartFrom') }}<span class="text-3xl mx-2 lh">{{ tempLastLearnIndex }}</span>{{ t('WordsStart') }}</span>
        <span>{{ t('Daily') }}<span class="text-3xl mx-2 lh">{{ tempPerDayStudyNumber }}</span>{{ t('WordsPerDay') }}</span>
        <span>{{ t('EstimatedDays') }}<span
            class="text-3xl mx-2 lh">{{
            _getAccomplishDays(runtimeStore.editDict.length - tempLastLearnIndex, tempPerDayStudyNumber)
          }}</span>{{ t('DaysToComplete') }}</span>
      </div>
      <div class="flex mb-4 gap-space">
        <span class="shrink-0">{{ t('DailyLearning') }}</span>
        <Slider :min="10"
                :step="10"
                show-text
                class="mt-1"
                :max="200" v-model="tempPerDayStudyNumber"/>
      </div>
      <div class="mb-6 flex gap-space">
        <span class="shrink-0">{{ t('LearningProgress') }}</span>
        <div class="flex-1">
          <Slider :min="0"
                  :step="10"
                  show-text
                  class="my-1"
                  :max="runtimeStore.editDict.words.length" v-model="tempLastLearnIndex"/>
          <BaseButton @click="show = true">{{ t('SelectStartPositionFromDict') }}</BaseButton>
        </div>
      </div>

      <div class="gap-space">
        <RadioGroup v-model="temPracticeMode" class="flex-col gap-0!">
          <Radio :value="0" :label="t('SmartMode')"/>
          <Radio :value="1" :label="t('FreeMode')"/>
        </RadioGroup>
      </div>
    </div>
    <template v-slot:footer-left v-if="showLeftOption">
      <div class="flex items-center">
        <Checkbox v-model="tempDisableShowPracticeSettingDialog"/>
        <Tooltip :title="t('CanChangeInSettings')">
          <span class="text-sm">{{ t('KeepDefaultNoShow') }}</span>
        </Tooltip>
      </div>
    </template>
  </Dialog>
  <ChangeLastPracticeIndexDialog
      v-model="show"
      @ok="e => {
        tempLastLearnIndex = e
        show = false
      }"
  />
</template>

<style scoped lang="scss">

.target-modal {
  width: 30rem;
  padding: 0 var(--space);

  .lh {
    color: rgb(176, 116, 211)
  }
}
</style>
