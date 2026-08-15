<script setup lang="ts">
/**
 * PracticeOnboardingHost — 引导 + 通知宿主组件
 *
 * 从 [id].vue 模板提取，负责：
 * - ConflictNotice（首次输入法冲突提示）
 * - CollectNotice（收藏引导弹窗）
 * - ConflictNotice2（无法输入？弹窗）
 * - Shepherd Tour 初始化
 */
import { watchOnce } from '@vueuse/core'
import CollectNotice from '@/components/dialog/CollectNotice.vue'
import ConflictNotice2 from '@/components/dialog/ConflictNotice2.vue'
import { useRoute } from 'vue-router'
import { useSettingStore } from '@/core/stores/setting.ts'
import { LIB_JS_URL, TourConfig } from '@/core/config/env.ts'
import { _nextTick, isMobile, loadJsLib, sleep } from '@/core/utils'

interface IProps {
  /** 是否已加载完数据，有了 words 之后再初始化 Tour */
  ready: boolean
  /** 词典 ID，保留给后续引导扩展 */
  dictId: string
}

const props = defineProps<IProps>()

void props.dictId

const route = useRoute()
const settingStore = useSettingStore()

let showCollectNotice = $ref(false)
let showConflictNotice2 = $ref(false)

function openConflictNotice2() {
  showConflictNotice2 = true
}

defineExpose({
  openConflictNotice2,
})

// 首次加载时显示提示
if (!route.query.guide) {
  setTimeout(() => {
    showCollectNotice = true
  }, 10000)
}

// Tour 引导初始化
watchOnce(
  () => props.ready,
  ready => {
    if (!ready) return
    _nextTick(async () => {
      const r = localStorage.getItem('tour-guide')
      if (settingStore.first && !r && !isMobile()) {
        const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
        const tour = new Shepherd.Tour(TourConfig)
        tour.on('cancel', () => {
          localStorage.setItem('tour-guide', '1')
        })
        tour.addStep({
          id: 'step5',
          text: '这里可以练习拼写单词，只需要按下键盘上对应的按键即可，没有输入框！',
          attachTo: { element: '#word', on: 'bottom' },
          buttons: [
            {
              text: '关闭',
              action() {
                settingStore.first = false
                tour.next()
                setTimeout(() => {
                  showCollectNotice = true
                }, 10000)
              },
            },
          ],
        })
        await sleep(500)
        tour.start()
      }
    }, 500)
  }
)
</script>

<template>
  <CollectNotice v-model="showCollectNotice" />
  <ConflictNotice2 v-model="showConflictNotice2" />
</template>
