<template>
  <div class="language-select">
    <Select v-model="selectedLang" class="lang-select">
      <template #selected>
        <div class="lang-option" v-if="currentLanguage">
          <span class="flag">{{ currentLanguage.flag }}</span>
          <span class="lang-name">{{ currentLanguage.name }}</span>
        </div>
      </template>
      <Option v-for="lang in languages" :key="lang.code" :value="lang.code">
        <div class="lang-option">
          <span class="flag" :class="lang.code">{{ lang.flag }}</span>
          <span class="lang-name">{{ lang.name }}</span>
        </div>
      </Option>
    </Select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingStore } from '@/stores/setting'
import { Select, Option } from '@/components/base/select'
import { useLanguage } from '@/hooks/useLanguage'
import { getLanguageOption, getSourceLanguageOptions, sanitizeSourceLanguage } from '@/libs/i18n/languages'

const settingStore = useSettingStore()
const { changeLanguage } = useLanguage()

const languages = getSourceLanguageOptions()

const selectedLang = computed({
  get: () => sanitizeSourceLanguage(settingStore.language),
  set: (value) => {
    changeLanguage(sanitizeSourceLanguage(value))
  }
})

const currentLanguage = computed(() => {
  const languageCode = sanitizeSourceLanguage(settingStore.language)
  return getLanguageOption(languageCode)
})
</script>

<style scoped lang="scss">
.language-select {
  display: inline-block;
}

.lang-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flag {
  font-size: 1.2em;
}

.lang-name {
  font-size: 14px;
}

:deep(.lang-select) {
  min-width: 140px;
}
</style>
