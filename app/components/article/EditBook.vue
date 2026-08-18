<script setup lang="ts">
import type { Dict } from '@/core/types'
import { DictType, getDefaultDict } from '@/core/types'
import { cloneDeep, ensureCustomDictCopy } from '@/core/utils'
import { onMounted, reactive } from 'vue'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { BaseButton, BaseInput, Form, FormItem, Option, Select, Textarea, Toast } from '@/base'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isAdd: boolean
  isBook: boolean
  /** 创建副本时传入的预填数据，含已生成的 id/sourceId 等 */
  initialData?: Partial<Dict>
  submitMode?: 'store' | 'draft'
  fluid?: boolean
}>()
const emit = defineEmits<{
  submit: [dict?: Dict]
  close: []
}>()
const runtimeStore = useRuntimeStore()
const store = useBaseStore()
const DefaultDictForm = {
  id: '',
  name: '',
  description: '',
  category: '',
  tags: [],
  translateLanguage: 'zh-CN',
  language: 'en',
  type: DictType.article,
}
let dictForm: any = $ref(cloneDeep(DefaultDictForm))
const dictFormRef: any = $ref()
let loading = $ref(false)
const { t: $t } = useI18n()
const dictRules: any = reactive({
  name: [
    { required: true, message: $t('please_enter_name'), trigger: 'blur' },
    { max: 20, message: $t('name_max_20_chars'), trigger: 'blur' },
  ],
})

async function onSubmit() {
  await dictFormRef.validate(async valid => {
    if (valid) {
      let data: Dict = getDefaultDict(dictForm)
      data.type = props.isBook ? DictType.article : DictType.word
      let source = [store.article, store.word][props.isBook ? 0 : 1]
      if (props.submitMode === 'draft') {
        data.id = data.id || props.initialData?.id || 'pending-dict-' + Date.now()
        data.custom = true
        if (source.bookList.find(v => v.name === data.name)) {
          Toast.warning($t('name_already_exists'))
          return
        }
        emit('submit', getDefaultDict(data))
        return
      }
      //todo 可以检查的更准确些，比如json对比
      if (props.isAdd) {
        if (props.initialData?.id) {
          // 副本模式：保留已生成的 id 和 sourceId
          data.id = props.initialData.id
          data.sourceId = props.initialData.sourceId ?? ''
        } else {
          data.id = 'custom-dict-' + Date.now()
        }
        data.custom = true
        if (source.bookList.find(v => v.name === data.name)) {
          Toast.warning($t('name_already_exists'))
          return
        } else {
          source.bookList.push(cloneDeep(data))
          runtimeStore.editDict = data
          emit('submit', data)
          Toast.success($t('add_success'))
        }
      } else {
        const originalId = data.id
        data = ensureCustomDictCopy(data)
        let rIndex = source.bookList.findIndex(v => v.id === originalId)
        runtimeStore.editDict = data
        if (rIndex > -1) {
          source.bookList[rIndex] = getDefaultDict(data)
          emit('submit', data)
          Toast.success($t('edit_success'))
        } else {
          source.bookList.push(getDefaultDict(data))
          Toast.success($t('edit_and_add_to_dict'))
        }
      }
    } else {
      Toast.warning($t('please_fill_complete'))
    }
  })
}

onMounted(() => {
  if (props.initialData) {
    // 创建副本模式：用传入的初始数据填充表单
    dictForm = cloneDeep({ ...cloneDeep(DefaultDictForm), ...props.initialData })
  } else if (!props.isAdd) {
    dictForm = cloneDeep(runtimeStore.editDict)
  }
})
</script>

<template>
  <div :class="fluid ? 'w-full mt-4' : 'w-120 mt-4'">
    <Form ref="dictFormRef" :rules="dictRules" :model="dictForm" label-width="8rem">
      <FormItem :label="$t('name')" prop="name">
        <BaseInput v-model="dictForm.name" />
      </FormItem>
      <FormItem :label="$t('description')">
        <Textarea v-model="dictForm.description" autosize></Textarea>
      </FormItem>
      <FormItem :label="$t('source_language')" v-if="false">
        <Select v-model="dictForm.language" :placeholder="$t('please_select')">
          <Option :label="$t('english')" value="en" />
          <Option :label="$t('german')" value="de" />
          <Option :label="$t('japanese')" value="ja" />
          <Option :label="$t('code')" value="code" />
        </Select>
      </FormItem>
      <FormItem :label="$t('target_language')" v-if="false">
        <Select v-model="dictForm.translateLanguage" :placeholder="$t('please_select')">
          <Option :label="$t('chinese')" value="zh-CN" />
          <Option :label="$t('english')" value="en" />
          <Option :label="$t('german')" value="de" />
          <Option :label="$t('japanese')" value="ja" />
        </Select>
      </FormItem>
      <div class="center">
        <base-button type="info" @click="emit('close')">{{ $t('close') }}</base-button>
        <base-button type="primary" :loading="loading" @click="onSubmit">{{ $t('confirm') }}</base-button>
      </div>
    </Form>
  </div>
</template>

<style scoped lang="scss"></style>
