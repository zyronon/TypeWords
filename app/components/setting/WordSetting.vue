<script setup lang="ts">
import { InputNumber, Slider, Switch, Radio, RadioGroup } from '@/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '@/core/stores/setting.ts'
import { IdentifyMethod } from '@/core/types'

const settingStore = useSettingStore()
</script>

<template>
  <div>
    <SettingItem :title="$t('show_prev_next_word')" :desc="$t('show_prev_next_word_desc')">
      <Switch v-model="settingStore.showNearWord" />
    </SettingItem>

    <SettingItem :title="$t('clear_input_on_error')">
      <Switch v-model="settingStore.inputWrongClear" />
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
        <InputNumber v-model="settingStore.repeatCustomCount" :min="6" :max="15" type="number" />
      </div>
    </SettingItem>

    <SettingItem :title="$t('review_ratio')" :desc="$t('review_ratio_desc')">
      <InputNumber :min="0" :max="10" v-model="settingStore.wordReviewRatio" />
    </SettingItem>

    <SettingItem title="无到期词时加入随机复习" desc="开启后，智能学习没有到期复习词时，会从已学单词中随机补充复习词">
      <Switch v-model="settingStore.autoAddRandomReviewWhenNoDue" />
    </SettingItem>

    <SettingItem title="显示词源和相关词" desc="单词的词源和相关词可能有误，请谨慎使用">
      <Switch v-model="settingStore.showEtymologyAndRelWords" />
    </SettingItem>

    <SettingItem title="显示练习引导">
      <Switch v-model="settingStore.showUsageTips" />
    </SettingItem>

    <div class="line"></div>
    <SettingItem :mainTitle="`例句设置`" />
    <SettingItem :title="$t('practice_sentence')">
      <Switch v-model="settingStore.practiceSentence" />
    </SettingItem>
    <SettingItem :title="$t('auto_play_first_sentence')" :desc="$t('auto_play_first_sentence_desc')">
      <Switch v-model="settingStore.autoPlayFirstSentence" />
    </SettingItem>

    <!--          自动切换-->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('auto_switch')" />
    <SettingItem :title="$t('auto_next_word')" :desc="$t('auto_next_word_desc')">
      <Switch v-model="settingStore.autoNextWord" />
    </SettingItem>

    <SettingItem
      v-if="settingStore.autoNextWord"
      :title="$t('auto_next_word_time')"
      :desc="$t('auto_next_word_time_desc')"
    >
      <InputNumber v-model="settingStore.waitTimeForChangeWord" :min="0" :max="10000" :step="50" type="number" />
      <span class="ml-4">{{ $t('milliseconds') }}</span>
    </SettingItem>

    <SettingItem
      v-else
      title="空格冷却时间"
      desc="手动模式下，单词完成后为避免同时按下最后一个字母和空格键时跳过，忽略空格键的时间"
    >
      <InputNumber
        v-model="settingStore.spaceCooldownTime"
        :disabled="settingStore.autoNextWord"
        :min="0"
        :max="10000"
        :step="50"
        type="number"
      />
      <span class="ml-4">{{ $t('milliseconds') }}</span>
    </SettingItem>

    <!--          字体设置-->
    <div class="line"></div>
    <SettingItem :mainTitle="$t('font_setting')" />
    <SettingItem :title="$t('foreign_font')">
      <Slider :min="10" :max="100" v-model="settingStore.fontSize.wordForeignFontSize" showText showValue unit="px" />
    </SettingItem>
    <SettingItem :title="$t('chinese_font')">
      <Slider :min="10" :max="100" v-model="settingStore.fontSize.wordTranslateFontSize" showText showValue unit="px" />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss"></style>
