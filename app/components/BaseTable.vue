<script setup lang="tsx">
import { nextTick, onMounted, useSlots } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BaseButton,
  BaseIcon,
  BaseInput,
  BaseOptionButton,
  Checkbox,
  DeleteIcon,
  MiniDialog,
  Pagination,
  PopConfirm,
} from '@/base'
import { debounce } from '@/core/utils'
import Empty from '@/components/Empty.vue'
import { Sort } from '@/core/types'

const { t: $t } = useI18n()

const props = withDefaults(
  defineProps<{
    loading?: boolean
    showToolbar?: boolean
    showCheckbox?: boolean
    showPagination?: boolean
    exportXlsxLoading?: boolean
    exportJsonLoading?: boolean
    request?: Function
    list?: any[]
    /** 只读模式：禁用所有写操作，hover 时显示 readonlyTip */
    readonly?: boolean
    readonlyTip?: string
  }>(),
  {
    loading: true,
    showCheckbox: false,
    showToolbar: true,
    showPagination: true,
    exportXlsxLoading: false,
    exportJsonLoading: false,
    readonly: false,
  }
)

const emit = defineEmits<{
  add: []
  click: [
    val: {
      item: any
      index: number
    },
  ]
  import: []
  exportXlsx: []
  exportJson: []
  del: [ids: number[]]
  sort: [type: Sort, pageNo: number, pageSize: number]
}>()

let listRef: any = $ref()
let showCheckbox = $ref(false)

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
    listRef?.children[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

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
    selectIds = params.list.map(v => v.id)
  }
}

let showSortDialog = $ref(false)
let showSearchInput = $ref(false)

function sort(type: Sort) {
  if ([Sort.reverse, Sort.random].includes(type)) {
    emit('sort', type, params.pageNo, params.pageSize)
  } else {
    emit('sort', type, 1, params.total)
  }
  showSortDialog = false
}

function handleBatchDel() {
  emit('del', selectIds)
  selectIds = []
}

const s = useSlots()

defineExpose({
  scrollToBottom,
  scrollToItem,
  getData,
})

let loading2 = $ref(false)

let params = $ref({
  pageNo: 1,
  pageSize: 50,
  total: 0,
  list: [],
  sortType: null,
  searchKey: '',
})

function search(key: string) {
  if (!params.searchKey) {
    params.pageNo = 1
  }
  params.searchKey = key
  getData()
}

function cancelSearch() {
  params.searchKey = ''
  showSearchInput = false
  getData()
}

async function getData() {
  if (props.request) {
    loading2 = true
    let { list, total } = await props.request(params)
    params.list = list
    params.total = total
    loading2 = false
  } else {
    params.list = props.list ?? []
  }
}

function handlePageNo(e) {
  params.pageNo = e
  getData()
  scrollToTop()
}

onMounted(async () => {
  getData()
})

defineRender(() => {
  const d = item => (
    <Checkbox modelValue={selectIds.includes(item.id)} onChange={() => toggleSelect(item)} size="large" />
  )

  return (
    <div class="base-table flex flex-col gap-3">
      {props.showToolbar && (
        <div>
          {showSearchInput ? (
            <div class="flex gap-4">
              <BaseInput
                clearable
                modelValue={params.searchKey}
                onUpdate:modelValue={debounce(e => search(e), 500)}
                class="flex-1"
                autofocus
              >
                {{
                  subfix: () => <IconFluentSearch24Regular class="text-lg text-gray" />,
                }}
              </BaseInput>
              <BaseButton onClick={cancelSearch}>{$t('cancel')}</BaseButton>
            </div>
          ) : (
            <div class="flex justify-between items-center">
              {showCheckbox ? (
                <div class="flex gap-2 items-center">
                  <Checkbox
                    disabled={!params.list.length}
                    onChange={() => toggleSelectAll()}
                    modelValue={selectAll}
                    size="large"
                  />
                  <span>
                    {selectIds.length} / {params.total}
                  </span>
                </div>
              ) : (
                <div>
                  {params.total}
                  {$t('total_items')}
                </div>
              )}

              <div class="flex gap-2 relative">
                {selectIds.length && showCheckbox ? (
                  <PopConfirm title={$t('confirm_delete_selected')} onConfirm={handleBatchDel}>
                    <BaseButton type="info">{$t('confirm')}</BaseButton>
                  </PopConfirm>
                ) : null}

                <BaseIcon
                  disabled={props.readonly}
                  title={props.readonly ? props.readonlyTip : $t('batch_delete')}
                  onClick={() => !props.readonly && (showCheckbox = !showCheckbox)}
                >
                  <DeleteIcon />
                </BaseIcon>
                <BaseIcon
                  disabled={props.readonly}
                  title={props.readonly ? props.readonlyTip : $t('import')}
                  onClick={() => !props.readonly && emit('import')}
                >
                  <IconSystemUiconsImport />
                </BaseIcon>
                {props.readonly ? (
                  <BaseIcon disabled title={props.readonlyTip}>
                    <IconPhExportLight />
                  </BaseIcon>
                ) : (
                  <BaseOptionButton
                    v-slots={{
                      options: () => (
                        <div class="flex flex-col gap-2">
                          <BaseButton class="w-full" onClick={() => emit('exportXlsx')}>
                            {props.exportXlsxLoading ? <IconEosIconsLoading /> : $t('export_as_xlsx')}
                          </BaseButton>
                          <BaseButton class="w-full" onClick={() => emit('exportJson')}>
                            {props.exportJsonLoading ? <IconEosIconsLoading /> : $t('export_as_json')}
                          </BaseButton>
                        </div>
                      ),
                    }}
                  >
                    <BaseIcon title={$t('export')}>
                      <IconPhExportLight />
                    </BaseIcon>
                  </BaseOptionButton>
                )}
                <BaseIcon
                  disabled={props.readonly}
                  title={props.readonly ? props.readonlyTip : $t('add_word')}
                  onClick={() => !props.readonly && emit('add')}
                >
                  <IconFluentAdd20Regular />
                </BaseIcon>
                <BaseIcon
                  disabled={props.readonly || !params.list.length}
                  title={props.readonly ? props.readonlyTip : $t('change_order')}
                  onClick={() => !props.readonly && (showSortDialog = !showSortDialog)}
                >
                  <IconFluentArrowSort20Regular />
                </BaseIcon>
                <BaseIcon
                  disabled={!params.list.length}
                  onClick={() => (showSearchInput = !showSearchInput)}
                  title={$t('search')}
                >
                  <IconFluentSearch20Regular />
                </BaseIcon>
                <MiniDialog
                  modelValue={showSortDialog}
                  onUpdate:modelValue={e => (showSortDialog = e)}
                  style="width: 8rem;"
                >
                  <div class="mini-row-title">{$t('list_order_setting')}</div>
                  <div class="flex flex-col gap2 btn-no-margin">
                    <BaseButton onClick={() => sort(Sort.reverse)}>{$t('reverse_current_page')}</BaseButton>
                    <BaseButton onClick={() => sort(Sort.reverseAll)}>{$t('reverse_all')}</BaseButton>
                    <div class="line"></div>
                    <BaseButton onClick={() => sort(Sort.random)}>{$t('random_current_page')}</BaseButton>
                    <BaseButton onClick={() => sort(Sort.randomAll)}>{$t('random_all')}</BaseButton>
                  </div>
                </MiniDialog>
              </div>
            </div>
          )}
        </div>
      )}

      <div class="relative flex-1 overflow-hidden">
        {params.list.length ? (
          <div class="overflow-auto h-full" ref={e => (listRef = e)}>
            {params.list.map((item, index) => {
              return (
                <div class="list-item-wrapper" key={item.word}>
                  {s.default({
                    checkbox: showCheckbox ? d : () => void 0,
                    item,
                    index: params.pageSize * (params.pageNo - 1) + index + 1,
                  })}
                </div>
              )
            })}
          </div>
        ) : !loading2 ? (
          <Empty />
        ) : null}
        {loading2 && (
          <div class="absolute top-0 left-0 bottom-0 right-0 bg-black bg-op-10  center text-4xl">
            <IconEosIconsLoading color="gray" />
          </div>
        )}
      </div>

      {props.showPagination && (
        <div class="flex justify-end">
          <Pagination
            currentPage={params.pageNo}
            onUpdate:current-page={handlePageNo}
            pageSize={params.pageSize}
            onUpdate:page-size={e => (params.pageSize = e)}
            pageSizes={[20, 50, 100, 200]}
            layout="total,sizes"
            total={params.total}
          />
        </div>
      )}
    </div>
  )
})
</script>
<style scoped lang="scss"></style>
