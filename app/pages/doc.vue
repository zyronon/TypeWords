<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { BaseButton, BasePage } from '@/base'
import QRCode from 'qrcode'
import ResourceCard from '@/components/ResourceCard.vue'
import { APP_NAME, Origin } from '@/core/config/env.ts'
import type { Resource } from '@/core'

let route = useRoute()
let title = APP_NAME + ' English Learning Resources'
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
    name: 'New Concept English',
    description: 'Classic English textbooks for structured learning',
    resources: [
      {
        name: 'New Concept English collection',
        description: '',
        difficulty: 'Includes everything below',
        link: 'https://pan.quark.cn/s/6b12da160020',
      },
      {
        type: 'list',
        children: [
          {
            name: 'New Concept English for Kids & Teens',
            description: 'Children’s readers',
            difficulty: 'Ages 7–14',
          },
          {
            name: 'New Concept English Book 1',
            description: 'For English beginners',
            difficulty: 'Beginner',
          },
          {
            name: 'New Concept English Book 2',
            description: 'Foundation English: consolidate grammar and vocabulary',
            difficulty: 'Elementary',
          },
          {
            name: 'New Concept English Book 3',
            description: 'Improve your level and reading skills',
            difficulty: 'Upper-Intermediate',
          },
          {
            name: 'New Concept English Book 4',
            description: 'Advanced English to boost overall proficiency',
            difficulty: 'Advanced',
          },
        ],
      },
      {
        type: 'list',
        children: [
          {
            name: 'New Concept English 1–4 HD PDF textbooks',
            description: 'HD scanned PDFs of Books 1–4 only',
            difficulty: 'PDF',
          },
          {
            name: 'New Oriental: New Concept 1–4 lectures',
            description: 'Video lectures from a school',
            difficulty: 'New Oriental',
          },
          {
            name: 'New Oriental: New Concept grammar lectures',
            description: 'Video lectures from a school',
            difficulty: 'New Oriental',
          },
          {
            name: 'Hujiang New Concept English full course',
            description: 'Video lectures from a school',
            difficulty: 'Hujiang',
          },
          {
            name: 'Other New Concept video lectures',
            description: 'Video lectures from various schools and individuals',
            difficulty: 'Other',
          },
        ],
      },
    ],
  },
  {
    id: 'exam',
    name: 'TV & Movies',
    description: 'Good American/British shows for practicing listening and speaking',
    resources: [
      {
        name: 'Classic American/British TV collection',
        difficulty: 'Includes everything below',
        link: 'https://v.v8l.cn/s/TG3sgVg',
      },
      {
        type: 'list',
        children: [
          {
            name: 'Friends',
            description: '',
            difficulty: 'Comedy / Romance',
          },
          {
            name: 'The Big Bang Theory',
            description: '',
            difficulty: 'Comedy / Romance',
          },
          {
            name: 'Yes Minister / Yes, Prime Minister',
            description: '',
            difficulty: 'Comedy / Satire',
          },
          {
            name: 'Breaking Bad',
            description: '',
            difficulty: 'Crime / Drama',
          },
          {
            name: 'The Walking Dead',
            description: '',
            difficulty: 'Horror / Thriller / Zombie',
          },
          {
            name: 'Prison Break',
            description: '',
            difficulty: 'Crime / Drama',
          },
          {
            name: 'The Wire',
            description: '',
            difficulty: 'Drama / Crime / Thriller',
          },
          {
            name: 'House of Cards',
            description: '',
            difficulty: 'Drama / Politics',
          },
          {
            name: 'Money Heist',
            description: '',
            difficulty: 'Drama / Action / Mystery',
          },
          {
            name: 'Harry Potter',
            description: '',
            difficulty: 'Fantasy / Adventure',
          },
          {
            name: 'The Good Doctor',
            description: '',
            difficulty: 'Drama / Medical',
          },
        ],
      },
      {
        type: 'list',
        children: [
          {
            name: 'The Sopranos',
            description: '',
            difficulty: 'Drama / Thriller / Crime',
          },
          {
            name: 'Better Call Saul',
            description: '',
            difficulty: 'Drama / Comedy / Crime',
          },
          {
            name: 'Love, Death & Robots',
            description: '',
            difficulty: 'Comedy / Sci-Fi / Animation / Fantasy',
          },
          {
            name: 'Narcos',
            description: '',
            difficulty: 'Drama / Biography / Action / Crime',
          },
          {
            name: 'Westworld',
            description: '',
            difficulty: 'Sci-Fi / Western',
          },
          {
            name: '2 Broke Girls',
            description: '',
            difficulty: 'Comedy',
          },
          {
            name: 'Grey’s Anatomy',
            description: '',
            difficulty: 'Drama / Romance',
          },
          {
            name: 'Downton Abbey',
            description: '',
            difficulty: 'Drama',
          },
          {
            name: '2 Broke Girls',
            description: '',
            difficulty: 'Comedy',
          },
          {
            name: 'The Crown',
            description: '',
            difficulty: 'Drama / History',
          },
          {
            name: 'Classic English-language blockbusters',
            description: '',
            difficulty: 'Movies',
          },
        ],
      },
    ],
  },
  {
    id: 'grammar',
    name: 'Grammar',
    description: '',
    subcategories: [
      {
        name: 'Classic textbooks',
        description: '',
        resources: [
          {
            name: 'New Thinking in English Grammar',
            author: 'Zhang Mansheng',
            features: 'Explains grammar through reasoning rather than rote memorization; three progressive volumes: beginner, intermediate, advanced',
            suitable: 'Learners who want to build a systematic grasp of grammar',
            difficulty: '',
            link: 'https://pan.quark.cn/s/d06abef6c737',
          },
          {
            name: 'Bo Bing English Grammar',
            author: 'Bo Bing',
            features: 'A long-standing classic: comprehensive, finely categorized, easy to look up grammar points',
            suitable: 'Secondary school students or learners with a weaker foundation',
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
            name: 'Xuan Yuanyou Grammar',
            author: 'Xuan Yuanyou',
            features: 'Breaks down complex grammar in plain language, stressing “understanding the logic”; great for tackling tricky points',
            suitable: 'Learners who find traditional grammar teaching dull and want to grasp the core logic easily',
            difficulty: 'Traditional Chinese edition',
            link: 'https://pan.quark.cn/s/0d0de559794e',
          },
        ],
      },
      {
        name: 'Going further',
        description: '',
        resources: [
          {
            name: 'English Grammar in Use (Cambridge)',
            author: 'Cambridge University Press',
            features: 'Three volumes (beginner, intermediate, advanced); a best-selling self-study classic with clear explanations and plenty of exercises',
            suitable: 'Learners preparing for international exams',
            description: '',
            difficulty: 'Chinese edition',
            link: 'https://pan.quark.cn/s/d4a6ef53c04d',
          },
          {
            name: 'Oxford English Grammar',
            author: 'Sidney Greenbaum & Gerald Nelson',
            features: 'Three volumes (basic, intermediate, advanced); an authority on British grammar with clear explanations and natural examples, good for IELTS/TOEFL prep',
            suitable: 'Anyone who wants a thorough, systematic review of grammar',
            difficulty: 'English edition',
            link: 'https://pan.quark.cn/s/ca505875e68c',
          },
          {
            name: 'Practical English Usage',
            author: 'Michael Swan',
            features: 'Very detailed explanations, especially good for fixing common mistakes and confusions',
            suitable: 'Intermediate to advanced learners; a handy reference for grammar questions',
            difficulty: 'Chinese / English edition',
            link: 'https://pan.quark.cn/s/05006e705a77',
          },
        ],
      },
    ],
  },
  {
    id: 'listening',
    name: 'Listening',
    description: 'Improve your English listening',
    resources: [
      {
        name: 'VOA Special English collection',
        description: 'News-based listening material at a moderate pace with rich content',
        difficulty: 'Elementary',
        link: 'https://pan.quark.cn/s/681794bffc6e',
      },
      // {
      //   name: 'BBC Learning English',
      //   description: 'BBC官方英语学习资源，涵盖多方面内容',
      //   difficulty: 'Intermediate–Advanced',
      //   link: 'https://pan.baidu.com/s/xxx',
      // },
      {
        name: 'TED-Ed educational animations',
        description: 'TED-Ed offers 3–5 minute educational animated lessons designed for middle and high school students',
        difficulty: 'Elementary',
        link: 'https://pan.quark.cn/s/d3d83038afb9',
      },
      {
        name: 'Harvard speeches',
        description: 'High-quality speeches that train your ear and broaden your horizons',
        difficulty: 'Intermediate–Advanced',
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

const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

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
          Here are some curated English learning resources. Hope you find them helpful!
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
          <div class="text-xl font-bold mb-4">Note</div>
          <ul class="space-y-2 text-gray-600 dark:text-gray-300">
            <li>All resources were collected from the internet and are for learning purposes only</li>
            <li>
              If a link is broken, please <a :href="`https://v.wjx.cn/vm/ev0W7fv.aspx#`" target="_blank">let me know</a> and I will update it as soon as possible
            </li>
          </ul>
        </div>
      </div>
    </div>

    <Dialog v-model="showQrDialog" title="Scan with your phone to access">
      <div class="w-90 p-6 pt-0 flex flex-col items-center">
        <p class="text-center text-gray-600 text-xl dark:text-gray-300">
          {{ currentResourceName }}
        </p>
        <div class="text-center">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="w-70 rounded-lg shadow-md" />
        </div>
        <p class="text-center text-gray-600 text-xl font-bold dark:text-gray-300">Open the Quark app on your phone and scan the code</p>
      </div>
    </Dialog>
  </BasePage>
</template>
