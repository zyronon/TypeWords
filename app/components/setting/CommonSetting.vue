<script setup lang="ts">
import { Switch, Textarea } from '@/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '@/core/stores/setting.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { ShortcutKey } from '@/core/types'

const settingStore = useSettingStore()
const store = useBaseStore()

const simpleWords = $computed({
  get: () => store.simpleWords.join(','),
  set: v => {
    try {
      store.simpleWords = v.split(',')
    } catch (e) {}
  },
})
</script>

<template>
  <div>
    <SettingItem :title="$t('ignore_case')" desc="开启后，输入时不区分大小写，如输入“hello”和“Hello”都会被认为是正确的">
      <Switch v-model="settingStore.ignoreCase" />
    </SettingItem>

    <div class="line"></div>
    <SettingItem :title="$t('simple_word_filter')" :desc="$t('simple_word_filter_desc')">
      <Switch v-model="settingStore.ignoreSimpleWord" />
    </SettingItem>

    <SettingItem :title="$t('simple_word_list')" class="items-start!" v-if="settingStore.ignoreSimpleWord">
      <Textarea
        :placeholder="$t('words_comma_separated')"
        v-model="simpleWords"
        :autosize="{ minRows: 6, maxRows: 10 }"
      />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss"></style>
