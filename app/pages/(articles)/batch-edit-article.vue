<script setup lang="ts">
import type { Article } from '@/core/types/types.ts'
import { BaseButton, Toast, MiniDialog, BackIcon } from '@/base'
import { cloneDeep, ensureCustomDictCopy, loadJsLib } from '@/core/utils'

import List from '@/core/components/list/List.vue'
import { useWindowClick } from '@/core/hooks/event.ts'
import { MessageBox } from '@/core/utils/MessageBox.tsx'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import { nanoid } from 'nanoid'
import EditArticle from '@/core/components/article/EditArticle.vue'
import { getDefaultArticle, getDefaultDict } from '@/core/types/func.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LIB_JS_URL } from '@/core/config/env.ts'
import { syncBookInMyStudyList } from '@/core/hooks/article.ts'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const runtimeStore = useRuntimeStore()
const baseStore = useBaseStore()
const route = useRoute()
const router = useRouter()

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
          '检测到数据有变动，是否保存？',
          '提示',
          async () => {
            let r = await editArticleRef.save('save')
            if (r) resolve(true)
          },
          () => resolve(true),
          null,
          {t}
        )
      }
    } else {
      if (editArticle.title.trim() && editArticle.text.trim()) {
        return MessageBox.confirm(
          '检测到数据有变动，是否保存？',
          '提示',
          async () => {
            let r = await editArticleRef.save('save')
            if (r) resolve(true)
          },
          () => resolve(true),
          null,
          {t}
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

async function handleBack() {
  if (route.query.from !== 'import') {
    router.back()
    return
  }

  let r = await checkDataChange()
  if (!r) return

  syncBookInMyStudyList()

  const targetId = String(runtimeStore.editDict.id || route.query.targetId || '')
  const countBefore = Number(sessionStorage.getItem(`import-articles-count-${targetId}`) || 0)
  const successCount = Math.max(0, runtimeStore.editDict.articles.length - countBefore)

  if (runtimeStore.editDict.articles.length) {
    sessionStorage.setItem(
      `import-result-${targetId}`,
      JSON.stringify({
        successCount: successCount || runtimeStore.editDict.articles.length,
        skippedCount: 0,
        failedItems: [],
        type: 'article',
      })
    )
  }

  router.replace({
    path: '/import',
    query: {
      type: 'article',
      step: runtimeStore.editDict.articles.length ? '3' : '2',
      targetId,
    },
  })
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
      Toast.error('已存在同名文章！')
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
  Toast.success('保存成功！')
  syncBookInMyStudyList()
  return true
}

function saveAndNext(val: Article) {
  if (saveArticle(val)) {
    add()
  }
}

let showExport = $ref(false)
useWindowClick(() => (showExport = false))

onMounted(() => {
  // 官方资源不允许直接编辑，自动转为副本
  if (!runtimeStore.editDict.custom) {
    const copy = ensureCustomDictCopy(runtimeStore.editDict)
    copy.name = runtimeStore.editDict.name + ' (副本)'
    const existIdx = baseStore.article.bookList.findIndex(v => v.id === copy.id)
    if (existIdx === -1) {
      baseStore.article.bookList.push(getDefaultDict(copy))
    }
    runtimeStore.editDict = copy
  }
  if (runtimeStore.editDict.articles.length) {
    article = runtimeStore.editDict.articles[0]
  }
})

let exportLoading = $ref(false)

function goImportPage() {
  router.push({
    path: '/import',
    query: {
      type: 'article',
      targetId: String(runtimeStore.editDict.id),
      step: '2',
    },
  })
}

async function exportData(val: { type: string; data?: Article }) {
  exportLoading = true
  const XLSX = await loadJsLib('XLSX', LIB_JS_URL.XLSX)
  const { type, data } = val
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
  XLSX.writeFile(wb, `${filename}.xlsx`)
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
        <BackIcon @click="handleBack" />
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
        <template v-slot="{ item, index }">
          <div>
            <div class="name">
              <span class="text-sm text-gray-500" v-if="index != undefined"> {{ index + 1 }}. </span>
              {{ item.title }}
            </div>
            <div class="translate-name">{{ `   ${item.titleTranslate}` }}</div>
          </div>
        </template>
      </List>
      <div class="add" v-if="!article.title">正在添加新文章...</div>
      <div class="footer">
        <BaseButton @click="goImportPage">导入</BaseButton>
        <div class="export" style="position: relative" @click.stop="null">
          <BaseButton @click="showExport = true">导出</BaseButton>
          <MiniDialog v-model="showExport" style="width: 8rem; bottom: calc(100% + 1rem); top: unset">
            <div class="mini-row-title">导出选项</div>
            <div class="flex">
              <BaseButton :loading="exportLoading" @click="exportData({ type: 'all' })">全部</BaseButton>
              <BaseButton
                :loading="exportLoading"
                :disabled="!article.id"
                @click="exportData({ type: 'item', data: article })"
                >当前
              </BaseButton>
            </div>
          </MiniDialog>
        </div>
        <BaseButton @click="add">新增</BaseButton>
      </div>
    </div>

    <EditArticle ref="editArticleRef" type="batch" @save="saveArticle" @saveAndNext="saveAndNext" :article="article" />
  </div>
</template>

<style scoped lang="scss">
.add-article {
  width: 100%;
  height: 100vh;
  box-sizing: border-box;
  color: var(--color-font-1);
  display: flex;
  background: var(--color-second);

  .close {
    position: absolute;
    right: 1.2rem;
    top: 1.2rem;
  }

  .aslide {
    width: 14vw;
    height: 100%;
    padding: 0 0.6rem;
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
      border-radius: 0.5rem;
      margin-bottom: 0.6rem;
      padding: 0.6rem;
      display: flex;
      justify-content: space-between;
      transition: all 0.3s;
      color: var(--color-font-active-1);
      background: var(--color-select-bg);
    }

    .footer {
      height: $height;
      display: flex;
      gap: 0.6rem;
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
