<script setup lang="ts">
import { Switch } from '@/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '@/core/stores/setting.ts'

const settingStore = useSettingStore()
</script>

<template>
  <div>
    <SettingItem :title="$t('ignore_symbols_numbers_names')">
      <Switch v-model="settingStore.ignoreSymbol" />
    </SettingItem>
  </div>
</template>

<style scoped lang="scss"></style>
