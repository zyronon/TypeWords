<template>
  <div class="dual-language-select">
    <div class="language-row">
      <span class="language-label">{{ t('SourceLanguage') }}</span>
      <Select v-model="selectedSourceLang" class="lang-select">
        <Option v-for="lang in sourceLanguages" :key="lang.code" :value="lang.code">
          <div class="lang-option">
            <span class="flag">{{ lang.flag }}</span>
            <span class="lang-name">{{ lang.name }}</span>
          </div>
        </Option>
      </Select>
    </div>

    <div class="arrow-container">
      <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4L12 20M12 20L18 14M12 20L6 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <div class="language-row">
      <span class="language-label">{{ t('TargetLanguage') }}</span>
      <Select v-model="selectedTargetLang" class="lang-select">
        <Option v-for="lang in targetLanguages" :key="lang.code" :value="lang.code">
          <div class="lang-option">
            <span class="flag">{{ lang.flag }}</span>
            <span class="lang-name">{{ lang.name }}</span>
          </div>
        </Option>
      </Select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingStore } from '@/stores/setting'
import { Select, Option } from '@/components/base/select'
import { useLanguage } from '@/hooks/useLanguage'
import { getSourceLanguageOptions, getTargetLanguageOptions, sanitizeSourceLanguage, sanitizeTargetLanguage } from '@/libs/i18n/languages'

const settingStore = useSettingStore()
const { t, changeLanguage, changeTargetLanguage } = useLanguage()

const sourceLanguages = getSourceLanguageOptions()
const targetLanguages = getTargetLanguageOptions()

const selectedSourceLang = computed({
  get: () => sanitizeSourceLanguage(settingStore.language),
  set: (value: string) => {
    changeLanguage(sanitizeSourceLanguage(value))
  }
})

const selectedTargetLang = computed({
  get: () => sanitizeTargetLanguage(settingStore.targetLanguage),
  set: (value: string) => {
    changeTargetLanguage(sanitizeTargetLanguage(value))
  }
})
</script>

<style scoped lang="scss">
.dual-language-select {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.language-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.language-label {
  min-width: 100px;
  font-size: 14px;
  color: var(--color-font-1);
}

.arrow-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 0;
}

.arrow-icon {
  width: 24px;
  height: 24px;
  color: var(--color-font-2);
  opacity: 0.6;
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
  min-width: 160px;
}
</style>
