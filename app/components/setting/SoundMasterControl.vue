<script setup lang="ts">
import { computed } from 'vue'
import { Slider } from '@/base'
import SettingItem from './SettingItem.vue'
import { useSettingStore } from '@/core/stores/setting'
import type { SettingState } from '@/core/stores/setting'

const props = defineProps<{
  type: 'volume' | 'speed'
  isUnified: boolean
  expanded: boolean
  showSubsInMaster: boolean
  items: { key: keyof SettingState; labelKey: string }[]
}>()

const emit = defineEmits<{
  toggleExpanded: []
}>()

const modelValue = defineModel<number>({ required: true })

const settingStore = useSettingStore()

const titleKey = computed(() => (props.type === 'volume' ? 'master_volume' : 'master_speed'))
const isVolume = computed(() => props.type === 'volume')
</script>

<template>
  <SettingItem :title="$t(titleKey)">
    <div class="flex flex-col gap-3 w-full max-w-full">
      <div class="flex items-center gap-2 w-full">
        <Slider
          v-model="modelValue"
          class="flex-1"
          :disabled="!isUnified"
          :step="isVolume ? 1 : 0.1"
          :min="isVolume ? 0 : 0.5"
          :max="isVolume ? 100 : 3"
          showText
          showValue
          :unit="isVolume ? '%' : undefined"
        />
        <IconFluentChevronDown20Regular
          class="flex-shrink-0 text-lg cursor-pointer transition-transform duration-200"
          :class="{ 'rotate-180': expanded }"
          :title="$t('expand_detail_settings')"
          @click="emit('toggleExpanded')"
        />
      </div>
      <template v-if="showSubsInMaster">
        <div
          v-for="item in items"
          :key="String(item.key)"
          class="flex items-center gap-2 w-full pl-2"
        >
          <span class="text-sm text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 truncate">
            {{ $t(item.labelKey) }}
          </span>
          <Slider
            v-model="settingStore[item.key] as number"
            class="flex-1"
            :step="isVolume ? 1 : 0.1"
            :min="isVolume ? 0 : 0.5"
            :max="isVolume ? 100 : 3"
            showText
            showValue
            :unit="isVolume ? '%' : undefined"
          />
        </div>
      </template>
    </div>
  </SettingItem>
</template>
