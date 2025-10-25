<script setup lang="ts">
import {useSettingStore} from "@/stores/setting.ts";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const settingStore = useSettingStore()
defineProps<{
  panelLeft: string
}>()
</script>

<template>
  <div class="flex justify-center relative h-screen"
       :class="!settingStore.showToolbar && 'footer-hide'"
       :aria-label="t('PracticeArea')">
    <div class="wrap" :aria-label="t('PracticeContent')">
      <slot name="practice"></slot>
    </div>
    <div class="panel-wrap" :style="{left:panelLeft}" :aria-label="t('PracticePanel')">
      <slot name="panel"></slot>
    </div>
    <div class="footer-wrap" :aria-label="t('PracticeControls')">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">

.wrap {
  transition: all var(--anim-time);
  height: calc(100vh - 8rem);
}

.footer-hide {
  .wrap {
    height: calc(100vh - 3rem) !important;
  }

  .footer-wrap {
    bottom: -6rem;
  }
}

.footer-wrap {
  position: fixed;
  bottom: 0.8rem;
  transition: all var(--anim-time);
}

.panel-wrap {
  position: absolute;
  top: .8rem;
  z-index: 1;
  height: calc(100vh - 1.8rem);
}

</style>
