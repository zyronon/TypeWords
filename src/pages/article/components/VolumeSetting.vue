<script setup lang="ts">

import MiniDialog from "@/components/dialog/MiniDialog.vue";
import { useWindowClick } from "@/hooks/event.ts";
import { useSettingStore } from "@/stores/setting.ts";
import BaseIcon from "@/components/BaseIcon.vue";
import Switch from "@/components/base/Switch.vue";
import { useLanguage } from '@/hooks/useLanguage'

const settingStore = useSettingStore()
const { t } = useLanguage()
let show = $ref(false)
useWindowClick(() => show = false)

</script>

<template>
  <div class="relative"
       @click.stop="null"
  >
    <BaseIcon
        :title="t('PlaybackSettings')"
        @click="show = !show">
      <IconFluentSpeakerSettings20Regular/>
    </BaseIcon>
    <MiniDialog
        width="12rem"
        v-model="show">
      <div class="mini-row-title">
        {{ t('PlaybackSettings') }}
      </div>
      <div class="flex justify-between mb-3">
        <label class="">{{ t('AutoPlaySentence') }}</label>
        <Switch v-model="settingStore.articleSound"/>
      </div>
      <div class="flex justify-between">
        <label class="">{{ t('AutoPlayNextArticle') }}</label>
        <Switch v-model="settingStore.articleAutoPlayNext"/>
      </div>
    </MiniDialog>
  </div>
</template>

<style scoped lang="scss">
</style>
