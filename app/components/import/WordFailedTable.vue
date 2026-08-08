<script setup lang="ts">
import { BaseButton, BaseInput, Checkbox, Toast } from '@/base'
import { MessageBox } from '@/core/utils/MessageBox.tsx'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type FailedWordRow = {
  id: string
  word: string
  checked: boolean
  editing: boolean
}

const props = defineProps<{
  rows: FailedWordRow[]
}>()

const emit = defineEmits<{
  'update:rows': [FailedWordRow[]]
}>()

const { t } = useI18n()
const checkedCount = computed(() => props.rows.filter(r => r.checked).length)

const allChecked = computed({
  get: () => props.rows.length > 0 && props.rows.every(r => r.checked),
  set: (val: boolean) => {
    emit(
      'update:rows',
      props.rows.map(r => ({ ...r, checked: val }))
    )
  },
})

function updateRows(rows: FailedWordRow[]) {
  emit('update:rows', rows)
}

function updateRow(id: string, patch: Partial<FailedWordRow>) {
  updateRows(props.rows.map(r => (r.id === id ? { ...r, ...patch } : r)))
}

function toggleRow(id: string, checked: boolean) {
  updateRow(id, { checked })
}

function deleteRow(id: string) {
  updateRows(props.rows.filter(r => r.id !== id))
}

function doBatchDelete() {
  const toDelete = props.rows.filter(r => r.checked)
  if (!toDelete.length) return Toast.warning('请先勾选要删除的单词')

  const remove = () => updateRows(props.rows.filter(r => !r.checked))

  if (toDelete.length > 10) {
    MessageBox.confirm(
      `确定删除已勾选的 ${toDelete.length} 个单词吗？`,
      '批量删除',
      () => void 0,
      () => void 0,
      null,
      { t, onConfirm: remove }
    )
    return
  }
  remove()
}

function startEdit(row: FailedWordRow) {
  updateRow(row.id, { editing: true })
}

function finishEdit(row: FailedWordRow, value: string) {
  const word = value.trim() || row.word
  updateRow(row.id, { word, editing: false })
}

function onEditKeydown(e: KeyboardEvent, row: FailedWordRow, value: string) {
  if (e.key === 'Enter') {
    finishEdit(row, value)
  }
}
</script>

<template>
  <div class="failed-table">
    <p class="failed-table-tip">
      以下单词未收录，可点击单词修改拼写后重试；勾选后可通过底部按钮处理
    </p>
    <div class="failed-table-toolbar">
      <Checkbox v-model="allChecked">全选</Checkbox>
      <BaseButton type="info" size="small" :disabled="!checkedCount" @click="doBatchDelete">
        批量删除
      </BaseButton>
      <span class="failed-table-count">已选 {{ checkedCount }} / {{ rows.length }}</span>
    </div>
    <div class="failed-table-head">
      <span class="col-check" />
      <span class="col-word">单词</span>
      <span class="col-action">操作</span>
    </div>
    <ul class="failed-table-body">
      <li v-for="row in rows" :key="row.id" class="failed-table-row">
        <div class="col-check">
          <Checkbox :model-value="row.checked" @update:model-value="toggleRow(row.id, $event)" />
        </div>
        <div class="col-word">
          <BaseInput
            v-if="row.editing"
            autofocus
            :model-value="row.word"
            @update:model-value="val => updateRow(row.id, { word: val })"
            @blur="finishEdit(row, row.word)"
            @keydown="onEditKeydown($event, row, row.word)"
          />
          <button v-else type="button" class="word-text" @click="startEdit(row)">
            {{ row.word }}
          </button>
        </div>
        <div class="col-action">
          <button type="button" class="delete-btn" title="删除" @click="deleteRow(row.id)">
            <IconFluentDelete20Regular />
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.failed-table-tip {
  color: var(--color-font-2);
  font-size: 0.88rem;
  line-height: 1.6;
  margin: 0 0 0.75rem;
}

.failed-table-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.failed-table-count {
  color: var(--color-font-3);
  font-size: 0.85rem;
  margin-left: auto;
}

.failed-table-head,
.failed-table-row {
  align-items: center;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: 2rem 1fr 2.5rem;
}

.failed-table-head {
  border-bottom: 1px solid var(--color-input-border);
  color: var(--color-font-3);
  font-size: 0.82rem;
  font-weight: 700;
  padding-bottom: 0.5rem;
}

.failed-table-body {
  list-style: none;
  margin: 0;
  max-height: 16rem;
  overflow: auto;
  padding: 0;
}

.failed-table-row {
  border-bottom: 1px solid var(--color-input-border);
  padding: 0.55rem 0;

  &:last-child {
    border-bottom: none;
  }
}

.word-text {
  background: none;
  border: none;
  color: var(--color-font-1);
  cursor: pointer;
  font-size: 0.95rem;
  padding: 0.35rem 0;
  text-align: left;
  width: 100%;

  &:hover {
    color: var(--color-select-bg);
    text-decoration: underline;
  }
}

.delete-btn {
  align-items: center;
  background: none;
  border: none;
  color: var(--color-font-3);
  cursor: pointer;
  display: inline-flex;
  font-size: 1.1rem;
  justify-content: center;
  padding: 0.25rem;

  &:hover {
    color: #dc2626;
  }
}
</style>
