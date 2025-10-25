<script setup lang="ts">
import {Article, DictId} from "@/types/types.ts";
import BaseButton from "@/components/BaseButton.vue";
import {_nextTick, cloneDeep, loadJsLib} from "@/utils";
import {useBaseStore} from "@/stores/base.ts";

import List from "@/components/list/List.vue";
import {useWindowClick} from "@/hooks/event.ts";
import {MessageBox} from "@/utils/MessageBox.tsx";
import {useRuntimeStore} from "@/stores/runtime.ts";
import {nanoid} from "nanoid";
import EditArticle from "@/pages/article/components/EditArticle.vue";
import Toast from '@/components/base/toast/Toast.ts'
import {getDefaultArticle} from "@/types/func.ts";
import BackIcon from "@/components/BackIcon.vue";
import MiniDialog from "@/components/dialog/MiniDialog.vue";
import {onMounted} from "vue";
import {Origin} from "@/config/env.ts";
import {syncBookInMyStudyList} from "@/hooks/article.ts";
import { useLanguage } from '@/hooks/useLanguage'

const base = useBaseStore()
const runtimeStore = useRuntimeStore()
const { t } = useLanguage()

let article = $ref<Article>(getDefaultArticle())
let editArticleRef: any = $ref()
let listEl: any = $ref()

async function selectArticle(item: Article) {
  let r = await checkDataChange()
  if (r) {
    article = cloneDeep(item)
  }
}

function checkDataChange() {
  return new Promise(resolve => {
    let editArticle: Article = editArticleRef.getEditArticle()

    if (editArticle.id !== '-1') {
      editArticle.title = editArticle.title.trim()
      editArticle.titleTranslate = editArticle.titleTranslate.trim()
      editArticle.text = editArticle.text.trim()
      editArticle.textTranslate = editArticle.textTranslate.trim()

      if (
          editArticle.title !== article.title ||
          editArticle.titleTranslate !== article.titleTranslate ||
          editArticle.text !== article.text ||
          editArticle.textTranslate !== article.textTranslate
      ) {
        return MessageBox.confirm(
            t('DataChangedSave'),
            t('Hint'),
            async () => {
              let r = await editArticleRef.save('save')
              if (r) resolve(true)
            },
            () => resolve(true),
        )
      }
    } else {
      if (editArticle.title.trim() && editArticle.text.trim()) {
        return MessageBox.confirm(
            t('DataChangedSave'),
            t('Hint'),
            async () => {
              let r = await editArticleRef.save('save')
              if (r) resolve(true)
            },
            () => resolve(true),
        )
      }
    }
    resolve(true)
  })
}

async function add() {
  let r = await checkDataChange()
  if (r) {
    article = getDefaultArticle()
  }
}

function saveArticle(val: Article): boolean {
  if (val.id) {
    let rIndex = runtimeStore.editDict.articles.findIndex(v => v.id === val.id)
    if (rIndex > -1) {
      runtimeStore.editDict.articles[rIndex] = cloneDeep(val)
    }
  } else {
    let has = runtimeStore.editDict.articles.find((item: Article) => item.title === val.title)
    if (has) {
      Toast.error(t('ArticleAlreadyExists'))
      return false
    }
    val.id = nanoid(6)
    runtimeStore.editDict.articles.push(val)
    setTimeout(() => {
      listEl.scrollBottom()
    })
  }
  article = cloneDeep(val)
  //TODO 保存完成后滚动到对应位置
  Toast.success(t('SaveSuccessful'))
  syncBookInMyStudyList()
  return true
}

function saveAndNext(val: Article) {
  if (saveArticle(val)) {
    add()
  }
}

let showExport = $ref(false)
useWindowClick(() => showExport = false)

onMounted(() => {
  if (runtimeStore.editDict.articles.length) {
    article = runtimeStore.editDict.articles[0]
  }
})

let exportLoading = $ref(false)
let importLoading = $ref(false)

function importData(e: any) {
  let file = e.target.files[0]
  if (!file) return
  // no()
  let reader = new FileReader();
  reader.onload = async function (s) {
    importLoading = true
    const XLSX = await loadJsLib('XLSX', `${Origin}/libs/xlsx.full.min.js`);
    let data = s.target.result;
    let workbook = XLSX.read(data, {type: 'binary'});
    let res: any[] = XLSX.utils.sheet_to_json(workbook.Sheets['Sheet1']);
    if (res.length) {
      let articles = res.map(v => {
        if (v['原文标题'] && v['原文正文']) {
          return getDefaultArticle({
            id: nanoid(6),
            title: String(v['原文标题']),
            titleTranslate: String(v['译文标题']),
            text: String(v['原文正文']),
            textTranslate: String(v['译文正文']),
            audioSrc: String(v['音频地址']),
          })
        }
      }).filter(v => v)

      let repeat = []
      let noRepeat = []
      articles.map((v: any) => {
        let rIndex = runtimeStore.editDict.articles.findIndex(s => s.title === v.title)
        if (rIndex > -1) {
          v.index = rIndex
          repeat.push(v)
        } else {
          noRepeat.push(v)
        }
      })

      runtimeStore.editDict.articles = runtimeStore.editDict.articles.concat(noRepeat)

      if (repeat.length) {
        MessageBox.confirm(
            t('ArticlesExistOverwrite', {titles: repeat.map(v => v.title).join(', ')}),
            t('DuplicateArticlesDetected'),
            () => {
              repeat.map(v => {
                runtimeStore.editDict.articles[v.index] = v
                delete runtimeStore.editDict.articles[v.index]["index"]
              })
              setTimeout(listEl?.scrollToBottom, 100)
            },
            null,
            () => {
              e.target.value = ''
              importLoading = false
              syncBookInMyStudyList()
              Toast.success(t('ImportSuccess'))
            }
        )
      } else {
        syncBookInMyStudyList()
        Toast.success(t('ImportSuccess'))
      }
    } else {
      Toast.success(t('ImportFailedNoData'))
    }
    e.target.value = ''
    importLoading = false
  };
  reader.readAsBinaryString(file);
}

async function exportData(val: { type: string, data?: Article }) {
  exportLoading = true
  const XLSX = await loadJsLib('XLSX', `${Origin}/libs/xlsx.full.min.js`);
  const {type, data} = val
  let list = []
  let filename = ''
  if (type === 'item') {
    if (!data.id) {
      return Toast.error('请选择文章')
    }
    list = [data]
    filename = runtimeStore.editDict.name + `-${data.title}`
  } else {
    list = runtimeStore.editDict.articles
    filename = runtimeStore.editDict.name
  }
  let wb = XLSX.utils.book_new()
  let sheetData = list.map(v => {
    return {
      原文标题: v.title,
      原文正文: v.text,
      译文标题: v.titleTranslate,
      译文正文: v.textTranslate,
      音频地址: v.audioSrc,
    }
  })
  wb.Sheets['Sheet1'] = XLSX.utils.json_to_sheet(sheetData)
  wb.SheetNames = ['Sheet1']
  XLSX.writeFile(wb, `${filename}.xlsx`);
  Toast.success(filename + ' 导出成功！')
  showExport = false
  exportLoading = false
}

function updateList(e) {
  runtimeStore.editDict.articles = e
  syncBookInMyStudyList()
}
</script>

<template>
  <div class="add-article">
    <div class="aslide">
      <header class="flex gap-2 items-center">
        <BackIcon/>
        <div class="text-xl">{{ runtimeStore.editDict.name }}</div>
      </header>
      <List
          ref="listEl"
          :list="runtimeStore.editDict.articles"
          @update:list="updateList"
          :select-item="article"
          @del-select-item="article = getDefaultArticle()"
          @select-item="selectArticle"
      >
        <template v-slot="{item,index}">
          <div class="name"> {{ `${index + 1}. ${item.title}` }}</div>
          <div class="translate-name"> {{ `   ${item.titleTranslate}` }}</div>
        </template>
      </List>
      <div class="add" v-if="!article.title">
        正在添加新文章...
      </div>
      <div class="footer">
        <div class="import">
          <BaseButton :loading="importLoading">导入</BaseButton>
          <input type="file"
                 accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                 @change="importData">
        </div>
        <div class="export"
             style="position: relative"
             @click.stop="null">
          <BaseButton @click="showExport = true">导出</BaseButton>
          <MiniDialog
              v-model="showExport"
              style="width: 8rem;bottom: calc(100% + 1rem);top:unset;"
          >
            <div class="mini-row-title">
              导出选项
            </div>
            <div class="flex">
              <BaseButton :loading="exportLoading" @click="exportData({type:'all'})">全部</BaseButton>
              <BaseButton :loading="exportLoading" :disabled="!article.id"
                          @click="exportData({type:'item',data:article})">当前
              </BaseButton>
            </div>
          </MiniDialog>
        </div>
        <BaseButton @click="add">新增</BaseButton>
      </div>
    </div>
    <EditArticle
        ref="editArticleRef"
        type="batch"
        @save="saveArticle"
        @saveAndNext="saveAndNext"
        :article="article"/>
  </div>
</template>

<style scoped lang="scss">


.add-article {
  width: 100%;
  height: 100vh;
  box-sizing: border-box;
  color: var(--color-font-1);
  background: var(--color-second);
  display: flex;

  .close {
    position: absolute;
    right: 1.2rem;
    top: 1.2rem;
  }

  .aslide {
    width: 14vw;
    height: 100%;
    padding: 0 .6rem;
    display: flex;
    flex-direction: column;

    $height: 3rem;

    header {
      height: $height;
    }

    .name {
      font-size: 1.1rem;
    }

    .translate-name {
      font-size: 1rem;
    }

    .add {
      width: 100%;
      box-sizing: border-box;
      border-radius: .5rem;
      margin-bottom: .6rem;
      padding: .6rem;
      display: flex;
      justify-content: space-between;
      transition: all .3s;
      color: var(--color-font-active-1);
      background: var(--color-select-bg);
    }

    .footer {
      height: $height;
      display: flex;
      gap: .6rem;
      align-items: center;
      justify-content: flex-end;

      .import {
        display: inline-flex;
        position: relative;

        input {
          position: absolute;
          height: 100%;
          width: 100%;
          opacity: 0;
        }
      }
    }
  }
}
</style>
