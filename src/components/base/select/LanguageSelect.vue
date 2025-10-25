<template>
  <div class="language-select">
    <Select v-model="selectedLang" class="lang-select">
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

const settingStore = useSettingStore()
const { changeLanguage } = useLanguage()

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
]

const selectedLang = computed({
  get: () => settingStore.language,
  set: (value) => {
    changeLanguage(value)
  }
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