<script setup lang="tsx">

import {nextTick, useSlots} from "vue";
import {Sort} from "@/types/types.ts";
import MiniDialog from "@/components/dialog/MiniDialog.vue";
import BaseIcon from "@/components/BaseIcon.vue";
import BaseButton from "@/components/BaseButton.vue";
import {cloneDeep, debounce, reverse, shuffle} from "@/utils";
import PopConfirm from "@/components/PopConfirm.vue";
import Empty from "@/components/Empty.vue";
import Pagination from '@/components/base/Pagination.vue'
import Toast from '@/components/base/toast/Toast.ts'
import Checkbox from "@/components/base/checkbox/Checkbox.vue";
import DeleteIcon from "@/components/icon/DeleteIcon.vue";
import Dialog from "@/components/dialog/Dialog.vue";
import BaseInput from "@/components/base/BaseInput.vue";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
let list = defineModel('list')

const props = withDefaults(defineProps<{
  loading?: boolean
  showToolbar?: boolean
  exportLoading?: boolean
  importLoading?: boolean
  del?: Function
  batchDel?: Function
  add?: Function
}>(), {
  loading: true,
  showToolbar: true,
  exportLoading: false,
  importLoading: false,
  del: () => void 0,
  add: () => void 0,
  batchDel: () => void 0
})

const emit = defineEmits<{
  click: [val: {
    item: any,
    index: number
  }],
  importData: [e: Event]
  exportData: []
}>()

let listRef: any = $ref()

function scrollToBottom() {
  nextTick(() => {
    listRef?.scrollTo(0, listRef.scrollHeight)
  })
}

function scrollToTop() {
  nextTick(() => {
    listRef?.scrollTo(0, 0)
  })
}

function scrollToItem(index: number) {
  nextTick(() => {
    listRef?.children[index]?.scrollIntoView({block: 'center', behavior: 'smooth'})
  })
}


let pageNo = $ref(1)
let pageSize = $ref(50)
let currentList = $computed(() => {
  if (searchKey) {
    return list.value.filter(v => v.word.includes(searchKey))
  }
  return list.value.slice((pageNo - 1) * pageSize, (pageNo - 1) * pageSize + pageSize)
})

let selectIds = $ref([])
let selectAll = $computed(() => {
  return !!selectIds.length
})

function toggleSelect(item) {
  let rIndex = selectIds.findIndex(v => v === item.id)
  if (rIndex > -1) {
    selectIds.splice(rIndex, 1)
  } else {
    selectIds.push(item.id)
  }
}

function toggleSelectAll() {
  if (selectAll) {
    selectIds = []
  } else {
    selectIds = currentList.map(v => v.id)
  }
}

let searchKey = $ref('')
let showSortDialog = $ref(false)
let showSearchInput = $ref(false)
let showImportDialog = $ref(false)

const closeImportDialog = () => showImportDialog = false

function sort(type: Sort) {
  if (type === Sort.reverse) {
    Toast.success(t('SortReversed'))
    list.value = reverse(cloneDeep(list.value))
  }
  if (type === Sort.random) {
    Toast.success(t('SortRandomized'))
    list.value = shuffle(cloneDeep(list.value))
  }
  showSortDialog = false
}

function handleBatchDel() {
  props.batchDel(selectIds)
  selectIds = []
}

function handlePageNo(e) {
  pageNo = e
  scrollToTop()
}

const s = useSlots()

defineExpose({
  scrollToBottom,
  scrollToItem,
  closeImportDialog
})
defineRender(
    () => {
      const d = (item) => <Checkbox
          modelValue={selectIds.includes(item.id)}
          onChange={() => toggleSelect(item)}
          size="large"/>

      return (
          <div class="flex flex-col gap-3">
            {
                props.showToolbar && <div>
                  {
                    showSearchInput ? (
                        <div class="flex gap-4">
                          <BaseInput
                              clearable
                              modelValue={searchKey}
                              onUpdate:modelValue={debounce(e => searchKey = e)}
                              class="flex-1"
                              autofocus>
                            {{
                              subfix: () => <IconFluentSearch24Regular
                                  class="text-lg text-gray"
                              />
                            }}
                          </BaseInput>
                          <BaseButton onClick={() => (showSearchInput = false, searchKey = '')}>{t('Cancel')}</BaseButton>
                        </div>
                    ) : (
                        <div class="flex justify-between">
                          <div class="flex gap-2 items-center">
                            <Checkbox
                                disabled={!currentList.length}
                                onChange={() => toggleSelectAll()}
                                modelValue={selectAll}
                                size="large"/>
                            <span>{selectIds.length} / {list.value.length}</span>
                          </div>

                          <div class="flex gap-2 relative">
                            {
                              selectIds.length ?
                                  <PopConfirm title={t('ConfirmDeleteAllSelected')}
                                              onConfirm={handleBatchDel}
                                  >
                                    <BaseIcon
                                        class="del"
                                        title={t('Delete')}>
                                      <DeleteIcon/>
                                    </BaseIcon>
                                  </PopConfirm>
                                  : null
                            }
                            <BaseIcon
                                onClick={() => showImportDialog = true}
                                title={t('Import')}>
                              <IconSystemUiconsImport/>
                            </BaseIcon>
                            <BaseIcon
                                onClick={() => emit('exportData')}
                                title={t('Export')}>
                              {props.exportLoading ? <IconEosIconsLoading/> : <IconPhExportLight/>}
                            </BaseIcon>
                            <BaseIcon
                                onClick={props.add}
                                title={t('AddWord')}>
                              <IconFluentAdd20Regular/>
                            </BaseIcon>
                            <BaseIcon
                                disabled={!currentList.length}
                                title={t('ChangeOrder')}
                                onClick={() => showSortDialog = !showSortDialog}
                            >
                              <IconFluentArrowSort20Regular/>
                            </BaseIcon>
                            <BaseIcon
                                disabled={!currentList.length}
                                onClick={() => showSearchInput = !showSearchInput}
                                title={t('Search')}>
                              <IconFluentSearch20Regular/>
                            </BaseIcon>
                            <MiniDialog
                                modelValue={showSortDialog}
                                onUpdate:modelValue={e => showSortDialog = e}
                                style="width: 8rem;"
                            >
                              <div class="mini-row-title">
                                {t('ListOrderSettings')}
                              </div>
                              <div class="mini-row">
                                <BaseButton size="small" onClick={() => sort(Sort.reverse)}>{t('Reverse')}
                                </BaseButton>
                                <BaseButton size="small" onClick={() => sort(Sort.random)}>{t('Random')}</BaseButton>
                              </div>
                            </MiniDialog>
                          </div>
                        </div>
                    )
                  }
                </div>
            }
            {
              props.loading ?
                  <div class="h-full w-full center text-4xl">
                    <IconEosIconsLoading color="gray"/>
                  </div>
                  : currentList.length ? (
                      <>
                        <div class="flex-1 overflow-auto"
                             ref={e => listRef = e}>
                          {currentList.map((item, index) => {
                            return (
                                <div class="list-item-wrapper"
                                     key={item.word}
                                >
                                  {s.default({checkbox: d, item, index: (pageSize * (pageNo - 1)) + index + 1})}
                                </div>
                            )
                          })}
                        </div>
                        <div class="flex justify-end">
                          <Pagination
                              currentPage={pageNo}
                              onUpdate:current-page={handlePageNo}
                              pageSize={pageSize}
                              onUpdate:page-size={(e) => pageSize = e}
                              pageSizes={[20, 50, 100, 200]}
                              layout="prev, pager, next"
                              total={list.value.length}/>
                        </div>
                      </>
                  ) : <Empty/>
            }

            <Dialog modelValue={showImportDialog}
                    onUpdate:modelValue={closeImportDialog}
                    title={t('ImportTutorial')}
            >
              <div className="w-100 p-4 pt-0">
                <div>{t('ImportInstructions1')}</div>
                <div class="color-red">{t('ImportInstructions2')}</div>
                <div>{t('ImportInstructions3')}</div>
                <div>{t('ImportInstructions4')}<span class="color-red">{t('ImportInstructions4Emphasis')}</span>{t('ImportInstructions5')}</div>
                <div>{t('ImportInstructions5')}<span class="color-red">{t('ImportInstructions4Emphasis')}</span>{t('Row')}</div>
                <div>{t('ImportInstructions6')}</div>
                <div class="mt-6">
                  {t('TemplateDownload')}<a href={`https://2study.top/libs/${t('WordImportTemplateName')}`}>{t('WordImportTemplate')}</a>
                </div>
                <div class="mt-4">
                  <BaseButton
                      onClick={() => {
                        let d: HTMLDivElement = document.querySelector('#upload-trigger')
                        d.click()
                      }}
                      loading={props.importLoading}>{t('Import')}</BaseButton>
                  <input
                      id="upload-trigger"
                      type="file"
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                      onChange={e => emit('importData', e)}
                      class="w-0 h-0 opacity-0"/>
                </div>
              </div>
            </Dialog>
          </div>
      )
    }
)
</script>
<style scoped lang="scss">

</style>
