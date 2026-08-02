<script setup lang="tsx">
import { detail } from '@typewords/core/apis'
import { BaseButton, BaseIcon, BasePage, Form, FormItem, PopConfirm, Textarea, Toast, BackIcon } from '@typewords/base'
import BaseTable from '@typewords/core/components/BaseTable.vue'
import WordItem from '@typewords/core/components/word/WordItem.vue'
import { BaseInput } from '@typewords/base'
import { DeleteIcon } from '@typewords/base'
import { AppEnv, DictId, LIB_JS_URL, TourConfig } from '@typewords/core/config/env.ts'
import { getCurrentStudyWord } from '@typewords/core/hooks/dict.ts'
import EditBook from '@typewords/core/components/article/EditBook.vue'
import PracticeSettingDialog from '@typewords/core/components/word/PracticeSettingDialog.vue'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { getDefaultDict } from '@typewords/core/types/func.ts'
import {
  _getDictDataByUrl,
  _nextTick,
  convertToWord,
  isMobile,
  loadJsLib,
  reverse,
  shuffle,
  useNav,
} from '@typewords/core/utils'
import { MessageBox } from '@typewords/core/utils/MessageBox.tsx'
import { nanoid } from 'nanoid'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { wordDelete } from '@typewords/core/apis/words.ts'
import { copyOfficialDict } from '@typewords/core/apis/dict.ts'
import { PRACTICE_WORD_CACHE } from '@typewords/core/utils/cache.ts'
import { Sort, WordPracticeMode } from '@typewords/core/types/enum.ts'

const runtimeStore = useRuntimeStore()
const base = useBaseStore()
const router = useRouter()
const route = useRoute()
const isMob = isMobile()
const { t: $t } = useI18n()
let loading = $ref(false)
let allList = $ref([])

const getDefaultFormWord = () => {
  return {
    id: '',
    word: '',
    phonetic0: '',
    phonetic1: '',
    note: '',
    trans: '',
    sentences: '',
    phrases: '',
    synos: '',
    relWords: '',
    etymology: '',
  }
}
let isOperate = $ref(false)
let wordForm = $ref(getDefaultFormWord())
let wordFormRef = $ref()
const wordRules = reactive({
  word: [
    { required: true, message: '请输入单词', trigger: 'blur' },
    { max: 100, message: '名称不能超过100个字符', trigger: 'blur' },
  ],
})
let studyLoading = $ref(false)

function syncDictInMyStudyList(study = false) {
  _nextTick(() => {
    //这里不能移，一定要先找到对应的词典，再去改id。不然先改id，就找不到对应的词典了
    let rIndex = base.word.bookList.findIndex(v => v.id === runtimeStore.editDict.id)

    runtimeStore.editDict.words = allList
    let temp = runtimeStore.editDict
    if (!temp.custom && ![DictId.wordKnown, DictId.wordWrong, DictId.wordCollect].includes(temp.id)) {
      temp.custom = true
      if (!temp.id.includes('_custom')) {
        temp.id += '_custom_' + nanoid(6)
      }
    }
    temp.length = temp.words.length
    if (rIndex > -1) {
      base.word.bookList[rIndex] = getDefaultDict(temp)
      if (study) base.word.studyIndex = rIndex
    } else {
      base.word.bookList.push(getDefaultDict(temp))
      if (study) base.word.studyIndex = base.word.bookList.length - 1
    }
  }, 100)
}

async function onSubmitWord() {
  // return console.log('wordFormRef',wordFormRef,wordFormRef.validate)
  await wordFormRef.validate(valid => {
    if (valid) {
      let data: any = convertToWord(wordForm)
      // 笔记集中存储，不保存在 Word 对象内
      const noteVal = wordForm.note?.trim()
      const wordKey = wordForm.word
      if (noteVal) {
        base.noteData[wordKey] = noteVal
      } else {
        delete base.noteData[wordKey]
      }
      //todo 可以检查的更准确些，比如json对比
      if (data.id) {
        let r = allList.find(v => v.id === data.id)
        if (r) {
          Object.assign(r, data)
          Toast.success('修改成功')
        } else {
          Toast.success('修改失败，未找到单词')
          return
        }
      } else {
        data.id = nanoid(6)
        data.checked = false
        let r = allList.find(v => v.word === wordForm.word)
        if (r) {
          Toast.warning('已有相同名称单词！')
          return
        } else allList.push(data)
        Toast.success('添加成功')
        wordForm = getDefaultFormWord()
      }
      syncDictInMyStudyList()
    } else {
      Toast.warning('请填写完整')
    }
  })
}

async function batchDel(ids: string[]) {
  let localHandle = () => {
    ids.map(id => {
      let rIndex2 = allList.findIndex(v => v.id === id)
      if (rIndex2 > -1) {
        if (id === wordForm.id) {
          wordForm = getDefaultFormWord()
        }
        allList.splice(rIndex2, 1)
      }
    })
    tableRef.value.getData()
    syncDictInMyStudyList()
  }

  let cloudHandle = async dictId => {
    let res = await wordDelete(null, {
      wordIds: ids,
      dictId,
    })
    if (res.success) {
      tableRef.value.getData()
    } else {
      return Toast.error(res.msg ?? '删除失败')
    }
  }

  if (AppEnv.CAN_REQUEST) {
    if (dict.custom) {
      if (dict.sync) {
        await cloudHandle(dict.id)
      } else {
        localHandle()
      }
    } else {
      let r = await copyOfficialDict(null, { id: dict.id })
      if (r.success) {
        await cloudHandle(r.data.id)
        getDetail(r.data.id)
      } else {
        //todo 权限判断，能否复制
        return Toast.error(r.msg)
      }
    }
  } else {
    localHandle()
  }
}

//把word对象的字段全转成字符串
function word2Str(word) {
  let res = getDefaultFormWord()
  res.id = word.id
  res.word = word.word
  res.phonetic1 = word.phonetic1
  res.phonetic0 = word.phonetic0
  res.note = base.noteData[word.word] ?? ''
  res.trans = word.trans.map(v => (v.pos + v.cn).replaceAll('"', '')).join('\n')
  res.sentences = word.sentences.map(v => (v.c + '\n' + v.cn).replaceAll('"', '')).join('\n\n')
  res.phrases = word.phrases.map(v => (v.c + '\n' + v.cn).replaceAll('"', '')).join('\n\n')
  res.synos = word.synos.map(v => (v.pos + v.cn + '\n' + v.ws.join('/')).replaceAll('"', '')).join('\n\n')
  res.relWords = word.relWords.root
    ? '词根:' +
      word.relWords.root +
      '\n\n' +
      word.relWords.rels
        .map(v => (v.pos + '\n' + v.words.map(v => v.c + ':' + v.cn).join('\n')).replaceAll('"', ''))
        .join('\n\n')
    : ''
  res.etymology = word.etymology.map(v => (v.t + '\n' + v.d).replaceAll('"', '')).join('\n\n')
  return res
}

function editWord(word) {
  isOperate = true
  wordForm = word2Str(word)
  if (isMob) activeTab = 'edit'
}

function addWord() {
  // setTimeout(wordListRef?.scrollToBottom, 100)
  isOperate = true
  wordForm = getDefaultFormWord()
  if (isMob) activeTab = 'edit'
}

function closeWordForm() {
  isOperate = false
  wordForm = getDefaultFormWord()
  if (isMob) activeTab = 'list'
}

let isEdit = $ref(false)
let isAdd = $ref(false)
let activeTab = $ref<'list' | 'edit'>('list') // 移动端标签页状态

const showBookDetail = computed(() => {
  return !(isAdd || isEdit)
})

onMounted(async () => {
  if (route.query?.isAdd) {
    isAdd = true
    runtimeStore.editDict = getDefaultDict()
  } else {
    if (!runtimeStore.editDict.id) {
      return router.push('/words')
    } else {
      if (
        !runtimeStore.editDict.words.length &&
        !runtimeStore.editDict.custom &&
        ![DictId.wordCollect, DictId.wordWrong, DictId.wordKnown].includes(
          runtimeStore.editDict.en_name || runtimeStore.editDict.id
        )
      ) {
        loading = true
        let r = await _getDictDataByUrl(runtimeStore.editDict)
        runtimeStore.editDict = r
      }
      if (base.word.bookList.find(book => book.id === runtimeStore.editDict.id)) {
        if (AppEnv.CAN_REQUEST) {
          getDetail(runtimeStore.editDict.id)
        }
      }
      loading = false
    }
  }

  allList = runtimeStore.editDict.words
  tableRef.value.getData()
})

async function getDetail(id) {
  //todo 优化：这里只返回详情
  let res = await detail({ id })
  if (res.success) {
    runtimeStore.editDict = res.data
  }
}

function formClose() {
  if (isEdit) isEdit = false
  else router.back()
}

let showPracticeSettingDialog = $ref(false)

const store = useBaseStore()
const settingStore = useSettingStore()
const { nav } = useNav()

//todo 可以和首页合并
async function startPractice(query = {}) {
  //这里重置一下，因为下面切换词典后，导致学习进度为0，而切换前的模式有可能需要有进度才可以用
  if (![WordPracticeMode.Free, WordPracticeMode.System].includes(settingStore.wordPracticeMode)) {
    settingStore.wordPracticeMode = WordPracticeMode.System
  }
  // console.log(1)
  localStorage.removeItem(PRACTICE_WORD_CACHE.key)
  studyLoading = true
  await base.changeDict(runtimeStore.editDict)
  studyLoading = false
  window.umami?.track('startStudyWord', {
    name: store.sdict.name,
    index: store.sdict.lastLearnIndex,
    perDayStudyNumber: store.sdict.perDayStudyNumber,
    custom: store.sdict.custom,
    complete: store.sdict.complete,
    wordPracticeMode: settingStore.wordPracticeMode,
  })
  let currentStudy = getCurrentStudyWord()
  nav('practice-words/' + store.sdict.id, query, { taskWords: currentStudy })
}

async function addMyStudyList() {
  if (!runtimeStore.editDict.words.length) {
    return Toast.warning('没有单词可学习！')
  }
  showPracticeSettingDialog = true
}

async function startTest() {
  loading = true
  //这里重置一下，因为下面切换词典后，导致学习进度为0，而切换前的模式有可能需要有进度才可以用
  if (![WordPracticeMode.Free, WordPracticeMode.System].includes(settingStore.wordPracticeMode)) {
    settingStore.wordPracticeMode = WordPracticeMode.System
  }
  await base.changeDict(runtimeStore.editDict)
  loading = false
  nav('words-test/' + store.sdict.id, {}, {})
}

let exportLoading = $ref(false)
let importLoading = $ref(false)
let tableRef = ref()

function importData(e) {
  let file = e.target.files[0]
  if (!file) return

  let reader = new FileReader()
  reader.onload = async function (s) {
    let data = s.target.result
    importLoading = true
    const XLSX = await loadJsLib('XLSX', LIB_JS_URL.XLSX)
    let workbook = XLSX.read(data, { type: 'binary' })
    let res: any[] = XLSX.utils.sheet_to_json(workbook.Sheets['Sheet1'])
    if (res.length) {
      let words = res
        .map(v => {
          if (v['单词']) {
            let data = null
            try {
              data = convertToWord({
                id: nanoid(6),
                word: v['单词'],
                phonetic0: v['音标①'] ?? '',
                phonetic1: v['音标②'] ?? '',
                trans: v['翻译'] ?? '',
                sentences: v['例句'] ?? '',
                phrases: v['短语'] ?? '',
                synos: v['近义词'] ?? '',
                relWords: v['同根词'] ?? '',
                etymology: v['词源'] ?? '',
              })
              // 笔记集中存储
              const noteVal = (v['笔记'] ?? '').trim()
              if (noteVal) {
                base.noteData[v['单词']] = noteVal
              }
            } catch (e) {
              console.error('导入单词报错' + v['单词'], e.message)
            }
            return data
          }
        })
        .filter(v => v)
      if (words.length) {
        let repeat = []
        let noRepeat = []
        words.map((v: any) => {
          let rIndex = runtimeStore.editDict.words.findIndex(s => s.word === v.word)
          if (rIndex > -1) {
            v.index = rIndex
            repeat.push(v)
          } else {
            noRepeat.push(v)
          }
        })

        runtimeStore.editDict.words = runtimeStore.editDict.words.concat(noRepeat)

        if (repeat.length) {
          MessageBox.confirm(
            '单词"' + repeat.map(v => v.word).join(', ') + '" 已存在，是否覆盖原单词？',
            '检测到重复单词',
            () => {
              repeat.map(v => {
                runtimeStore.editDict.words[v.index] = v
                delete runtimeStore.editDict.words[v.index]['index']
              })
            },
            null,
            () => {
              tableRef.value.closeImportDialog()
              e.target.value = ''
              importLoading = false
              allList = runtimeStore.editDict.words
              tableRef.value.getData()
              syncDictInMyStudyList()
              Toast.success('导入成功！')
            },
            { t: $t }
          )
        } else {
          tableRef.value.closeImportDialog()
          e.target.value = ''
          importLoading = false
          allList = runtimeStore.editDict.words
          tableRef.value.getData()
          syncDictInMyStudyList()
          Toast.success('导入成功！')
        }
      } else {
        Toast.warning('导入失败！原因：没有数据/未认别到数据')
      }
    } else {
      Toast.warning('导入失败！原因：没有数据')
    }
    e.target.value = ''
    importLoading = false
  }
  reader.readAsBinaryString(file)
}

async function exportData() {
  exportLoading = true
  const XLSX = await loadJsLib('XLSX', LIB_JS_URL.XLSX)
  let list = runtimeStore.editDict.words
  let filename = runtimeStore.editDict.name
  let wb = XLSX.utils.book_new()
  let sheetData = list.map(v => {
    let t = word2Str(v)
    return {
      单词: t.word,
      '音标①': t.phonetic0,
      '音标②': t.phonetic1,
      笔记: t.note,
      翻译: t.trans,
      例句: t.sentences,
      短语: t.phrases,
      近义词: t.synos,
      同根词: t.relWords,
      词源: t.etymology,
    }
  })
  wb.Sheets['Sheet1'] = XLSX.utils.json_to_sheet(sheetData)
  wb.SheetNames = ['Sheet1']
  XLSX.writeFile(wb, `${filename}.xlsx`)
  Toast.success(filename + ' 导出成功！')
  exportLoading = false
}

watch(
  () => loading,
  val => {
    if (!val) return
    _nextTick(async () => {
      const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
      const tour = new Shepherd.Tour(TourConfig)
      tour.on('cancel', () => {
        localStorage.setItem('tour-guide', '1')
      })
      tour.addStep({
        id: 'step3',
        text: '点击这里开始学习',
        attachTo: { element: '#study', on: 'bottom' },
        buttons: [
          {
            text: `下一步（3/${TourConfig.total}）`,
            action() {
              tour.next()
              addMyStudyList()
            },
          },
        ],
      })

      tour.addStep({
        id: 'step4',
        text: '这里可以选择学习模式、设置学习数量、修改学习进度',
        attachTo: { element: '#mode', on: 'bottom' },
        beforeShowPromise() {
          return new Promise(resolve => {
            const timer = setInterval(() => {
              if (document.querySelector('#mode')) {
                clearInterval(timer)
                setTimeout(resolve, 500)
              }
            }, 100)
          })
        },
        buttons: [
          {
            text: `下一步（4/${TourConfig.total}）`,
            action() {
              tour.next()
              startPractice({ guide: 1 })
            },
          },
        ],
      })

      const r = localStorage.getItem('tour-guide')
      if (settingStore.first && !r && !isMobile()) {
        tour.start()
      }
    }, 500)
  }
)

const dict = $computed(() => runtimeStore.editDict)

//获取本地单词列表
function getLocalList({ pageNo, pageSize, searchKey }) {
  let list = allList
  let total = allList.length
  if (searchKey.trim()) {
    list = allList.filter(v => v.word.toLowerCase().includes(searchKey.trim().toLowerCase()))
    total = list.length
  }
  list = list.slice((pageNo - 1) * pageSize, (pageNo - 1) * pageSize + pageSize)
  return { list, total }
}

async function requestList({ pageNo, pageSize, searchKey }) {
  if (!dict.custom && ![DictId.wordCollect, DictId.wordWrong, DictId.wordKnown].includes(dict.en_name || dict.id)) {
    // 非自定义词典，直接请求json

    //如果没数据则请求
    if (!allList.length) {
      let r = await _getDictDataByUrl(dict)
      allList = r.words
    }
    return getLocalList({ pageNo, pageSize, searchKey })
  } else {
    // 自定义词典

    //如果登录了,则请求后端数据
    if (AppEnv.CAN_REQUEST) {
      //todo 加上sync标记
      if (dict.sync || true) {
        //todo 优化：这里应该只返回列表
        let res = await detail({ id: dict.id, pageNo, pageSize })
        if (res.success) {
          return { list: res.data.words, total: res.data.length }
        }
        return { list: [], total: 0 }
      }
    } else {
      //未登录则用本地保存的数据
      allList = dict.words
    }
    return getLocalList({ pageNo, pageSize, searchKey })
  }
}

function onSort(type: Sort, pageNo: number, pageSize: number) {
  if (AppEnv.CAN_REQUEST) {
  } else {
    let fun = reverse
    if ([Sort.reverse, Sort.reverseAll].includes(type)) {
      fun = reverse
    } else if ([Sort.random, Sort.randomAll].includes(type)) {
      fun = shuffle
    }
    allList = allList
      .slice(0, pageSize * (pageNo - 1))
      .concat(fun(allList.slice(pageSize * (pageNo - 1), pageSize * (pageNo - 1) + pageSize)))
      .concat(allList.slice(pageSize * (pageNo - 1) + pageSize))
    runtimeStore.editDict.words = allList
    Toast.success('操作成功')
    tableRef.value.getData()
    syncDictInMyStudyList()
  }
}

defineRender(() => {
  return (
    <BasePage>
      {showBookDetail.value ? (
        <div className="card mb-0 dict-detail-card flex flex-col">
          <div class="dict-header flex justify-between items-center relative">
            <BackIcon class="dict-back z-2" />
            <div class="dict-title absolute page-title text-align-center w-full">{runtimeStore.editDict.name}</div>
            <div class="dict-actions flex">
              <BaseButton loading={studyLoading || loading} type="info" onClick={() => (isEdit = true)}>
                {$t('edit')}
              </BaseButton>
              <BaseButton loading={studyLoading || loading} type="info" onClick={startTest}>
                {$t('test')}
              </BaseButton>
              <BaseButton id="study" loading={studyLoading || loading} onClick={addMyStudyList}>
                {$t('learn')}
              </BaseButton>
            </div>
          </div>
          {dict.description && (
            <>
              <div class="text-lg  mt-2">
                {$t('introduction')}：{dict.description}
              </div>
              <div class="line my-3"></div>
            </>
          )}

          {/* 移动端标签页导航 */}
          {isMob && isOperate && (
            <div class="tab-navigation mb-3">
              <div class={`tab-item ${activeTab === 'list' ? 'active' : ''}`} onClick={() => (activeTab = 'list')}>
                {$t('word_list')}
              </div>
              <div class={`tab-item ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => (activeTab = 'edit')}>
                {wordForm.id ? $t('edit') : $t('add')}
                {$t('word')}
              </div>
            </div>
          )}

          <div class="flex flex-1 overflow-hidden content-area">
            <div class={`word-list-section ${isMob && isOperate && activeTab !== 'list' ? 'mobile-hidden' : ''}`}>
              <BaseTable
                ref={tableRef}
                class="h-full"
                request={requestList}
                onDel={batchDel}
                onSort={onSort}
                onAdd={addWord}
                onImport={importData}
                onExport={exportData}
                exportLoading={exportLoading}
                importLoading={importLoading}
              >
                {val => (
                  <WordItem
                    showTransPop={false}
                    onClick={() => editWord(val.item)}
                    index={val.index}
                    showCollectIcon={false}
                    showMarkIcon={false}
                    item={val.item}
                  >
                    {{
                      prefix: () => val.checkbox(val.item),
                      suffix: () => (
                        <div class="flex flex-col">
                          <BaseIcon class="option-icon" onClick={() => editWord(val.item)} title="编辑">
                            <IconFluentTextEditStyle20Regular />
                          </BaseIcon>
                          <PopConfirm title="确认删除？" onConfirm={() => batchDel([val.item.id])}>
                            <BaseIcon class="option-icon" title="删除">
                              <DeleteIcon />
                            </BaseIcon>
                          </PopConfirm>
                        </div>
                      ),
                    }}
                  </WordItem>
                )}
              </BaseTable>
            </div>
            {isOperate ? (
              <div class={`edit-section flex-1 flex flex-col ${isMob && activeTab !== 'edit' ? 'mobile-hidden' : ''}`}>
                <div class="common-title">
                  {wordForm.id ? $t('edit') : $t('add')}
                  {$t('word')}
                </div>
                <Form
                  class="flex-1 overflow-auto pr-2"
                  ref={e => (wordFormRef = e)}
                  rules={wordRules}
                  model={wordForm}
                  label-width="7rem"
                >
                  <FormItem label="单词" prop="word">
                    <BaseInput modelValue={wordForm.word} onUpdate:modelValue={e => (wordForm.word = e)}></BaseInput>
                  </FormItem>
                  <FormItem label="英音音标">
                    <BaseInput modelValue={wordForm.phonetic0} onUpdate:modelValue={e => (wordForm.phonetic0 = e)} />
                  </FormItem>
                  <FormItem label="美音音标">
                    <BaseInput modelValue={wordForm.phonetic1} onUpdate:modelValue={e => (wordForm.phonetic1 = e)} />
                  </FormItem>
                  <FormItem label="翻译">
                    <Textarea
                      modelValue={wordForm.trans}
                      onUpdate:modelValue={e => (wordForm.trans = e)}
                      placeholder="一行一个翻译，前面词性，后面内容（如n.取消）；多个翻译请换行"
                      autosize={{ minRows: 6, maxRows: 10 }}
                    />
                  </FormItem>
                  <FormItem label="笔记">
                    <Textarea
                      modelValue={wordForm.note}
                      onUpdate:modelValue={e => (wordForm.note = e)}
                      placeholder="记录这个单词的个人笔记"
                      autosize={{ minRows: 3, maxRows: 8 }}
                    />
                  </FormItem>
                  <FormItem label="例句">
                    <Textarea
                      modelValue={wordForm.sentences}
                      onUpdate:modelValue={e => (wordForm.sentences = e)}
                      placeholder="一行原文，一行译文；多个请换两行"
                      autosize={{ minRows: 6, maxRows: 10 }}
                    />
                  </FormItem>
                  <FormItem label="短语">
                    <Textarea
                      modelValue={wordForm.phrases}
                      onUpdate:modelValue={e => (wordForm.phrases = e)}
                      placeholder="一行原文，一行译文；多个请换两行"
                      autosize={{ minRows: 6, maxRows: 10 }}
                    />
                  </FormItem>
                  <FormItem label="同义词">
                    <Textarea
                      modelValue={wordForm.synos}
                      onUpdate:modelValue={e => (wordForm.synos = e)}
                      placeholder="请参考已有单词格式"
                      autosize={{ minRows: 6, maxRows: 20 }}
                    />
                  </FormItem>
                  <FormItem label="同根词">
                    <Textarea
                      modelValue={wordForm.relWords}
                      onUpdate:modelValue={e => (wordForm.relWords = e)}
                      placeholder="请参考已有单词格式"
                      autosize={{ minRows: 6, maxRows: 20 }}
                    />
                  </FormItem>
                  <FormItem label="词源">
                    <Textarea
                      modelValue={wordForm.etymology}
                      onUpdate:modelValue={e => (wordForm.etymology = e)}
                      placeholder="请参考已有单词格式"
                      autosize={{ minRows: 6, maxRows: 10 }}
                    />
                  </FormItem>
                </Form>
                <div class="center">
                  <BaseButton type="info" onClick={closeWordForm}>
                    {$t('close')}
                  </BaseButton>
                  <BaseButton type="primary" onClick={onSubmitWord}>
                    {$t('save')}
                  </BaseButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div class="card mb-0 dict-detail-card">
          <div class="dict-header flex justify-between items-center relative">
            <BackIcon
              class="dict-back z-2"
              onClick={() => {
                if (isAdd) {
                  router.back()
                } else {
                  isEdit = false
                }
              }}
            />
            <div class="dict-title absolute page-title text-align-center w-full">
              {runtimeStore.editDict.id ? $t('edit_dict') : $t('create_dict')}
            </div>
          </div>
          <div class="center">
            <EditBook isAdd={isAdd} isBook={false} onClose={formClose} onSubmit={() => (isEdit = isAdd = false)} />
          </div>
        </div>
      )}

      <PracticeSettingDialog
        showLeftOption
        modelValue={showPracticeSettingDialog}
        onUpdate:modelValue={val => (showPracticeSettingDialog = val)}
        onOk={startPractice}
      />
    </BasePage>
  )
})
</script>

<style scoped lang="scss">
.dict-detail-card {
  height: calc(100vh - 3rem);
}

.dict-header {
  gap: 0.5rem;
}

.dict-actions {
  flex-wrap: wrap;
}

.word-list-section {
  width: 44%;
}

.edit-section {
  margin-left: 1rem;
}

.tab-navigation {
  display: none; // 默认隐藏，移动端显示
}

.mobile-hidden {
  display: none;
}


@media (max-width: 768px) {
  .dict-detail-card {
    height: unset;
    min-height: calc(100vh - 2rem);
    margin-bottom: 0 !important;
  }

  .dict-header {
    width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.75rem;
  }

  .dict-header .dict-back {
    align-self: flex-start;
  }

  .dict-header .dict-title {
    position: static !important;
    width: 100%;
  }

  .dict-header .dict-actions {
    width: 100%;
    justify-content: center;
    gap: 0.75rem;
  }

  .tab-navigation {
    display: flex;
    border-bottom: 2px solid var(--color-item-border);
    margin-bottom: 1rem;
    gap: 0;

    .tab-item {
      flex: 1;
      padding: 0.75rem 1rem;
      text-align: center;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--color-sub-text);
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.3s ease;
      user-select: none;

      &:active {
        transform: scale(0.98);
      }

      &.active {
        color: var(--color-icon-hightlight);
        border-bottom-color: var(--color-icon-hightlight);
      }
    }
  }

  .content-area {
    flex-direction: column;

    .word-list-section,
    .edit-section {
      width: 100% !important;
      margin-left: 0 !important;
      max-width: 100%;
    }

    .edit-section {
      margin-top: 0;
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .dict-detail-card {
    height: unset;
    min-height: calc(100vh - 1rem);
  }

  .tab-navigation {
    .tab-item {
      padding: 0.6rem 0.5rem;
      font-size: 0.9rem;
    }
  }
}
</style>
