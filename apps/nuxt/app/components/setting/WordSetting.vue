<script setup lang="ts">

import Switch from "@/components/base/Switch.vue";
import RadioGroup from "@/components/base/radio/RadioGroup.vue";
import InputNumber from "@/components/base/InputNumber.vue";
import Slider from "@/components/base/Slider.vue";
import SettingItem from "@/components/setting/SettingItem.vue";
import Radio from "@/components/base/radio/Radio.vue";
import { useSettingStore } from "@/stores/setting.ts";
const settingStore = useSettingStore()

</script>

<template>
  <div>
    <SettingItem :title="$t('show_prev_next_word')"
                 :desc="$t('show_prev_next_word_desc')"
    >
      <Switch v-model="settingStore.showNearWord"/>
    </SettingItem>

    <SettingItem :title="$t('disable_practice_setting_dialog')"
                 :desc="$t('disable_practice_setting_dialog_desc')"
    >
      <Switch v-model="settingStore.disableShowPracticeSettingDialog"/>
    </SettingItem>

    <SettingItem :title="$t('clear_input_on_error')"
    >
      <Switch v-model="settingStore.inputWrongClear"/>
    </SettingItem>

    <SettingItem :title="$t('practice_sentence')"
    >
      <Switch v-model="settingStore.practiceSentence"/>
    </SettingItem>

    <SettingItem :title="$t('word_repeat_setting')" class="gap-0!">
      <RadioGroup v-model="settingStore.repeatCount">
        <Radio :value="1" size="default">1</Radio>
        <Radio :value="2" size="default">2</Radio>
        <Radio :value="3" size="default">3</Radio>
        <Radio :value="5" size="default">5</Radio>
        <Radio :value="100" size="default">{{ $t('custom') }}</Radio>
      </RadioGroup>
      <div class="ml-2 center gap-space" v-if="settingStore.repeatCount === 100">
        <span>{{ $t('repeat_count') }}</span>
        <InputNumber v-model="settingStore.repeatCustomCount"
                     :min="6"
                     :max="15"
                     type="number"
        />
      </div>
    </SettingItem>

    <SettingItem :title="$t('review_ratio')"
                 :desc="$t('review_ratio_desc')"
    >
      <InputNumber :min="0" :max="10" v-model="settingStore.wordReviewRatio"/>
    </SettingItem>

    <!--          发音-->
    <!--          发音-->
    <!--          发音-->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('sound_effect')"/>
    <SettingItem :title="$t('word_auto_pronunciation')">
      <Switch v-model="settingStore.wordSound"/>
    </SettingItem>
    <SettingItem :title="$t('volume')">
      <Slider v-model="settingStore.wordSoundVolume" showText showValue unit="%"/>
    </SettingItem>
    <SettingItem :title="$t('speed')">
      <Slider v-model="settingStore.wordSoundSpeed" :step="0.1" :min="0.5" :max="3" showText showValue/>
    </SettingItem>
    <div class="line"></div>
    <SettingItem :title="$t('effect_sound')">
      <Switch v-model="settingStore.effectSound"/>
    </SettingItem>
    <SettingItem :title="$t('volume')">
      <Slider v-model="settingStore.effectSoundVolume" showText showValue unit="%"/>
    </SettingItem>

    <!--          自动切换-->
    <!--          自动切换-->
    <!--          自动切换-->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('auto_switch')"/>
    <SettingItem :title="$t('auto_next_word')"
                 :desc="$t('auto_next_word_desc')"
    >
      <Switch v-model="settingStore.autoNextWord"/>
    </SettingItem>

    <SettingItem :title="$t('auto_next_word_time')"
                 :desc="$t('auto_next_word_time_desc')"
    >
      <InputNumber v-model="settingStore.waitTimeForChangeWord"
                   :disabled="!settingStore.autoNextWord"
                   :min="0"
                   :max="10000"
                   :step="100"
                   type="number"
      />
      <span class="ml-4">{{ $t('milliseconds') }}</span>
    </SettingItem>


    <!--          字体设置-->
    <!--          字体设置-->
    <!--          字体设置-->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('font_setting')"/>
    <SettingItem :title="$t('foreign_font')">
      <Slider
          :min="10"
          :max="100"
          v-model="settingStore.fontSize.wordForeignFontSize" showText showValue unit="px"/>
    </SettingItem>
    <SettingItem :title="$t('chinese_font')">
      <Slider
          :min="10"
          :max="100"
          v-model="settingStore.fontSize.wordTranslateFontSize" showText showValue unit="px"/>
    </SettingItem>
  </div>
</template>

<style scoped lang="scss">

</style>
