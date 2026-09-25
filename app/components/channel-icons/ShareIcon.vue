<script setup lang="ts">
import { APP_NAME, LIB_JS_URL, Origin } from '@/core/config/env.ts'
import { BaseIcon, Progress } from '@/base'
import { usePracticeStore } from '@/core/stores/practice.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { loadJsLib, msToHourMinute } from '@/core/utils'
import dayjs from 'dayjs'
import { defineAsyncComponent } from 'vue'
import { withAppBaseURL } from '@/core/utils/base-url'

const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

const practiceStore = usePracticeStore()
const baseStore = useBaseStore()

let showShareDialog = $ref(false)
let loading1 = $ref(false)
let loading2 = $ref(false)
let posterEl = $ref<HTMLDivElement | null>(null)
let imgIndex = $ref(Math.floor(Math.random() * 10))

// 计算学习统计数据
const studyStats = $computed(() => {
  return {
    total: practiceStore.total,
    newWords: practiceStore.newWordNumber,
    review: practiceStore.reviewWordNumber,
    wrong: practiceStore.wrong,
    correct: practiceStore.total - practiceStore.wrong,
    time: msToHourMinute(practiceStore.spend, true),
    date: dayjs().format('MMM D'),
    dictionary: baseStore.sdict.name || 'Unknown dictionary',
  }
})

// 复制图片到剪贴板
async function copyImageToClipboard() {
  try {
    loading1 = true
    const snapdom = await loadJsLib('snapdom', LIB_JS_URL.SNAPDOM)
    const blob = await snapdom.toBlob(posterEl, { scale: 2, type: 'png' })
    if (!blob) throw new Error('capture failed')

    if (navigator.clipboard && (window as any).ClipboardItem) {
      await navigator.clipboard.write([new (window as any).ClipboardItem({ [blob.type || 'image/png']: blob })])
      Toass.success('Image copied to clipboard!')
    } else {
      await downloadImage()
    }
  } catch (error) {
    Toass.error('Copy failed!')
    await downloadImage()
  } finally {
    loading1 = false
  }
}

// 下载图片
async function downloadImage() {
  loading2 = true
  const snapdom = await loadJsLib('snapdom', LIB_JS_URL.SNAPDOM)
  snapdom.download(posterEl, { scale: 2 })
  loading2 = false
}

// 切换背景
function changeBackground() {
  const newIndex = Math.floor(Math.random() * 9) // 0-8
  imgIndex = newIndex >= imgIndex ? newIndex + 1 : newIndex
}

// 计算学习进度百分比
const studyProgress = $computed(() => {
  if (!baseStore.sdict.length) return 0
  return Math.round((baseStore.sdict.lastLearnIndex / baseStore.sdict.length) * 100)
})

const sentence = $computed(() => {
  let list = [
    { en: 'Actions speak louder than words.', cn: 'What you do matters more than what you say' },
    { en: 'Keep going, never give up!', cn: 'Persistence is victory' },
    { en: "Where there's a will, there's a way.", cn: 'Determination finds a path' },
    { en: 'Every cloud has a silver lining.', cn: 'There is always light in the darkness' },
    { en: 'Time heals all wounds.', cn: 'Time makes every hurt fade' },
    { en: 'Never say die.', cn: 'Never admit defeat' },
    { en: 'The best is yet to come.', cn: 'Better days are ahead' },
    { en: "Believe you can and you're halfway there.", cn: 'Believe in yourself and you are half done' },
    { en: 'No pain, no gain.', cn: 'Effort is the price of reward' },
    { en: 'Dream big and dare to fail.', cn: 'Aim high and fear no failure' },
    { en: 'Home is where the heart is.', cn: 'Home is wherever your heart belongs' },
    { en: 'Knowledge is power.', cn: 'Learning makes you strong' },
    { en: 'Practice makes perfect.', cn: 'Skill comes from repetition' },
    { en: 'When in Rome, do as the Romans do.', cn: 'Follow local customs wherever you go' },
    { en: 'Just do it.', cn: 'Stop thinking, start doing' },
    { en: 'So far, so good.', cn: 'All is well up to now' },
    { en: 'The early bird catches the worm.', cn: 'Those who start early get ahead' },
    { en: 'Every day is a new beginning.', cn: 'Each day is a fresh start' },
    { en: 'Success is a journey, not a destination.', cn: 'Enjoy the road to success' },
    { en: 'Your only limit is your mind.', cn: 'Only your thinking holds you back' },
    { en: 'A friend in need is a friend indeed.', cn: 'Hard times reveal true friends' },
    { en: 'Silence is golden.', cn: 'Sometimes saying nothing is best' },
    { en: 'Let bygones be bygones.', cn: 'Leave the past behind' },
    { en: 'Keep calm and carry on.', cn: 'Stay calm and keep moving forward' },
    { en: 'Live and learn.', cn: 'Never stop learning' },
    { en: 'Mistakes are proof that you are trying.', cn: 'Mistakes show you are making an effort' },
    { en: 'Better late than never.', cn: 'Doing it late beats not doing it at all' },
    { en: 'Be the change you wish to see in the world.', cn: 'Change starts with you' },
    { en: 'The journey of a thousand miles begins with a single step.', cn: 'Every long journey starts with one step' },
    { en: 'When one door closes, another opens.', cn: 'A closed door means a new one is opening' },
  ]
  return list[Math.floor(Math.random() * list.length)]
})
</script>

<template>
  <!-- 分享学习总结按钮 -->
  <BaseIcon @click="showShareDialog = true" class="bounce">
    <IconFluentShare20Regular class="text-blue-500 hover:text-blue-600" />
  </BaseIcon>

  <!-- 学习总结分享图片生成对话框 -->
  <Dialog v-model="showShareDialog" title="Share">
    <div class="flex min-w-160 max-w-200 p-6 pt-0 gap-space">
      <!-- 左侧：海报预览区域 -->
      <div ref="posterEl" class="flex-1 border-r border-gray-200 bg-gray-100 rounded-xl overflow-hidden relative">
        <div class="flex p-5 gap-space flex-col justify-between relative z-2 color-white h-full box-border">
          <div class="flex flex-col flex-1 space-y-3">
            <!-- 顶部用户信息 -->
            <div class="flex items-center">
              <div class="ml-auto text-xs">Type Words | English Learning</div>
            </div>

            <div class="bg-gray-900/30 py-4 center flex-col rounded-2xl">
              <div class="text-center mb-2 text-xl">I studied {{ baseStore.sdict.name }} for {{ studyStats.time }}</div>
              <!-- Progress Overview -->
              <div class="w-90/100 flex items-center gap-space">
                <div class="shrink-0">Progress</div>
                <Progress :percentage="studyProgress" size="normal" />
              </div>
            </div>

            <!-- 统计数据 -->
            <div class="grid grid-cols-3 gap-4">
              <div class="stat-card">
                <div class="text-2xl font-bold">{{ studyStats.newWords }}</div>
                <div class="text-base">New</div>
              </div>
              <div class="stat-card">
                <div class="text-2xl font-bold">{{ studyStats.review }}</div>
                <div class="text-base">Review</div>
              </div>
              <div class="stat-card">
                <div class="text-2xl font-bold">{{ studyStats.wrong }}</div>
                <div class="text-base">Mistakes</div>
              </div>
            </div>

            <!-- 励志语句 -->
            <div class="bg-gray-900/30 py-4 rounded-2xl center flex-col flex-1 p-4">
              <div class="text-3xl text-center italic mb-2 en-article-family">{{ sentence.en }}</div>
              <div class="text-base italic">{{ sentence.cn }}</div>
            </div>
          </div>

          <!-- 底部品牌信息 -->
          <div class="bg-gray-900/30 py-4 rounded-2xl p-4">
            <div class="flex justify-between items-end">
              <div class="space-y-2">
                <div class="font-bold text-2xl">Type Words</div>
                <div class="text-base">{{ Origin }}</div>
                <div class="text-xs">Every keystroke is progress. An open-source vocabulary tool</div>
              </div>
              <img :src="withAppBaseURL('/imgs/share/qr.png')" class="w-20 w-20 rounded-md overflow-hidden" alt="" />
            </div>
          </div>
        </div>

        <img
          :src="withAppBaseURL(`/imgs/share/bg/${imgIndex}.jpg`)"
          class="w-full object-cover object-center absolute top-0"
          alt=""
        />
      </div>

      <!-- 右侧：分享引导区域 -->
      <div class="flex-1 pt-0">
        <div class="">
          <div class="text-2xl font-bold mb-4 flex items-center">
            <span class="mr-2">🎯</span>
            Share your progress
          </div>
          <div class="flex items-start">
            <span class="mr-2">🚀</span>
            With {{ APP_NAME }}, learning English can be seriously cool!
          </div>
          <div class="flex items-start">
            <span class="mr-2">📸</span>
            Share your study card, flood your feed with your progress, and become the English whiz everyone notices! 😎
          </div>
          <div class="flex items-start">
            <span class="mr-2">💪</span>
            It's more than a check-in, it's your stage to show off your English!
          </div>
          <div class="flex items-start">
            <span class="mr-2">🔥</span>
            Share your study record, collect likes from friends, and start an English-learning wave among them!
          </div>
        </div>

        <div class="space-y-4 mt-24">
          <!-- 个性化装扮 -->
          <div
            @click="changeBackground"
            class="flex items-center justify-start gap-space color-black px-6 py-3 bg-gray-200 rounded-lg cp hover:bg-gray-300 transition-all duration-200"
          >
            <IconMdiSparkles class="w-4 h-4 text-yellow-500" />
            Change background
          </div>

          <!-- 分享战绩 -->
          <div
            @click="copyImageToClipboard"
            class="flex items-center justify-start gap-space px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white cp rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200"
          >
            <IconEosIconsLoading class="text-xl" v-if="loading1" />
            <IconFluentCopy20Regular class="w-5 h-5" v-else />
            <span class="font-medium">Copy to clipboard</span>
          </div>

          <div
            @click="downloadImage"
            class="flex items-center justify-start gap-space px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white cp rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200"
          >
            <IconEosIconsLoading class="text-xl" v-if="loading2" />
            <IconFluentArrowDownload20Regular class="w-5 h-5" v-else />
            <span class="font-medium">Save HD poster</span>
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
.stat-card {
  @apply text-center bg-gray-900/30 py-4 rounded-2xl;
}
</style>
