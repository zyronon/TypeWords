<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { BaseButton, BasePage } from '@typewords/base'
import QRCode from 'qrcode'
import ResourceCard from '@typewords/core/components/ResourceCard.vue'
import { APP_NAME, Origin } from '@typewords/core/config/env.ts'
import type { Resource } from '@typewords/core'

let route = useRoute()
let title = APP_NAME + ' 英语学习资源分享'
useSeoMeta({
  title: title,
  description: title,
  ogTitle: title,
  ogDescription: title,
  ogUrl: Origin + route.fullPath,
  twitterTitle: title,
  twitterDescription: title,
})

interface Subcategory {
  name: string
  description?: string
  resources: Resource[]
}

interface Category {
  id: string
  name: string
  icon?: string
  description?: string
  resources?: Resource[]
  subcategories?: Subcategory[]
}

// 资源分类
const categories = ref<Category[]>([
  {
    id: 'new-concept',
    name: '新概念英语',
    description: '经典英语教材，适合系统学习',
    resources: [
      {
        name: '新概念资源合集',
        description: '',
        difficulty: '包含后面所有的内容',
        link: 'https://pan.quark.cn/s/6b12da160020',
      },
      {
        type: 'list',
        children: [
          {
            name: '新概念英青少年版',
            description: '儿童读物',
            difficulty: '7岁至14岁',
          },
          {
            name: '新概念英语第一册',
            description: '适合英语初学者',
            difficulty: '入门',
          },
          {
            name: '新概念英语第二册',
            description: '基础英语学习，巩固语法和词汇',
            difficulty: '基础',
          },
          {
            name: '新概念英语第三册',
            description: '提高英语水平，增强阅读能力',
            difficulty: '进阶',
          },
          {
            name: '新概念英语第四册',
            description: '高级英语学习，提升综合能力',
            difficulty: '高级',
          },
        ],
      },
      {
        type: 'list',
        children: [
          {
            name: '新概念英语1-4 教材高清 PDF',
            description: '仅 1-4 册的教材高清扫描版 PDF',
            difficulty: 'PDF',
          },
          {
            name: '新东方新概念1-4册精讲',
            description: '机构讲解视频',
            difficulty: '新东方',
          },
          {
            name: '新东方新概念语法精讲',
            description: '机构讲解视频',
            difficulty: '新东方',
          },
          {
            name: '沪江新概念英语全套',
            description: '机构讲解视频',
            difficulty: '沪江',
          },
          {
            name: '新概念其他讲解视频',
            description: '多家机构/个人的讲解视频',
            difficulty: '其他',
          },
        ],
      },
    ],
  },
  {
    id: 'exam',
    name: '电视/电影',
    description: '一些不错的美/英剧，可练听力和口语',
    resources: [
      {
        name: '经典美/英剧资源合集',
        difficulty: '包含后面所有的内容',
        link: 'https://v.v8l.cn/s/TG3sgVg',
      },
      {
        type: 'list',
        children: [
          {
            name: '老友记',
            description: '',
            difficulty: '喜剧 / 爱情',
          },
          {
            name: '生活大爆炸',
            description: '',
            difficulty: '喜剧 / 爱情',
          },
          {
            name: '是大臣 / 是首相',
            description: '',
            difficulty: '喜剧 / 讽刺',
          },
          {
            name: '绝命毒师',
            description: '',
            difficulty: '犯罪 / 剧情',
          },
          {
            name: '行尸走肉',
            description: '',
            difficulty: '恐怖 / 惊悚 / 丧尸',
          },
          {
            name: '越狱',
            description: '',
            difficulty: '犯罪 / 剧情',
          },
          {
            name: '火线',
            description: '',
            difficulty: '剧情 / 犯罪 / 惊悚',
          },
          {
            name: '纸牌屋',
            description: '',
            difficulty: '剧情 / 棋牌馆 / 众议院要人',
          },
          {
            name: '纸钞屋',
            description: '',
            difficulty: '剧情 / 动作 / 悬疑 / 纸房子',
          },
          {
            name: '哈利波特',
            description: '',
            difficulty: '奇幻 / 冒险',
          },
          {
            name: '良医',
            description: '',
            difficulty: '剧情 / 好医生 / 仁医 ',
          },
        ],
      },
      {
        type: 'list',
        children: [
          {
            name: '黑道家族',
            description: '',
            difficulty: '剧情 / 惊悚 / 犯罪',
          },
          {
            name: '风骚律师',
            description: '',
            difficulty: '剧情 / 喜剧 / 犯罪',
          },
          {
            name: '爱死亡和机器人',
            description: '',
            difficulty: '喜剧 / 科幻 / 动画 / 奇幻',
          },
          {
            name: '毒枭',
            description: '',
            difficulty: '剧情 / 传记 / 动作 / 犯罪 ',
          },
          {
            name: '西部世界',
            description: '',
            difficulty: '科幻 / 西部',
          },
          {
            name: '破产姐妹',
            description: '',
            difficulty: '喜剧',
          },
          {
            name: '实习医生格蕾',
            description: '',
            difficulty: '剧情 / 爱情',
          },
          {
            name: '唐顿庄园',
            description: '',
            difficulty: '剧情',
          },
          {
            name: '破产姐妹',
            description: '',
            difficulty: '喜剧',
          },
          {
            name: '王冠',
            description: '',
            difficulty: '剧情 / 历史 / 王权 ',
          },
          {
            name: '经典英文电影大片',
            description: '',
            difficulty: '电影',
          },
        ],
      },
    ],
  },
  {
    id: 'grammar',
    name: '语法学习',
    description: '',
    subcategories: [
      {
        name: '经典教材',
        description: '',
        resources: [
          {
            name: '英语语法新思维',
            author: '张满胜',
            features: '从思维角度讲解语法，注重理解而非死记硬背，分为初级、中级、高级三册，循序渐进',
            suitable: '希望系统建立语法体系的学习者',
            difficulty: '',
            link: 'https://pan.quark.cn/s/d06abef6c737',
          },
          {
            name: '薄冰英语语法',
            author: '薄冰',
            features: '老牌经典,体系完整,分类非常细,查语法点方便',
            suitable: '中学生或基础较弱的学习者',
            difficulty: '',
            link: 'https://pan.quark.cn/s/30777ceba5b9',
          },
          // {
          //   name: '实用英语语法',
          //   author: '张道真',
          //   features: '国内经典语法教材，内容详实全面，例句丰富，适合作为工具书查阅',
          //   suitable: '需要权威参考书的学生或教师',
          //   difficulty: '',
          //   link: 'https://pan.baidu.com/s/xxx',
          // },
          {
            name: '旋元佑语法',
            author: '旋元佑',
            features: '以通俗易懂的语言解析复杂语法，强调“理解逻辑”，适合突破语法难点',
            suitable: '对传统语法教学感到枯燥，想轻松掌握核心逻辑的学习者',
            difficulty: '繁体中文版',
            link: 'https://pan.quark.cn/s/0d0de559794e',
          },
        ],
      },
      {
        name: '进阶提升',
        description: '',
        resources: [
          {
            name: '剑桥英语语法(English Grammar in Use)',
            author: '剑桥大学出版',
            features: '分为初级、中级、高级三册，经典畅销语法自学书，解释简明且有大量练习',
            suitable: '需要结合国际考试的学习者',
            description: '',
            difficulty: '中文版',
            link: 'https://pan.quark.cn/s/d4a6ef53c04d',
          },
          {
            name: 'Oxford English Grammar(牛津英语语法)',
            author: 'Sidney Greenbaum & Gerald Nelson',
            features: '分为基础、提升、高级三册，英式语法权威，解释清晰、例句地道，适合备考雅思/托福',
            suitable: '想全面系统梳理语法体系的人',
            difficulty: '英文版',
            link: 'https://pan.quark.cn/s/ca505875e68c',
          },
          {
            name: '实用英语用法(Practical English Usage)',
            author: 'Michael Swan',
            features: '解释非常细致，尤其适合纠正常见错误和困惑',
            suitable: '中高级学习者，适合作为语法问题的工具书',
            difficulty: '中文版/英文版',
            link: 'https://pan.quark.cn/s/05006e705a77',
          },
        ],
      },
    ],
  },
  {
    id: 'listening',
    name: '听力训练',
    description: '提升英语听力水平',
    resources: [
      {
        name: 'VOA慢速英语合集',
        description: '新闻类听力材料，语速适中，内容丰富',
        difficulty: '初级',
        link: 'https://pan.quark.cn/s/681794bffc6e',
      },
      // {
      //   name: 'BBC Learning English',
      //   description: 'BBC官方英语学习资源，涵盖多方面内容',
      //   difficulty: '中高级',
      //   link: 'https://pan.baidu.com/s/xxx',
      // },
      {
        name: 'TED-ED 科普动画',
        description: 'TED-Ed 是一个专为初高中生所设计的在3到5分钟长的科普动画課程',
        difficulty: '初级',
        link: 'https://pan.quark.cn/s/d3d83038afb9',
      },
      {
        name: '哈弗演讲',
        description: '高质量演讲，锻炼听力同时开拓视野',
        difficulty: '中高级',
        link: 'https://pan.quark.cn/s/62e8d536a34f',
      },
    ],
  },
])

// 当前选中的分类
const selectedCategory = ref('all')

// 筛选后的资源
const filteredResources = computed(() => {
  if (selectedCategory.value === 'all') {
    return categories.value
  }
  return categories.value.filter(cat => cat.id === selectedCategory.value)
})

const Dialog = defineAsyncComponent(() => import('@typewords/base/Dialog'))

// QR 弹窗状态
let showQrDialog = $ref(false)
let currentResourceName = $ref('')
let qrDataUrl = $ref('')

// 生成二维码并显示弹窗
async function openLink(url: string, name?: string) {
  if (url === 'https://v.v8l.cn/s/TG3sgVg') {
    window.open(url, '_blank')
    return
  }
  currentResourceName = name || ''
  try {
    qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  } catch {
    qrDataUrl = ''
  }
  showQrDialog = true
}
</script>

<template>
  <BasePage>
    <div class="flex flex-col items-center justify-center px-4 py-8">
      <!-- 页面标题 -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-4">{{ $t('resource_sharing') }}</h1>
        <p class="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          以下是整理的一些英语学习资源，希望对大家有所帮助！
        </p>
      </div>

      <!-- 分类筛选 -->
      <div class="card-white flex flex-wrap justify-center gap-2 mb-8 p-4">
        <BaseButton :type="selectedCategory === 'all' ? 'primary' : 'info'" @click="selectedCategory = 'all'">
          {{ $t('all_resources') }}
        </BaseButton>
        <BaseButton
          v-for="category in categories"
          :key="category.id"
          :type="selectedCategory === category.id ? 'primary' : 'info'"
          @click="selectedCategory = category.id"
        >
          {{ category.name }}
        </BaseButton>
      </div>

      <!-- 资源列表 -->
      <div class="w-full">
        <div v-for="category in filteredResources" :key="category.id" class="mb-12">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold mb-2">{{ category.icon }} {{ category.name }}</h2>
            <p v-if="category.description" class="text-gray-600 dark:text-gray-300">
              {{ category.description }}
            </p>
          </div>

          <!-- 如果有子分类，显示子分类 -->
          <template v-if="category.subcategories">
            <div v-for="subcategory in category.subcategories" :key="subcategory.name" class="mb-10">
              <div class="text-center mb-4">
                <h3 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
                  {{ subcategory.name }}
                </h3>
                <p v-if="subcategory.description" class="text-gray-600 dark:text-gray-300">
                  {{ subcategory.description }}
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <ResourceCard
                  v-for="resource in subcategory.resources"
                  :key="resource.name"
                  :resource="resource"
                  @openLink="(url: string) => openLink(url, resource.name)"
                />
              </div>
            </div>
          </template>

          <!-- 如果没有子分类，直接显示资源 -->
          <template v-else>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <ResourceCard
                v-for="resource in category.resources"
                :key="resource.name"
                :resource="resource"
                @openLink="(url: string) => openLink(url, resource.name)"
              />
            </div>
          </template>
        </div>
      </div>

      <!-- 页面底部 -->
      <div class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div class="card-white">
          <div class="text-xl font-bold mb-4">温馨提示</div>
          <ul class="space-y-2 text-gray-600 dark:text-gray-300">
            <li>所有资源均来自互联网收集，仅供学习交流使用</li>
            <li>
              如果链接失效，请及时<a :href="`https://v.wjx.cn/vm/ev0W7fv.aspx#`" target="_blank">告知</a>，我会尽快更新
            </li>
          </ul>
        </div>
      </div>
    </div>

    <Dialog v-model="showQrDialog" title="手机扫码访问资源">
      <div class="w-90 p-6 pt-0 flex flex-col items-center">
        <p class="text-center text-gray-600 text-xl dark:text-gray-300">
          {{ currentResourceName }}
        </p>
        <div class="text-center">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="w-70 rounded-lg shadow-md" />
        </div>
        <p class="text-center text-gray-600 text-xl font-bold dark:text-gray-300">请在手机上打开夸克 App 扫码访问</p>
      </div>
    </Dialog>
  </BasePage>
</template>
