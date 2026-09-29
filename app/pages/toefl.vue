<script setup lang="ts">
import { BaseButton, BasePage, Toast } from '@/base'
import { useBaseStore } from '@/core/stores/base.ts'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { getDefaultDict } from '@/core/types/func.ts'
import { DictType, WordPracticeMode } from '@/core/types/enum.ts'
import {
  _getDictDataByUrl,
  isSameDictResource,
  useNav,
} from '@/core/utils'
import { getPracticeWordCacheLocal } from '@/core/utils/cache.ts'
import { flushStatToStore, usePracticeWordPersistence } from '@/core/composables/usePracticePersistence'
import { getCurrentStudyWord } from '@/core/hooks/dict.ts'
import { useDictScript } from '@/composables/useDictScript'
import { convertDictText } from '@/core/utils/zh-script.ts'
import { filterWordsBySubjects, listDictSubjects } from '@/core/utils/toefl-subject.ts'

const { t: $t, locale } = useI18n()
const { formatCn } = useDictScript()

const title = $t('toefl_title')
useSeoMeta({
  title,
  description: $t('toefl_desc'),
  ogTitle: title,
  ogDescription: $t('toefl_desc'),
})

const store = useBaseStore()
const runtimeStore = useRuntimeStore()
const settingStore = useSettingStore()
const wordPersistence = usePracticeWordPersistence()
const { nav } = useNav()
let loading = $ref(false)
/** 释义脚本预览：跟随 UI，也可手动切换简/繁 */
let scriptPreview = $ref<'follow' | 'zh-CN' | 'zh-TW'>('follow')
/** 学科筛选：空 = 全部 */
let selectedSubjects = $ref<string[]>([])
let subjectList = $ref<{ tag: string; count: number }[]>([])

const resolvedScript = computed(() => {
  if (scriptPreview === 'follow') return locale.value === 'tw' ? 'zh-TW' : 'zh-CN'
  return scriptPreview
})

function previewText(text: string) {
  return convertDictText(text, resolvedScript.value)
}

/** TOEFL 词库目录项，与 public/list/word.json 中 enName=toefl 保持一致 */
const TOEFL_DICT_RESOURCE = {
  id: 2,
  enName: 'toefl',
  name: 'TOEFL',
  description: '托福核心词汇库（6385 词），覆盖学术英语高频词与学科场景词，适合 TOEFL iBT 备考',
  url: 'TOEFL.json',
  length: 6385,
  language: 'en' as const,
  translateLanguage: 'zh_CN' as const,
  category: '留学考试',
  tags: ['托福', '留学'],
  type: DictType.word,
}

/** 2026 年 1 月起 TOEFL iBT 新版结构（来源：ETS 官网 Test Content） */
const examSections = [
  {
    key: 'reading',
    name: 'Reading 阅读',
    time: '约 30 分钟',
    items: '50 题',
    tasks: ['Complete the Words 补全单词', 'Read in Daily Life 生活阅读', 'Read an Academic Passage 学术文章阅读'],
    tip: '学术词汇量是阅读速度的关键，优先巩固高频动词与抽象名词。',
  },
  {
    key: 'listening',
    name: 'Listening 听力',
    time: '约 29 分钟',
    items: '47 题',
    tasks: ['Listen and Choose a Response 听后选择回应', 'Listen to a Conversation 听对话', 'Listen to an Announcement 听通知'],
    tip: '用听写模式练习目标词，训练音形映射，减少听力里的“认识但听不出”。',
  },
  {
    key: 'writing',
    name: 'Writing 写作',
    time: '约 23 分钟',
    items: '12 题',
    tasks: ['Build a Sentence 组句', 'Write an Email 写邮件', 'Write for an Academic Discussion 学术讨论写作'],
    tip: '先掌握搭配与词性，再练成句；拼写错误会直接拖累表达分。',
  },
  {
    key: 'speaking',
    name: 'Speaking 口语',
    time: '约 8 分钟',
    items: '11 题',
    tasks: ['Listen and Repeat 听后复述', 'Take an Interview 面试问答'],
    tip: '跟读 + 默写双模式可同时打磨发音与拼写，适合口语热身。',
  },
]

const studyTips = [
  '每天固定 20–50 词，用「跟写 → 听写 → 默写」闭环，比一次性刷完更稳。',
  '错词本是提分核心：把反复错的学术词放进错词本，隔天再练一轮。',
  '分数说明：2026 年 1 月起各单项与总分采用 1–6 分制，过渡期内同时给出 0–120 对应总分。',
  '成绩有效期 2 年；官方成绩约考后 3 天可在 ETS 账户查看。',
  'ETS 不设统一及格线，目标分数以申请院校要求为准。',
]

async function loadToeflWords() {
  let dict = store.word.bookList.find(v => v.enName === TOEFL_DICT_RESOURCE.enName || v.id === TOEFL_DICT_RESOURCE.id)
  if (!dict?.words?.length) {
    dict = await _getDictDataByUrl(TOEFL_DICT_RESOURCE as any)
  }
  return dict
}

function toggleSubject(tag: string) {
  const i = selectedSubjects.indexOf(tag)
  if (i >= 0) selectedSubjects.splice(i, 1)
  else selectedSubjects.push(tag)
}

function clearSubjects() {
  selectedSubjects = []
}

async function startToeflTraining() {
  if (loading) return
  loading = true
  try {
    const dict = await loadToeflWords()
    if (!subjectList.length && dict?.words?.length) {
      subjectList = listDictSubjects(dict.words)
    }

    const allWords = dict?.words?.length ? dict.words : []
    const words = filterWordsBySubjects(allWords, selectedSubjects)
    if (!words.length) {
      Toast.warning('所选学科下没有可练习的单词')
      return
    }

    const draft = getDefaultDict({
      ...TOEFL_DICT_RESOURCE,
      ...(dict ?? {}),
      words: allWords,
    })
    // 保留 bookList 中已有的学习进度，避免重新进入训练时被清零
    const existing = store.word.bookList.find(item => isSameDictResource(item, draft as any))
    if (existing) {
      draft.lastLearnIndex = existing.lastLearnIndex
      draft.perDayStudyNumber = existing.perDayStudyNumber
      draft.complete = existing.complete
    }

    // 切换词典前先落库统计，避免丢失学习记录
    const cache = await getPracticeWordCacheLocal()
    if (cache) {
      flushStatToStore((cache as any)?.statStoreData)
      await wordPersistence.clear()
    }

    runtimeStore.editDict = draft
    await store.changeDict(draft)
    settingStore.wordPracticeMode = WordPracticeMode.Free

    // 学科筛选：只练所选学科词；未筛选则走默认学习任务
    if (selectedSubjects.length) {
      const batch = words.slice(0, Math.min(words.length, Math.max(draft.perDayStudyNumber || 20, 20)))
      nav('practice-words/' + draft.id, {}, { taskWords: { new: batch, review: [] }, total: batch.length })
    } else {
      const currentStudy = getCurrentStudyWord()
      nav('practice-words/' + store.sdict.id, {}, { taskWords: currentStudy })
    }
    Toast.success(
      selectedSubjects.length
        ? `已进入 TOEFL 专项训练（${selectedSubjects.join(' / ')}，${words.length} 词）`
        : '已进入 TOEFL 词汇训练，加油！'
    )
  } catch (e) {
    console.error('[toefl] start training failed', e)
    Toast.error('TOEFL 词库加载失败，请稍后重试')
  } finally {
    loading = false
  }
}

async function ensureSubjects() {
  if (subjectList.length) return
  try {
    const dict = await loadToeflWords()
    if (dict?.words?.length) subjectList = listDictSubjects(dict.words)
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  ensureSubjects()
})

function goDictList() {
  nav('/dict-list')
}
</script>

<template>
  <BasePage>
    <div class="toefl-page">
      <section class="hero card-white">
        <div class="hero-badge">TOEFL iBT · 2026 新版</div>
        <h1 class="hero-title">{{ $t('toefl_title') }}</h1>
        <p class="hero-desc">
          {{ $t('toefl_hero_desc') }}
        </p>
        <div class="lang-row">
          <span class="lang-label">{{ $t('toefl_script_label') }}</span>
          <button
            v-for="opt in [
              { value: 'follow', label: $t('toefl_script_follow') },
              { value: 'zh-CN', label: $t('toefl_script_sc') },
              { value: 'zh-TW', label: $t('toefl_script_tc') },
            ]"
            :key="opt.value"
            class="lang-btn"
            :class="{ active: scriptPreview === opt.value }"
            @click="scriptPreview = opt.value as any"
          >
            {{ opt.label }}
          </button>
        </div>
        <div class="subject-row">
          <div class="subject-head">
            <span class="lang-label">{{ $t('toefl_subject_label') }}</span>
            <button v-if="selectedSubjects.length" class="lang-btn" @click="clearSubjects">
              {{ $t('toefl_subject_clear') }}
            </button>
          </div>
          <div class="subject-chips">
            <button
              v-for="item in subjectList"
              :key="item.tag"
              class="subject-chip"
              :class="{ active: selectedSubjects.includes(item.tag) }"
              @click="toggleSubject(item.tag)"
            >
              {{ item.tag }}
              <em>{{ item.count }}</em>
            </button>
            <span v-if="!subjectList.length" class="subject-empty">{{ $t('toefl_subject_loading') }}</span>
          </div>
        </div>

        <div class="hero-actions">
          <BaseButton type="primary" :loading="loading" @click="startToeflTraining">{{ $t('toefl_start') }}</BaseButton>
          <BaseButton @click="goDictList">{{ $t('toefl_browse') }}</BaseButton>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">考试结构速览</h2>
        <p class="section-sub">以下结构整理自 ETS 官方 TOEFL iBT Test Content 页面（2026 年 1 月起生效）。</p>
        <div class="section-grid">
          <article v-for="item in examSections" :key="item.key" class="section-card card-white">
            <div class="section-card-head">
              <h3>{{ item.name }}</h3>
              <div class="meta">
                <span>{{ item.time }}</span>
                <span class="dot">·</span>
                <span>{{ item.items }}</span>
              </div>
            </div>
            <ul class="tasks">
              <li v-for="task in item.tasks" :key="task">{{ task }}</li>
            </ul>
            <p class="tip">{{ previewText(item.tip) }}</p>
          </article>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">{{ $t('toefl_features_title') }}</h2>
        <ul class="tips">
          <li>{{ $t('toefl_feature_bilingual') }}</li>
          <li>{{ $t('toefl_feature_subject') }}</li>
          <li>{{ $t('toefl_feature_script') }}</li>
        </ul>
      </section>

      <section class="section">
        <h2 class="section-title">{{ $t('toefl_tips_title') }}</h2>
        <ul class="tips">
          <li v-for="(tip, i) in studyTips" :key="i">{{ previewText(tip) }}</li>
        </ul>
      </section>

      <section class="section">
        <h2 class="section-title">延伸资源</h2>
        <ul class="resources">
          <li>
            <a href="https://www.ets.org/toefl/test-takers/ibt/about/content.html" target="_blank" rel="noopener">
              ETS 官方：TOEFL iBT Test Content
            </a>
            <span>考试结构与题量/时长</span>
          </li>
          <li>
            <a href="https://www.ets.org/toefl/test-takers/ibt/scores/understand-scores.html" target="_blank" rel="noopener">
              ETS 官方：Understanding TOEFL Scores
            </a>
            <span>1–6 分制与 0–120 对应说明</span>
          </li>
          <li>
            <a href="https://www.ets.org/toefl/test-takers/ibt/prepare.html" target="_blank" rel="noopener">
              ETS 官方：Prepare for TOEFL
            </a>
            <span>官方备考材料与练习题</span>
          </li>
          <li>
            <a href="https://github.com/zyronon/TypeWords" target="_blank" rel="noopener">TypeWords 开源仓库</a>
            <span>本训练所在的打字背词工具</span>
          </li>
        </ul>
      </section>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.toefl-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.hero {
  padding: 2rem;
  border-radius: 16px;
  margin-bottom: 2rem;
}

.hero-badge {
  display: inline-block;
  font-size: 0.85rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(124, 58, 237, 0.12);
  color: #7c3aed;
  font-weight: 600;
}

.hero-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0.75rem 0;
}

.hero-desc {
  color: var(--color-text-second, #555);
  line-height: 1.7;
  max-width: 42rem;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.lang-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.lang-label {
  font-size: 0.9rem;
  color: var(--color-text-second, #666);
}

.lang-btn {
  border: 1px solid var(--color-border, #ddd);
  background: transparent;
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;

  &.active {
    background: #7c3aed;
    border-color: #7c3aed;
    color: #fff;
  }
}

.subject-row {
  margin-top: 1.15rem;
}

.subject-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
}

.subject-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.subject-chip {
  border: 1px solid var(--color-border, #ddd);
  background: transparent;
  border-radius: 8px;
  padding: 0.3rem 0.65rem;
  font-size: 0.82rem;
  cursor: pointer;

  em {
    font-style: normal;
    opacity: 0.65;
    margin-left: 0.25rem;
    font-size: 0.75rem;
  }

  &.active {
    background: #7c3aed;
    border-color: #7c3aed;
    color: #fff;

    em {
      opacity: 0.9;
    }
  }
}

.subject-empty {
  font-size: 0.85rem;
  color: var(--color-text-second, #888);
}

.section {
  margin-bottom: 2.25rem;
}

.section-title {
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.section-sub {
  color: var(--color-text-second, #666);
  margin-bottom: 1rem;
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.section-card {
  padding: 1.15rem;
  border-radius: 12px;
}

.section-card-head h3 {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.meta {
  font-size: 0.85rem;
  color: var(--color-text-second, #777);
  margin-bottom: 0.75rem;

  .dot {
    margin: 0 0.35rem;
  }
}

.tasks {
  margin: 0 0 0.75rem;
  padding-left: 1.1rem;

  li {
    line-height: 1.6;
    font-size: 0.92rem;
  }
}

.tip {
  font-size: 0.88rem;
  color: var(--color-text-second, #666);
  line-height: 1.6;
  border-left: 3px solid #7c3aed;
  padding-left: 0.65rem;
}

.tips {
  padding-left: 1.2rem;

  li {
    line-height: 1.8;
    margin-bottom: 0.4rem;
  }
}

.resources {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: baseline;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-border, #eee);

    a {
      color: #7c3aed;
      font-weight: 600;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    span {
      color: var(--color-text-second, #777);
      font-size: 0.9rem;
    }
  }
}

@media (max-width: 640px) {
  .hero {
    padding: 1.25rem;
  }

  .hero-title {
    font-size: 1.55rem;
  }
}
</style>
