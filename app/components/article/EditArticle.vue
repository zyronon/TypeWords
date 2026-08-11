<script setup lang="ts">
import type { Article, Sentence } from '@/core/types'
import {
  BaseButton,
  BaseIcon,
  InputNumber,
  Tooltip,
  Textarea,
  Toast,
  Option,
  Select,
  BaseInput,
  UploadButton,
} from '@/base'
import EditAbleText from '@/components/EditAbleText.vue'
import { getNetworkTranslate, getSentenceAllText, getSentenceAllTranslateText } from '@/core/hooks/translate.ts'
import { genArticleSectionData, splitCNArticle2, splitEnArticle2, usePlaySentenceAudio } from '@/core/hooks/article.ts'
import { _nextTick, _parseLRC, cloneDeep, last } from '@/core/utils'
import { defineAsyncComponent, watch } from 'vue'
import Empty from '@/components/Empty.vue'
import * as Comparison from 'string-comparison'
import { getDefaultArticle } from '@/core/types'
import copy from 'copy-to-clipboard'
import { nanoid } from 'nanoid'
import { update } from 'idb-keyval'
import ArticleAudio from './ArticleAudio.vue'
import { LOCAL_FILE_KEY } from '@/core/config/env.ts'
import { TranslateEngine } from '@/core/types'
import { useI18n } from 'vue-i18n'

const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))
const { t: $t } = useI18n()

interface IProps {
  article?: Article
  type?: 'single' | 'batch'
}

const props = withDefaults(defineProps<IProps>(), {
  article: () => getDefaultArticle(),
  type: 'single',
})

const emit = defineEmits<{
  save: [val: Article]
  saveAndNext: [val: Article]
}>()

let networkTranslateEngine = $ref('baidu')
let progress = $ref(0)
let failCount = $ref(0)
let resultRef = $ref<HTMLDivElement>()
const TranslateEngineOptions = [
  // {value: 'youdao', label: '有道'},
  { value: 'baidu', label: '百度' },
]

let editArticle = $ref<Article>(getDefaultArticle())

watch(
  () => props.article,
  val => {
    editArticle = getDefaultArticle(val)
    progress = 0
    failCount = 0
    apply(false)
    _nextTick(() => {
      resultRef?.scrollTo(0, 0)
    })
  },
  { immediate: true }
)

watch(
  () => editArticle.text,
  s => {
    if (!s.trim()) {
      editArticle.sections = []
    }
  }
)

function apply(isHandle: boolean = true) {
  let text = editArticle.text.trim()
  if (!text && isHandle) {
    // text = "Last week I went to the theatre. I had a very good seat. The play was very interesting. I did not enjoy it. A young man and a young woman were sitting behind me. They were talking loudly. I got very angry. I could not hear the actors. I turned round. I looked at the man and the woman angrily. They did not pay any attention. In the end, I could not bear it. I turned round again. 'I can't hear a word!' I said angrily.\n\n    'It's none of your business,' the young man said rudely. 'This is a private conversation!'"
    // text = `While it is yet to be seen what direction the second Trump administration will take globally in its China policy, VOA traveled to the main island of Mahe in Seychelles to look at how China and the U.S. have impacted the country, and how each is fairing in that competition for influence there.`
    // text = "It was Sunday. I never get up early on Sundays. I sometimes stay in bed until lunchtime. Last Sunday I got up very late. I looked out of the window. It was dark outside. 'What a day!' I thought. 'It's raining again.' Just then, the telephone rang. It was my aunt Lucy. 'I've just arrived by train,' she said. 'I'm coming to see you.'\n\n     'But I'm still having breakfast,' I said.\n\n     'What are you doing?' she asked.\n\n     'I'm having breakfast,' I repeated.\n\n     'Dear me,' she said. 'Do you always get up so late? It's one o'clock!'"
    editArticle.sections = []
    Toast.error($t('please_fill_original'))
    return
  }
  failCount = genArticleSectionData(editArticle)
}

//分句原文
function splitText() {
  editArticle.text = splitEnArticle2(editArticle.text)
}

//分句翻译
function splitTranslateText() {
  editArticle.textTranslate = splitCNArticle2(editArticle.textTranslate.trim())
}

//TODO
async function startNetworkTranslate() {
  if (!editArticle.title.trim()) {
    return Toast.error($t('please_fill_title'))
  }
  if (!editArticle.text.trim()) {
    return Toast.error($t('please_fill_content'))
  }
  editArticle.titleTranslate = ''
  editArticle.textTranslate = ''
  apply()
  //注意！！！
  //这里需要用异步，因为watch了article.networkTranslate，改变networkTranslate了之后，会重新设置article.sections
  //导致getNetworkTranslate里面拿到的article.sections是废弃的值
  setTimeout(async () => {
    await getNetworkTranslate(editArticle, TranslateEngine.Baidu, false, (v: number) => {
      progress = v
    })
    failCount = 0
  })
}

function saveSentenceTranslate(sentence: Sentence, val: string) {
  sentence.translate = val
  editArticle.textTranslate = getSentenceAllTranslateText(editArticle)
  apply()
}

function saveSentenceText(sentence: Sentence, val: string) {
  sentence.text = val
  editArticle.text = getSentenceAllText(editArticle)
  apply()
}

function save(option: 'save' | 'saveAndNext') {
  return new Promise((resolve: Function) => {
    // console.log('article', article)
    // copy(JSON.stringify(article))

    editArticle.title = editArticle.title.trim()
    editArticle.titleTranslate = editArticle.titleTranslate.trim()
    editArticle.text = editArticle.text.trim()
    editArticle.textTranslate = editArticle.textTranslate.trim()

    if (!editArticle.title) {
      Toast.error($t('please_fill_title'))
      return resolve(false)
    }
    if (!editArticle.text) {
      Toast.error($t('please_fill_content'))
      return resolve(false)
    }

    editArticle.lrcPosition = editArticle.sections
      .map(v => {
        return v.map((w, j) => {
          return w.audioPosition ?? []
        })
      })
      .flat()

    console.log(editArticle)

    let d = cloneDeep(editArticle)
    if (!d.id) d.id = nanoid(6)
    delete d.sections
    //这个console.json方法特意将array压缩了，而不压缩其他，方便可视化复制到文章的json里面去
    copy(console.json(d, 2))
    // copy(JSON.stringify(d, null, 2))
    emit(option as any, editArticle)
    resolve(true)
  })
}

//不知道为什么直接用editArticle，取到是空的默认值
defineExpose({ save, getEditArticle: () => cloneDeep(editArticle) })

// 处理音频文件上传
async function handleAudioChange(e: any) {
  let uploadFile = e.target?.files?.[0]
  if (!uploadFile) return
  let data = {
    id: nanoid(),
    file: uploadFile,
  }
  //把文件存到indexDB
  await update(LOCAL_FILE_KEY, val => {
    if (val) val.push(data)
    else val = [data]
    return val
  })
  //保存id，后续从indexDb里读文件来使用
  editArticle.audioFileId = data.id
  editArticle.audioSrc = ''
  // 重置input，确保即使选择同一个文件也能触发change事件
  e.target.value = ''
  Toast.success($t('audio_added_success'))
}

// 处理LRC文件上传
function handleChange(e: any) {
  // 获取上传的文件
  let uploadFile = e.target?.files?.[0]
  if (!uploadFile) return

  // 读取文件内容
  let reader = new FileReader()
  reader.readAsText(uploadFile, 'UTF-8')
  reader.onload = function (e) {
    let lrc: string = e.target.result as string
    console.log(lrc)
    if (lrc.trim()) {
      let lrcList = _parseLRC(lrc)
      console.log('lrcList', lrcList)
      if (lrcList.length) {
        editArticle.lrcPosition = editArticle.sections
          .map((v, i) => {
            return v.map((w, j) => {
              for (let k = 0; k < lrcList.length; k++) {
                let s = lrcList[k]
                // let d = Comparison.default.cosine.similarity(w.text, s.text)
                // d = Comparison.default.levenshtein.similarity(w.text, s.text)
                let d = Comparison.default.longestCommonSubsequence.similarity(w.text, s.text)
                // d = Comparison.default.metricLcs.similarity(w.text, s.text)
                // console.log(w.text, s.text, d)
                if (d >= 0.8) {
                  w.audioPosition = [s.start, s.end ?? -1]
                  break
                }
              }
              return w.audioPosition ?? []
            })
          })
          .flat()

        Toast.success($t('lrc_parse_success'))
      }
    }
  }

  // 重置input，确保即使选择同一个文件也能触发change事件
  e.target.value = ''
}

let currentSentence = $ref<Sentence>({} as any)
let editSentence = $ref<Sentence>({} as any)
let preSentence = $ref<Sentence>({} as any)
let showEditAudioDialog = $ref(false)
let showAudioDialog = $ref(false)
let showNameDialog = $ref(false)
let sentenceAudioRef = $ref<HTMLAudioElement>()
let audioRef = $ref<HTMLAudioElement>()

let nameListRef = $ref<string[]>([])
watch(
  () => showNameDialog,
  v => {
    if (v) {
      nameListRef = cloneDeep(Array.isArray(editArticle.nameList) ? editArticle.nameList : [])
      nameListRef.push('')
    }
  }
)

function addName() {
  nameListRef.push('')
}

function removeName(i: number) {
  nameListRef.splice(i, 1)
}

function saveNameList() {
  const cleaned = Array.from(new Set(nameListRef.map(s => (s ?? '').trim()).filter(Boolean)))
  editArticle.nameList = cleaned as any
}

function handleShowEditAudioDialog(val: Sentence, i: number, j: number) {
  showEditAudioDialog = true
  currentSentence = val
  editSentence = cloneDeep(val)
  preSentence = null
  audioRef.pause()
  if (j == 0) {
    if (i != 0) {
      preSentence = last(editArticle.sections[i - 1])
    }
  } else {
    preSentence = editArticle.sections[i][j - 1]
  }
  if (!editSentence.audioPosition?.length) {
    editSentence.audioPosition = [0, 0]
    if (preSentence) {
      editSentence.audioPosition = [preSentence.audioPosition[1] ?? 0, 0]
    }
  }
  _nextTick(() => {
    sentenceAudioRef.currentTime = editSentence.audioPosition[0]
  })
}

function recordStart() {
  if (sentenceAudioRef.paused) {
    sentenceAudioRef.play()
  }
  editSentence.audioPosition[0] = Number(sentenceAudioRef.currentTime.toFixed(2))
  if (editSentence.audioPosition[0] > editSentence.audioPosition[1] && editSentence.audioPosition[1] !== 0) {
    editSentence.audioPosition[1] = editSentence.audioPosition[0]
  }
}

function recordEnd() {
  if (!sentenceAudioRef.paused) {
    sentenceAudioRef.pause()
  }
  editSentence.audioPosition[1] = Number(sentenceAudioRef.currentTime.toFixed(2))
}

const { playSentenceAudio } = usePlaySentenceAudio()

function saveLrcPosition() {
  // showEditAudioDialog = false
  currentSentence.audioPosition = cloneDeep(editSentence.audioPosition)
  editArticle.lrcPosition = editArticle.sections.map((v, i) => v.map((w, j) => w.audioPosition ?? [])).flat()
}

function jumpAudio(time: number) {
  sentenceAudioRef.currentTime = time
}

function setPreEndTimeToCurrentStartTime() {
  if (preSentence) {
    editSentence.audioPosition[0] = preSentence.audioPosition[1]
  }
}

function setStartTime(val: Sentence, i: number, j: number) {
  let preSentence = null
  if (j == 0) {
    if (i != 0) {
      preSentence = last(editArticle.sections[i - 1])
    }
  } else {
    preSentence = editArticle.sections[i][j - 1]
  }
  if (preSentence) {
    val.audioPosition[0] = preSentence.audioPosition[1]
  } else {
    val.audioPosition[0] = Number(Number(audioRef.currentTime).toFixed(2))
  }
  if (val.audioPosition[0] > val.audioPosition[1] && val.audioPosition[1] !== 0) {
    val.audioPosition[1] = 0
  }
}

function setEndTime(val: Sentence, i: number, j: number) {
  val.audioPosition[1] = Number(Number(audioRef.currentTime).toFixed(2))
  if (val.audioPosition[0] === 0) {
    setStartTime(val, i, j)
  }
}

function minusStartTime(val: Sentence) {
  if (val.audioPosition[0] <= 0) return
  val.audioPosition[0] = Number((val.audioPosition[0] - 0.3).toFixed(2))
}
</script>

<template>
  <div class="content">
    <div class="row flex flex-col gap-2">
      <div class="title">{{ $t('original_text') }}</div>
      <div class="flex gap-2 items-center">
        <div class="shrink-0">{{ $t('title') }}：</div>
        <BaseInput
          v-model="editArticle.title"
          :disabled="![100, 0].includes(progress)"
          type="text"
          :placeholder="$t('please_fill_original_title')"
        />
      </div>
      <div class="flex justify-between">
        <span
          >{{ $t('content') }}：<span class="text-sm color-gray">{{ $t('one_sentence_per_line') }}</span></span
        >
        <Tooltip :title="$t('name_config_tip')">
          <div @click="showNameDialog = true" class="center gap-1 cp">
            <span>{{ $t('name_config') }}</span>
            <IconFluentSettings20Regular />
          </div>
        </Tooltip>
      </div>
      <Textarea
        v-model="editArticle.text"
        class="h-full"
        :disabled="![100, 0].includes(progress)"
        :placeholder="$t('please_paste_original')"
        :autosize="false"
      />
      <div class="justify-end items-center flex">
        <Tooltip>
          <IconFluentQuestionCircle20Regular class="mr-3" width="20" />
          <template #reference>
            <div>
              <div class="mb-2">{{ $t('usage_guide') }}</div>
              <ol class="py-0 pl-5 my-0 text-base color-main">
                <li>{{ $t('copy_and_split') }}</li>
                <li>
                  {{ $t('click') }} <span class="color-red font-bold">{{ $t('split_sentence') }}</span>
                  {{ $t('auto_split') }}<span class="color-red font-bold"> {{ $t('or') }}</span>
                  {{ $t('manual_split') }}
                </li>
                <li>{{ $t('split_rule') }}</li>
                <li>
                  {{ $t('after_edit_click') }} <span class="color-red font-bold">{{ $t('apply') }}</span>
                  {{ $t('sync_to_result') }}
                </li>
              </ol>
            </div>
          </template>
        </Tooltip>
        <BaseButton @click="splitText">{{ $t('split_sentence') }}</BaseButton>
        <BaseButton @click="apply()">{{ $t('apply') }}</BaseButton>
      </div>
    </div>
    <div class="row flex flex-col gap-2">
      <div class="title">{{ $t('translation') }}</div>
      <div class="flex gap-2 items-center">
        <div class="shrink-0">{{ $t('title') }}：</div>
        <BaseInput
          v-model="editArticle.titleTranslate"
          :disabled="![100, 0].includes(progress)"
          type="text"
          :placeholder="$t('please_fill_translation_title')"
        />
      </div>
      <div class="">
        {{ $t('content') }}：<span class="text-sm color-gray">{{ $t('one_sentence_per_line') }}</span>
      </div>
      <Textarea
        v-model="editArticle.textTranslate"
        class="h-full"
        :disabled="![100, 0].includes(progress)"
        :placeholder="$t('please_fill_translation')"
        :autosize="false"
      />
      <div class="justify-between items-center flex">
        <div class="flex gap-space items-center w-50" v-if="false">
          <BaseButton @click="startNetworkTranslate" :loading="progress !== 0 && progress !== 100"
            >{{ $t('translate') }}
          </BaseButton>
          <Select v-model="networkTranslateEngine">
            <Option v-for="item in TranslateEngineOptions" :key="item.value" :label="item.label" :value="item.value" />
          </Select>
          {{ progress }}%
        </div>
        <div></div>
        <div class="flex items-center">
          <Tooltip>
            <IconFluentQuestionCircle20Regular class="mr-3" width="20" />
            <template #reference>
              <div>
                <div class="mb-2">{{ $t('usage_guide') }}</div>
                <ol class="py-0 pl-5 my-0 text-base color-black/60">
                  <li>
                    {{ $t('copy_translation_or_click') }} <span class="color-red font-bold">{{ $t('translate') }}</span>
                  </li>
                  <li>
                    {{ $t('click') }} <span class="color-red font-bold">{{ $t('split_sentence') }}</span>
                    {{ $t('auto_split') }}<span class="color-red font-bold"> {{ $t('or') }}</span>
                    {{ $t('manual_split') }}
                  </li>
                  <li>{{ $t('split_rule') }}</li>
                  <li>
                    {{ $t('after_edit_click') }}
                    <span class="color-red font-bold">{{ $t('apply') }}</span> {{ $t('sync_to_result') }}
                  </li>
                </ol>
              </div>
            </template>
          </Tooltip>
          <BaseButton @click="splitTranslateText">{{ $t('split_sentence') }}</BaseButton>
          <BaseButton @click="apply(true)">{{ $t('apply') }}</BaseButton>
        </div>
      </div>
    </div>
    <div class="row flex flex-col gap-2">
      <div class="flex gap-2">
        <div class="title">{{ $t('result') }}</div>
        <div class="flex gap-2 flex-1 justify-end">
          <ArticleAudio ref="audioRef" :article="editArticle" :autoplay="false" />
        </div>
      </div>
      <template v-if="editArticle?.sections?.length">
        <div class="flex-1 overflow-auto flex flex-col">
          <div class="flex justify-between bg-black/10 py-2 rounded-lt-md rounded-rt-md">
            <div class="center flex-[7]">
              {{ $t('content') }}( <span class="text-sm color-gray-500">{{ $t('editable_auto_sync') }}</span
              >)
            </div>
            <div>|</div>
            <div class="center flex-[3] gap-2">
              <span>{{ $t('audio') }}</span>
              <BaseIcon :title="$t('audio_management')" @click="showAudioDialog = true">
                <IconIconParkOutlineAddMusic />
              </BaseIcon>
            </div>
          </div>
          <div class="article-translate" ref="resultRef">
            <div class="section rounded-md" v-for="(item, indexI) in editArticle.sections">
              <div class="section-title text-lg font-bold">{{ $t('paragraph') }}{{ indexI + 1 }}</div>
              <div class="sentence" v-for="(sentence, indexJ) in item">
                <div class="flex-[7]">
                  <EditAbleText
                    :disabled="![100, 0].includes(progress)"
                    :value="sentence.text"
                    @save="(e: string) => saveSentenceText(sentence, e)"
                  />
                  <EditAbleText
                    class="text-lg!"
                    v-if="sentence.translate"
                    :disabled="![100, 0].includes(progress)"
                    :value="sentence.translate"
                    @save="(e: string) => saveSentenceTranslate(sentence, e)"
                  />
                </div>
                <div class="flex-[2] flex justify-end gap-1 items-center">
                  <div class="flex justify-end gap-2">
                    <div class="flex flex-col items-center justify-center">
                      <div>{{ sentence.audioPosition?.[0] ?? 0 }}s</div>
                      <div class="flex gap-1">
                        <BaseIcon
                          @click="setStartTime(sentence, indexI, indexJ)"
                          :title="indexI === 0 && indexJ === 0 ? $t('set_start_time') : $t('use_prev_end_time')"
                        >
                          <IconFluentMyLocation20Regular v-if="indexI === 0 && indexJ === 0" />
                          <IconFluentPaddingLeft20Regular v-else />
                        </BaseIcon>
                        <BaseIcon @click="minusStartTime(sentence)" :title="$t('minus_03s')"> -.3s </BaseIcon>
                      </div>
                    </div>
                    <div>-</div>
                    <div class="flex flex-col items-center justify-center">
                      <div v-if="sentence.audioPosition?.[1] !== -1">{{ sentence.audioPosition?.[1] ?? 0 }}s</div>
                      <div v-else>{{ $t('end') }}</div>
                      <BaseIcon @click="setEndTime(sentence, indexI, indexJ)" :title="$t('set_end_time')">
                        <IconFluentMyLocation20Regular />
                      </BaseIcon>
                    </div>
                  </div>
                  <div class="flex flex-col">
                    <BaseIcon
                      :icon="sentence.audioPosition?.length ? 'basil:edit-outline' : 'basil:add-outline'"
                      :title="$t('edit_audio_align')"
                      @click="handleShowEditAudioDialog(sentence, indexI, indexJ)"
                    >
                      <IconFluentSpeakerEdit20Regular
                        v-if="sentence.audioPosition?.length && sentence.audioPosition[1]"
                      />
                      <IconFluentAddSquare20Regular v-else />
                    </BaseIcon>
                    <BaseIcon
                      :title="$t('play')"
                      v-if="sentence.audioPosition?.length"
                      @click="playSentenceAudio(sentence, audioRef)"
                    >
                      <IconFluentPlay20Regular />
                    </BaseIcon>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="options" v-if="editArticle.text.trim()">
          <div class="status">
            <span>{{ $t('status') }}：</span>
            <div class="warning" v-if="failCount">
              <IconFluentShieldQuestion20Regular />
              {{ $t('sentences_not_translated', { count: failCount }) }}
            </div>
            <div class="success" v-else>
              <IconFluentCheckmarkCircle16Regular />
              {{ $t('translation_complete') }}
            </div>
          </div>
          <div>
            <BaseButton @click="save('save')">{{ $t('save') }}</BaseButton>
            <BaseButton v-if="type === 'batch'" @click="save('saveAndNext')">{{ $t('save_and_next') }}</BaseButton>
          </div>
        </div>
      </template>
      <Empty v-else :text="$t('no_translation_comparison')" />
    </div>
    <Dialog
      :title="$t('adjust_audio_timeline')"
      v-model="showEditAudioDialog"
      :footer="true"
      @close="showEditAudioDialog = false"
      @ok="saveLrcPosition"
    >
      <div class="p-4 pt-0 color-main w-150 flex flex-col gap-2">
        <div class="">
          {{ $t('audio_timeline_tutorial') }}
        </div>
        <ArticleAudio ref="sentenceAudioRef" :article="editArticle" :autoplay="false" class="w-full" />
        <div class="flex items-center gap-2 justify-between mb-2" v-if="editSentence.audioPosition?.length">
          <div>{{ editSentence.text }}</div>
          <div class="flex items-center gap-2 shrink-0">
            <div>
              <span>{{ editSentence.audioPosition?.[0] }}s</span>
              <span v-if="editSentence.audioPosition?.[1] !== -1"> - {{ editSentence.audioPosition?.[1] }}s</span>
              <span v-else> - {{ $t('end') }}</span>
            </div>
            <BaseIcon :title="$t('play')" @click="playSentenceAudio(editSentence, sentenceAudioRef)">
              <IconFluentPlay20Regular />
            </BaseIcon>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex gap-2 items-center">
            <div>{{ $t('start_time') }}：</div>
            <div class="flex justify-between flex-1">
              <div class="flex items-center gap-2">
                <InputNumber v-model="editSentence.audioPosition[0]" :precision="2" :step="0.1" />
                <BaseIcon
                  @click="jumpAudio(editSentence.audioPosition[0])"
                  :title="$t('jump_to_seconds', { seconds: editSentence.audioPosition[0] })"
                >
                  <IconFluentMyLocation20Regular />
                </BaseIcon>
                <BaseIcon
                  v-if="preSentence"
                  @click="setPreEndTimeToCurrentStartTime"
                  :title="$t('use_prev_end_seconds', { seconds: preSentence?.audioPosition?.[1] || 0 })"
                >
                  <IconFluentPaddingLeft20Regular />
                </BaseIcon>
                <BaseIcon
                  @click="editSentence.audioPosition[0] = Number((editSentence.audioPosition[0] - 0.3).toFixed(2))"
                  :title="$t('decrease_03s')"
                >
                  -.3s
                </BaseIcon>
                <BaseIcon
                  @click="editSentence.audioPosition[0] = Number((editSentence.audioPosition[0] + 0.3).toFixed(2))"
                  :title="$t('increase_03s')"
                >
                  +.3s
                </BaseIcon>
              </div>
              <BaseButton @click="recordStart">{{ $t('record') }}</BaseButton>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <div>{{ $t('end_time') }}：</div>
            <div class="flex justify-between flex-1">
              <div class="flex items-center gap-2">
                <InputNumber v-model="editSentence.audioPosition[1]" :precision="2" :step="0.1" />
                <span>{{ $t('or') }}</span>
                <BaseButton size="small" @click="editSentence.audioPosition[1] = -1">{{ $t('end') }}</BaseButton>
              </div>
              <BaseButton @click="recordEnd">{{ $t('record') }}</BaseButton>
            </div>
          </div>
        </div>
      </div>
    </Dialog>

    <Dialog :title="$t('audio_management')" v-model="showAudioDialog" :footer="false" @close="showAudioDialog = false">
      <div class="p-4 pt-0 color-main w-150 flex flex-col gap-2">
        <div class="">
          {{ $t('audio_upload_notice') }}
        </div>
        <!--        <ArticleAudio ref="sentenceAudioRef" :article="editArticle" class="w-full"/>-->
        <UploadButton accept="audio/*" @change="handleAudioChange">
          {{ $t('upload_audio') }}
        </UploadButton>
        <UploadButton accept=".lrc" @change="handleChange">
          {{ $t('upload_lrc') }}
        </UploadButton>
      </div>
    </Dialog>

    <Dialog
      :title="$t('name_management')"
      v-model="showNameDialog"
      :footer="true"
      @close="showNameDialog = false"
      @ok="saveNameList"
    >
      <div class="p-4 pt-0 color-main w-150 flex flex-col gap-3">
        <div class="flex justify-between items-center">
          <div class="text-base">{{ $t('name_ignore_config_desc') }}</div>
          <BaseButton type="info" @click="addName">{{ $t('add_name') }}</BaseButton>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2" v-for="(name, i) in nameListRef" :key="i">
            <BaseInput
              v-model="nameListRef[i]"
              :placeholder="$t('enter_name')"
              size="large"
              :autofocus="i === nameListRef.length - 1"
            />
            <BaseButton type="info" @click="removeName(i)">{{ $t('delete') }}</BaseButton>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped lang="scss">
.content {
  color: var(--color-article);
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  gap: var(--space);
  padding: 0.6rem;
  padding-left: 0;
}

.row {
  flex: 7;
  width: 33%;
  //height: 100%;
  display: flex;
  flex-direction: column;
  //opacity: 0;

  &:nth-child(3) {
    flex: 10;
  }

  .title {
    font-weight: bold;
    font-size: 1.4rem;
  }

  .article-translate {
    flex: 1;
    overflow-y: overlay;

    .section {
      background: var(--color-textarea-bg);
      margin-bottom: 1.2rem;

      .section-title {
        padding: 0.5rem;
        border-bottom: 1px solid var(--color-item-border);
      }

      &:last-child {
        margin-bottom: 0;
      }

      .sentence {
        display: flex;
        padding: 0.5rem;
        line-height: 1.2;
        border-bottom: 1px solid var(--color-item-border);

        &:last-child {
          border-bottom: none;
        }
      }
    }
  }

  .options {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .status {
      display: flex;
      align-items: center;
    }

    .warning {
      display: flex;
      align-items: center;
      font-size: 1.2rem;
      color: red;
    }

    .success {
      display: flex;
      align-items: center;
      font-size: 1.2rem;
      color: #67c23a;
    }
  }
}


@media (max-width: 768px) {
  .content {
    flex-direction: column;
    padding: 0.5rem;
    gap: 1rem;

    .row {
      width: 100%;
      flex: none;

      &:nth-child(3) {
        flex: none;
      }

      .title {
        font-size: 1.2rem;
      }

      // 表单元素优化
      .base-input,
      .base-textarea {
        width: 100%;
        font-size: 16px; // 防止iOS自动缩放
      }

      .base-textarea {
        min-height: 150px;
        max-height: 30vh;
      }

      // 按钮组优化
      .flex.gap-2 {
        flex-wrap: wrap;
        gap: 0.5rem;

        .base-button {
          min-height: 44px;
          flex: 1;
          min-width: 120px;
        }
      }

      // 文章翻译区域优化
      .article-translate {
        .section {
          margin-bottom: 1rem;

          .section-title {
            font-size: 1rem;
            padding: 0.4rem;
          }

          .sentence {
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.4rem;

            .flex-\[7\] {
              width: 100%;
            }

            .flex-\[2\] {
              width: 100%;
              justify-content: flex-start;

              .flex.justify-end.gap-2 {
                justify-content: flex-start;
                flex-wrap: wrap;
                gap: 0.5rem;
              }
            }
          }
        }
      }

      // 选项区域优化
      .options {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;

        .status {
          font-size: 0.9rem;
        }

        .warning,
        .success {
          font-size: 1rem;
        }
      }
    }
  }
}

@media (max-width: 480px) {
  .content {
    padding: 0.3rem;

    .row {
      .base-textarea {
        min-height: 120px;
      }

      .flex.gap-2 {
        .base-button {
          min-width: 100px;
          font-size: 0.9rem;
        }
      }
    }
  }
}
</style>
