<script setup lang="ts">
import { onMounted } from 'vue'
import { BaseButton, BasePage, Toast, VolumeIcon } from '@typewords/base'
import { useRoute, useRouter } from 'vue-router'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import type { Dict, TaskWords, Word } from '@typewords/core/types/types.ts'
import { _getDictDataByUrl, shuffle, useNav } from '@typewords/core/utils'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import { usePlayBeep, usePlayCorrect, usePlayWordAudio } from '@typewords/core/hooks/sound.ts'
import { useEvents } from '@typewords/core/utils/eventBus'
import { useStartKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import { ShortcutKey } from '@typewords/core/types/enum'
import { useSettingStore } from '@typewords/core/stores/setting.ts'

type Candidate = { word: string; wordObj?: Word; label: string }
type Question = {
  stem: Word
  candidates: Candidate[]
  correctIndex: number
  selectedIndex: number
  submitted: boolean
}

const route = useRoute()
const router = useRouter()
const base = useBaseStore()
const runtimeStore = useRuntimeStore()
const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playWordAudio = usePlayWordAudio()

let loading = $ref(false)
let dict = $ref<Dict>()
let questions = $ref<Question[]>([])
let index = $ref(0)
let pageNo = $ref(0)
let pageSize = $ref(100)
let allWords = []
let testWords = []
let total = $computed(() => {
  return (pageNo + 1) * pageSize
})
let no = $computed(() => {
  return pageNo * pageSize + index + 1
})

function getWordByText(val: string, list: Word[]): Word | undefined {
  let r = list.find(v => v.word.toLowerCase() === val.toLowerCase())
  return r
}

function pickRelVariant(w: Word, list: Word[]): Candidate | null {
  let rels = w.relWords?.rels || []
  for (let i = 0; i < rels.length; i++) {
    for (let j = 0; j < rels[i].words.length; j++) {
      let c = rels[i].words[j].c
      let r = getWordByText(c, list)
      if (r && r.word.toLowerCase() !== w.word.toLowerCase()) {
        return { word: r.word, wordObj: r, label: '' }
      }
    }
  }
  return null
}

function pickSynonym(w: Word, list: Word[]): Candidate | null {
  let synos = w.synos || []
  for (let i = 0; i < synos.length; i++) {
    for (let j = 0; j < synos[i].ws.length; j++) {
      let c = synos[i].ws[j]
      let r = getWordByText(c, list)
      if (r && r.word.toLowerCase() !== w.word.toLowerCase()) {
        return { word: r.word, wordObj: r, label: '' }
      }
    }
  }
  return null
}

function pickSamePos(w: Word, list: Word[]): Candidate | null {
  let pos = (w.trans?.[0]?.pos || '').trim()
  let samePos = list.filter(v => v.word.toLowerCase() !== w.word.toLowerCase() && v.trans?.some(t => t.pos === pos))
  if (samePos.length) {
    let r = samePos[Math.floor(Math.random() * samePos.length)]
    return { word: r.word, wordObj: r, label: '' }
  }
  return null
}

function buildQuestion(w: Word, list: Word[]): Question {
  let candidates: Candidate[] = []
  candidates.push({ word: w.word, wordObj: w, label: '' })
  let c1 = pickRelVariant(w, list) || pickSynonym(w, list) || pickSamePos(w, list)
  let c2 = null as Candidate | null
  let c3 = null as Candidate | null
  let tried = new Set<string>([w.word.toLowerCase()])
  if (c1) tried.add(c1.word.toLowerCase())
  let attempts = 0
  while (!c2 && attempts < 5) {
    c2 = pickSynonym(w, list) || pickSamePos(w, list) || pickRelVariant(w, list)
    if (c2 && tried.has(c2.word.toLowerCase())) c2 = null
    attempts++
  }
  if (c2) tried.add(c2.word.toLowerCase())
  attempts = 0
  while (!c3 && attempts < 5) {
    c3 = pickSynonym(w, list) || pickSamePos(w, list) || pickRelVariant(w, list)
    if (c3 && tried.has(c3.word.toLowerCase())) c3 = null
    attempts++
  }
  if (!c1) {
    let rand = list.filter(v => v.word.toLowerCase() !== w.word.toLowerCase())
    if (rand.length) {
      const r = rand[Math.floor(Math.random() * rand.length)]
      c1 = { word: r.word, wordObj: getWordByText(r.word, list), label: '' }
    }
  }
  if (!c2) {
    let rand = list.filter(
      v => v.word.toLowerCase() !== w.word.toLowerCase() && v.word.toLowerCase() !== c1?.word.toLowerCase()
    )
    if (rand.length) {
      const r = rand[Math.floor(Math.random() * rand.length)]
      c2 = { word: r.word, wordObj: getWordByText(r.word, list), label: '' }
    }
  }
  if (!c3) {
    let rand = list.filter(
      v =>
        v.word.toLowerCase() !== w.word.toLowerCase() &&
        v.word.toLowerCase() !== c1?.word.toLowerCase() &&
        v.word.toLowerCase() !== c2?.word.toLowerCase()
    )
    if (rand.length) {
      const r = rand[Math.floor(Math.random() * rand.length)]
      c3 = { word: r.word, wordObj: getWordByText(r.word, list), label: '' }
    }
  }
  if (c1) candidates.push(c1)
  if (c2) candidates.push(c2)
  if (c3) candidates.push(c3)
  candidates = shuffle(candidates)
  candidates.map(v => {
    v.label = formatCandidateText(v)
  })
  const correctIndex = candidates.findIndex(v => v.word === w.word)
  return {
    stem: w,
    candidates,
    correctIndex,
    selectedIndex: -1,
    submitted: false,
  }
}

function formatCandidateText(c: Candidate): string {
  const w = c.wordObj
  if (!w || !w.trans || !w.trans.length) return '当前词典未收录释义'

  const cleanCn = (cn: string, head: string) => {
    let t = cn || ''
    // 去掉含英文的括号片段（避免出现人名或英文拼写）
    t = t.replace(/（[^）]*[A-Za-z][^）]*）/g, '')
    // 去掉“时态/过去式/复数”等形态说明
    t = t.replace(/(时\s*态|过去式|过去分词|现在分词|复数|第三人称|比较级|最高级)[:：].*/g, '')
    // 去掉直接出现的英文词头
    const headEsc = head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(headEsc, 'gi'), '')
    // 统一分隔符为中文分号
    t = t.replace(/[;；]\s*/g, '；')
    // 收尾空白
    t = t.trim()
    return t
  }

  const parts = w.trans
    .map(v => {
      const pos = (v.pos || '').trim()
      const cn = cleanCn(v.cn || '', w.word)
      if (/^\s*【名】/.test(v.cn || '')) return ''
      if (!cn) return ''
      return `${pos ? '- ' + pos + ' ' : '- '}${cn}`
    })
    .filter(Boolean)

  return parts.length ? parts.join('；') : '当前词典未收录释义'
}

async function init() {
  let dictId: any = route.params.id
  let d = base.word.bookList.find(v => v.id === dictId)
  if (!d) d = base.sdict
  if (!d?.id) return router.push('/words')
  dict = d
  if (!d.words.length && runtimeStore.editDict?.id === d.id) {
    loading = true
    let r = await _getDictDataByUrl(runtimeStore.editDict)
    d = r
    loading = false
  }
  if (!dict.words.length) {
    return Toast.warning('没有单词可测试！')
  }
  if (runtimeStore.routeData?.taskWords) {
    let currentStudy: TaskWords = runtimeStore.routeData.taskWords
    if (currentStudy.review.length) {
      testWords = runtimeStore.routeData.taskWords.review
    }
  }
  if (!testWords.length) {
    testWords = shuffle(dict.words)
  }
  allWords = shuffle(dict.words)
  questions = testWords.slice(pageNo * pageSize, (pageNo + 1) * pageSize).map(w => buildQuestion(w, allWords))
  console.log('questions', questions)
  index = 0

  Toast.info('可以按快捷键进行选择,例如按快捷键[' + aShortcutKey + ']选择A', { duration: 3000 })
}

function select(i: number) {
  let q = questions[index]
  if (!q || q.submitted) return
  q.selectedIndex = i
  q.submitted = true
  if (i === q.correctIndex) {
    playCorrect()
  } else {
    playBeep()
    let temp = q.stem.word.toLowerCase()
    if (!base.wrong.words.find((v: Word) => v.word.toLowerCase() === temp)) {
      base.wrong.words.push(q.stem)
      base.wrong.length = base.wrong.words.length
    }
  }
}

const { nav } = useNav()

function next() {
  if (no >= testWords.length) {
    nav('/words')
  }
  if (no < total) index++
  else {
    pageNo++
    index = 0
    questions = testWords.slice(pageNo * pageSize, (pageNo + 1) * pageSize).map(w => buildQuestion(w, allWords))
  }
}

function end() {
  router.back()
}

useStartKeyboardEventListener()

useEvents([
  [ShortcutKey.ChooseA, () => select(0)],
  [ShortcutKey.ChooseB, () => select(1)],
  [ShortcutKey.ChooseC, () => select(2)],
  [ShortcutKey.ChooseD, () => select(3)],
  [ShortcutKey.Next, () => next()],
])

const settingStore = useSettingStore()

let aShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseA]
let bShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseB]
let cShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseC]
let dShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseD]

let nextShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.Next]

onMounted(init)
</script>

<template>
  <BasePage>
    <div class="card flex flex-col text-xl">
      <div class="flex items-center justify-between">
        <div class="page-title">测试：{{ dict?.name }}</div>
        <div class="text-base">{{ no }} / {{ Math.min(total, testWords.length) }}</div>
      </div>
      <div class="line my-2"></div>

      <div v-if="questions.length" class="flex flex-col gap-4">
        <div class="text-2xl en-article-family flex items-center gap-2">
          <span>题目：{{ questions[index].stem.word }}</span>
          <VolumeIcon :simple="true" :title="'发音'" :cb="() => playWordAudio(questions[index].stem.word)" />
        </div>
        <div class="grid gap-2">
          <div
            v-for="(opt, i) in questions[index].candidates"
            :key="i"
            class="option border rounded p-2 cursor-pointer"
            :class="{
              'text-green-600': questions[index].submitted && i === questions[index].correctIndex,
              'text-red-600':
                questions[index].submitted &&
                i === questions[index].selectedIndex &&
                i !== questions[index].correctIndex,
            }"
            @click="select(i)"
          >
            <span class="">
              <span class="italic">{{ ['A', 'B', 'C', 'D'][i] }}</span>
              <span class="mx-2">[{{ [aShortcutKey, bShortcutKey, cShortcutKey, dShortcutKey][i] }}]</span>
              <span>{{ opt.label }}</span>
            </span>
            <div class="mt-2" v-opacity="questions[index].submitted">{{ opt.word }}</div>
          </div>
        </div>

        <div class="mt-6 flex">
          <BaseButton type="primary" @click="next">继续测试[{{ nextShortcutKey }}]</BaseButton>
          <BaseButton type="info" @click="end">结束</BaseButton>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped>
.option:hover {
  background: var(--color-second);
}
.option {
  min-height: 100px;
}
</style>
