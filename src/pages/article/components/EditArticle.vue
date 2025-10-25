<script setup lang="ts">

import {Article, Sentence, TranslateEngine} from "@/types/types.ts";
import BaseButton from "@/components/BaseButton.vue";
import EditAbleText from "@/components/EditAbleText.vue";
import {getNetworkTranslate, getSentenceAllText, getSentenceAllTranslateText} from "@/hooks/translate.ts";
import {genArticleSectionData, splitCNArticle2, splitEnArticle2, usePlaySentenceAudio} from "@/hooks/article.ts";
import {_nextTick, _parseLRC, cloneDeep, last} from "@/utils";
import {defineAsyncComponent, watch} from "vue";
import Empty from "@/components/Empty.vue";
import Toast from '@/components/base/toast/Toast.ts'
import * as Comparison from "string-comparison"
import BaseIcon from "@/components/BaseIcon.vue";
import {getDefaultArticle} from "@/types/func.ts";
import copy from "copy-to-clipboard";
import {Option, Select} from "@/components/base/select";
import Tooltip from "@/components/base/Tooltip.vue";
import InputNumber from "@/components/base/InputNumber.vue";
import {nanoid} from "nanoid";
import {update} from "idb-keyval";
import ArticleAudio from "@/pages/article/components/ArticleAudio.vue";
import BaseInput from "@/components/base/BaseInput.vue";
import Textarea from "@/components/base/Textarea.vue";
import { LOCAL_FILE_KEY } from "@/config/env.ts";
import { useLanguage } from '@/hooks/useLanguage'

const Dialog = defineAsyncComponent(() => import('@/components/dialog/Dialog.vue'))
const { t } = useLanguage()

interface IProps {
  article?: Article,
  type?: 'single' | 'batch'
}

const props = withDefaults(defineProps<IProps>(), {
  article: () => getDefaultArticle(),
  type: 'single'
})

const emit = defineEmits<{
  save: [val: Article],
  saveAndNext: [val: Article]
}>()

let networkTranslateEngine = $ref('baidu')
let progress = $ref(0)
let failCount = $ref(0)
let textareaRef = $ref<HTMLTextAreaElement>()
const TranslateEngineOptions = [
  // {value: 'youdao', label: '有道'},
  {value: 'baidu', label: '百度'},
]

let editArticle = $ref<Article>(getDefaultArticle())

watch(() => props.article, val => {
  editArticle = cloneDeep(val)
  progress = 0
  failCount = 0
  apply(false)
}, {immediate: true})

watch(() => editArticle.text, (s) => {
  if (!s.trim()) {
    editArticle.sections = []
  }
})

function apply(isHandle: boolean = true) {
  let text = editArticle.text.trim()
  if (!text && isHandle) {
    editArticle.sections = []
    Toast.error(t('PleaseFillInOriginal'))
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
    return Toast.error('请填写标题！')
  }
  if (!editArticle.text.trim()) {
    return Toast.error('请填写正文！')
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
  // return console.log(cloneDeep(editArticle))
  return new Promise((resolve: Function) => {
    // console.log('article', article)
    // copy(JSON.stringify(article))

    editArticle.title = editArticle.title.trim()
    editArticle.titleTranslate = editArticle.titleTranslate.trim()
    editArticle.text = editArticle.text.trim()
    editArticle.textTranslate = editArticle.textTranslate.trim()

    if (!editArticle.title) {
      Toast.error(t('PleaseFillInTitle'))
      return resolve(false)
    }
    if (!editArticle.text) {
      Toast.error(t('PleaseFillInContent'))
      return resolve(false)
    }

    console.log(editArticle)

    let d = cloneDeep(editArticle)
    if (!d.id) d.id = nanoid(6)
    delete d.sections
    //这个console.json方法特意将array压缩了，而不压缩其他，方便可视化复制到文章的json里面去
    copy(console.json(d, 2))
    // copy(JSON.stringify(d, null, 2))
    const saveTemp = () => {
      emit(option as any, editArticle)
      return resolve(true)
    }
    saveTemp()
  })
}

//不知道为什么直接用editArticle，取到是空的默认值
defineExpose({save, getEditArticle: () => cloneDeep(editArticle)})

// 处理音频文件上传
async function handleAudioChange(e: any) {
  let uploadFile = e.target?.files?.[0]
  if (!uploadFile) return
  let data = {
    id: nanoid(),
    file: uploadFile,
  }
  //把文件存到indexDB
  await update(LOCAL_FILE_KEY, (val) => {
    if (val) val.push(data)
    else val = [data]
    return val
  })
  //保存id，后续从indexDb里读文件来使用
  editArticle.audioFileId = data.id
  editArticle.audioSrc = ''
  // 重置input，确保即使选择同一个文件也能触发change事件
  e.target.value = ''
  Toast.success(t('AudioAddedSuccessfully'))
}

// 处理LRC文件上传
function handleChange(e: any) {
  // 获取上传的文件
  let uploadFile = e.target?.files?.[0]
  if (!uploadFile) return

  // 读取文件内容
  let reader = new FileReader();
  reader.readAsText(uploadFile, 'UTF-8');
  reader.onload = function (e) {
    let lrc: string = e.target.result as string;
    console.log(lrc)
    if (lrc.trim()) {
      let lrcList = _parseLRC(lrc)
      console.log('lrcList', lrcList)
      if (lrcList.length) {
        editArticle.lrcPosition = editArticle.sections.map((v, i) => {
          return v.map((w, j) => {
            for (let k = 0; k < lrcList.length; k++) {
              let s = lrcList[k]
              let d = Comparison.default.cosine.similarity(w.text, s.text)
              d = Comparison.default.levenshtein.similarity(w.text, s.text)
              d = Comparison.default.longestCommonSubsequence.similarity(w.text, s.text)
              // d = Comparison.default.metricLcs.similarity(w.text, s.text)
              // console.log(w.text, s.text, d)
              if (d >= 0.8) {
                w.audioPosition = [s.start, s.end ?? -1]
                break
              }
            }
            return w.audioPosition ?? []
          })
        }).flat()

        Toast.success('LRC文件解析成功')
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
let sentenceAudioRef = $ref<HTMLAudioElement>()
let audioRef = $ref<HTMLAudioElement>()

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

const {playSentenceAudio} = usePlaySentenceAudio()

function saveLrcPosition() {
  // showEditAudioDialog = false
  currentSentence.audioPosition = cloneDeep(editSentence.audioPosition)
  editArticle.lrcPosition = editArticle.sections.map((v, i) => v.map((w, j) => (w.audioPosition ?? []))).flat()
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
    val.audioPosition[1] = val.audioPosition[0]
  }
}

</script>

<template>
  <div class="content">
    <div class="row flex flex-col gap-2">
      <div class="title">{{ t('OriginalText') }}</div>
      <div class="flex gap-2 items-center">
        <div class="shrink-0">{{ t('Title') }}：</div>
        <BaseInput
            v-model="editArticle.title"
            :disabled="![100,0].includes(progress)"
            type="text"
            :placeholder="t('PleaseEnterOriginalTitle')"
        />
      </div>
      <div class="">{{ t('Content') }}：<span class="text-sm color-gray">{{ t('OneSentencePerLine') }}</span></div>
      <Textarea v-model="editArticle.text"
                class="h-full"
                :disabled="![100,0].includes(progress)"
                :placeholder="t('PleaseEnterOriginalText')"
                :autosize="false"/>
      <div class="justify-end items-center flex">
        <Tooltip>
          <IconFluentQuestionCircle20Regular class="mr-3" width="20"/>
          <template #reference>
            <div>
              <div class="mb-2">{{ t('HowToUse') }}</div>
              <ol class="py-0 pl-5 my-0 text-base color-main">
                <li>{{ t('CopyOriginalThenSegment') }}</li>
                <li>{{ t('ClickSegmentButton') }}
                </li>
                <li>{{ t('SegmentRule') }}</li>
                <li>{{ t('ClickApplyToSync') }}
                </li>
              </ol>
            </div>
          </template>
        </Tooltip>
        <BaseButton @click="splitText">{{ t('SplitSentence') }}</BaseButton>
        <BaseButton @click="apply()">{{ t('Apply') }}</BaseButton>
      </div>
    </div>
    <div class="row flex flex-col gap-2">
      <div class="title">{{ t('Translation') }}</div>
      <div class="flex gap-2 items-center">
        <div class="shrink-0">{{ t('Title') }}：</div>
        <BaseInput
            v-model="editArticle.titleTranslate"
            :disabled="![100,0].includes(progress)"
            type="text"
            :placeholder="t('PleaseEnterTranslationTitle')"
        />
      </div>
      <div class="">{{ t('Content') }}：<span class="text-sm color-gray">{{ t('OneSentencePerLine') }}</span></div>
      <Textarea v-model="editArticle.textTranslate"
                class="h-full"
                :disabled="![100,0].includes(progress)"
                :placeholder="t('PleaseEnterTranslation')"
                :autosize="false"/>
      <div class="justify-between items-center flex">
        <div class="flex gap-space items-center w-50">
          <BaseButton @click="startNetworkTranslate"
                      :loading="progress!==0 && progress !== 100">{{ t('Translate') }}
          </BaseButton>
          <Select v-model="networkTranslateEngine"
          >
            <Option
                v-for="item in TranslateEngineOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            />
          </Select>
          {{ progress }}%
        </div>
        <div class="flex items-center">
          <Tooltip>
            <IconFluentQuestionCircle20Regular class="mr-3" width="20"/>
            <template #reference>
              <div>
                <div class="mb-2">{{ t('HowToUse') }}</div>
                <ol class="py-0 pl-5 my-0 text-base color-black/60">
                  <li>{{ t('CopyTranslationOrTranslate') }}</li>
                  <li>{{ t('ClickSegmentButton') }}
                  </li>
                  <li>{{ t('SegmentRule') }}</li>
                  <li>{{ t('ClickApplyToSync') }}
                  </li>
                </ol>
              </div>
            </template>
          </Tooltip>
          <BaseButton @click="splitTranslateText">{{ t('SplitSentence') }}</BaseButton>
          <BaseButton @click="apply(true)">{{ t('Apply') }}</BaseButton>
        </div>
      </div>
    </div>
    <div class="row flex flex-col gap-2">
      <div class="flex gap-2">
        <div class="title">{{ t('Result') }}</div>
        <div class="flex gap-2 flex-1 justify-end">
          <ArticleAudio ref="audioRef" :article="editArticle" :autoplay="false"/>
        </div>
      </div>
      <template v-if="editArticle?.sections?.length">
        <div class="flex-1 overflow-auto flex flex-col">
          <div class="flex justify-between bg-black/10 py-2 rounded-lt-md rounded-rt-md">
            <div class="center flex-[7]">{{ t('Content') }}：
              <span class="text-sm color-black/70">{{ t('EditableAutoSync') }}</span></div>
            <div>|</div>
            <div class="center flex-[3] gap-2">
              <span>{{ t('Audio') }}</span>
              <BaseIcon :title="t('AudioManagement')" @click="showAudioDialog = true">
                <IconIconParkOutlineAddMusic/>
              </BaseIcon>
            </div>
          </div>
          <div class="article-translate">
            <div class="section  rounded-md " v-for="(item,indexI) in editArticle.sections">
              <div class="section-title text-lg font-bold">{{ t('SegmentNo', {no: indexI + 1}) }}</div>
              <div class="sentence" v-for="(sentence,indexJ) in item">
                <div class="flex-[7]">
                  <EditAbleText
                      :disabled="![100,0].includes(progress)"
                      :value="sentence.text"
                      @save="(e:string) => saveSentenceText(sentence,e)"
                  />
                  <EditAbleText
                      class="text-lg!"
                      v-if="sentence.translate"
                      :disabled="![100,0].includes(progress)"
                      :value="sentence.translate"
                      @save="(e:string) => saveSentenceTranslate(sentence,e)"
                  />
                </div>
                <div class="flex-[2] flex justify-end gap-1 items-center">
                  <div class="flex justify-end gap-2">
                    <div class="flex flex-col items-center justify-center">
                      <div>{{ sentence.audioPosition?.[0] ?? 0 }}s</div>
                      <BaseIcon
                          @click="setStartTime(sentence,indexI,indexJ)"
                          :title="indexI === 0 && indexJ === 0 ? t('SetStartTime') : t('UsePreviousSentenceEndTime')"
                      >
                        <IconFluentMyLocation20Regular v-if="indexI === 0 && indexJ === 0"/>
                        <IconFluentPaddingLeft20Regular v-else/>
                      </BaseIcon>
                    </div>
                    <div>-</div>
                    <div class="flex flex-col items-center justify-center">
                      <div v-if="sentence.audioPosition?.[1] !== -1">{{ sentence.audioPosition?.[1] ?? 0 }}s</div>
                      <div v-else> {{ t('End') }}</div>
                      <BaseIcon
                          @click="sentence.audioPosition[1] = Number(Number(audioRef.currentTime).toFixed(2))"
                          :title="t('SetEndTime')"
                      >
                        <IconFluentMyLocation20Regular/>
                      </BaseIcon>
                    </div>
                  </div>
                  <div class="flex flex-col">
                    <BaseIcon :icon="sentence.audioPosition?.length ? 'basil:edit-outline' : 'basil:add-outline'"
                              :title="t('Edit')"
                              @click="handleShowEditAudioDialog(sentence,indexI,indexJ)">
                      <IconFluentSpeakerEdit20Regular
                          v-if="sentence.audioPosition?.length && sentence.audioPosition[1]"/>
                      <IconFluentAddSquare20Regular v-else/>
                    </BaseIcon>
                    <BaseIcon
                        :title="t('Play')"
                        v-if="sentence.audioPosition?.length"
                        @click="playSentenceAudio(sentence,audioRef)">
                      <IconFluentPlay20Regular/>
                    </BaseIcon>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="options" v-if="editArticle.text.trim()">
          <div class="status">
            <span>{{ t('Status') }}：</span>
            <div class="warning" v-if="failCount">
              <IconFluentShieldQuestion20Regular/>
              {{ t('SentencesNotTranslated', {count: failCount}) }}
            </div>
            <div class="success" v-else>
              <IconFluentCheckmarkCircle16Regular/>
              {{ t('TranslationComplete') }}
            </div>
          </div>
          <div>
            <BaseButton @click="save('save')">{{ t('Save') }}</BaseButton>
            <BaseButton v-if="type === 'batch'" @click="save('saveAndNext')">{{ t('SaveAndAddNext') }}</BaseButton>
          </div>
        </div>
      </template>
      <Empty v-else :text="t('NoTranslationAvailable')"/>
    </div>
    <Dialog :title="t('SetAudioPosition')"
            v-model="showEditAudioDialog"
            :footer="true"
            @close="showEditAudioDialog = false"
            @ok="saveLrcPosition"
    >
      <div class="p-4 pt-0 color-main w-150 flex flex-col gap-2">
        <div class="">
          {{ t('AudioTutorialText') }}
        </div>
        <ArticleAudio ref="sentenceAudioRef"
                      :article="editArticle"
                      :autoplay="false"
                      class="w-full"/>
        <div class="flex items-center gap-2 space-between mb-2" v-if="editSentence.audioPosition?.length">
          <div>{{ editSentence.text }}</div>
          <div class="flex items-center gap-2 shrink-0">
            <div>
              <span>{{ editSentence.audioPosition?.[0] }}s</span>
              <span v-if="editSentence.audioPosition?.[1] !== -1"> - {{ editSentence.audioPosition?.[1] }}s</span>
              <span v-else> - {{ t('End') }}</span>
            </div>
            <BaseIcon
                :title="t('Play')"
                @click="playSentenceAudio(editSentence,sentenceAudioRef)">
              <IconFluentPlay20Regular/>
            </BaseIcon>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex gap-2 items-center">
            <div>{{ t('StartTime') }}：</div>
            <div class="flex justify-between flex-1">
              <div class="flex items-center gap-2">
                <InputNumber v-model="editSentence.audioPosition[0]" :precision="2" :step="0.1"/>
                <BaseIcon
                    @click="jumpAudio(editSentence.audioPosition[0])"
                    :title="t('JumpTo', {time: editSentence.audioPosition[0]})"
                >
                  <IconFluentMyLocation20Regular/>
                </BaseIcon>
                <BaseIcon
                    v-if="preSentence"
                    @click="setPreEndTimeToCurrentStartTime"
                    :title="t('UsePreviousEndTime', {time: preSentence?.audioPosition?.[1]||0})"
                >
                  <IconFluentPaddingLeft20Regular/>
                </BaseIcon>
              </div>
              <BaseButton @click="recordStart">{{ t('Record') }}</BaseButton>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <div>{{ t('EndTime') }}：</div>
            <div class="flex justify-between flex-1">
              <div class="flex items-center gap-2">
                <InputNumber v-model="editSentence.audioPosition[1]" :precision="2" :step="0.1"/>
                <span>{{ t('Or') }}</span>
                <BaseButton size="small" @click="editSentence.audioPosition[1] = -1">{{ t('End') }}</BaseButton>
              </div>
              <BaseButton @click="recordEnd">{{ t('Record') }}</BaseButton>
            </div>
          </div>
        </div>
      </div>
    </Dialog>

    <Dialog :title="t('AudioManagement')"
            v-model="showAudioDialog"
            :footer="false"
            @close="showAudioDialog = false"
    >
      <div class="p-4 pt-0 color-main w-150 flex flex-col gap-2">
        <div class="">
          1、{{ t('AudioManagementNote1') }}
          <br>
          2、{{ t('AudioManagementNote2') }}
        </div>
        <!--        <ArticleAudio ref="sentenceAudioRef" :article="editArticle" class="w-full"/>-->
        <div class="upload relative">
          <BaseButton>{{ t('UploadAudio') }}</BaseButton>
          <input type="file"
                 accept="audio/*"
                 @change="handleAudioChange"
                 class="w-full h-full absolute left-0 top-0 opacity-0"/>
        </div>
        <div class="upload relative">
          <BaseButton>{{ t('UploadLRCFile') }}</BaseButton>
          <input type="file"
                 accept=".lrc"
                 @change="handleChange"
                 class="w-full h-full absolute left-0 top-0 opacity-0"/>
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
      color: #67C23A;
    }
  }
}
</style>
