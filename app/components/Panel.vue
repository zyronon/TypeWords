<script setup lang="ts">
import { computed, provide } from 'vue'
import { useSettingStore } from '@/core/stores/setting'
import { Tooltip, Close } from '@/base'
import { ShortcutKey } from '@/core/types'

const settingStore = useSettingStore()
let tabIndex = $ref(0)
provide(
  'tabIndex',
  computed(() => tabIndex)
)
</script>
<template>
  <Transition name="fade">
    <div class="panel anim" v-bind="$attrs" v-show="settingStore.showPanel">
      <header class="flex justify-between items-center py-3 px-space">
        <div class="color-main">
          <slot name="title"></slot>
        </div>
        <Close
          :tooltip="`${$t('close')}(${settingStore.shortcutKeyMap[ShortcutKey.TogglePanel]})`"
          @click="settingStore.showPanel = false"
        />
      </header>
      <div class="flex-1 overflow-auto">
        <slot></slot>
      </div>
    </div>
  </Transition>
</template>
<style scoped lang="scss">
.panel {
  width: var(--panel-width);
  background: var(--color-second);
  @apply shadow-lg flex flex-col h-full rounded-xl;
}

@media (max-width: 768px) {
  .panel {
    width: 90vw;
    max-width: 400px;
    max-height: 90vh;
    height: auto;
    border-radius: 0.4rem;
  }

  .panel > div.flex-1 {
    max-height: calc(90vh - 3.2rem);
  }

  .panel header {
    padding: 0.5rem 0.5rem;

    .color-main {
      font-size: 0.9rem;
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .panel {
    width: 95vw;
    max-height: 94vh;
  }

  .panel > div.flex-1 {
    max-height: calc(94vh - 3rem);
  }

  .panel header {
    padding: 0.3rem 0.3rem;

    .color-main {
      font-size: 0.8rem;
    }
  }
}
</style>
