<script setup lang="ts">

import { Dict, DictId, DictType } from "@/types/types.ts";
import { cloneDeep } from "@/utils";
import Toast from '@/components/base/toast/Toast.ts'
import { onMounted, reactive } from "vue";
import { useRuntimeStore } from "@/stores/runtime.ts";
import { useBaseStore } from "@/stores/base.ts";
import BaseButton from "@/components/BaseButton.vue";
import { getDefaultDict } from "@/types/func.ts";
import { Option, Select } from "@/components/base/select";
import BaseInput from "@/components/base/BaseInput.vue";
import Form from "@/components/base/form/Form.vue";
import FormItem from "@/components/base/form/FormItem.vue";
import { CAN_REQUEST } from "@/config/env.ts";
import { addDict } from "@/apis";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const props = defineProps<{
  isAdd: boolean,
  isBook: boolean
}>()
const emit = defineEmits<{
  submit: []
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
  type: DictType.article
}
let dictForm: any = $ref(cloneDeep(DefaultDictForm))
const dictFormRef = $ref()
let loading = $ref(false)
const dictRules = reactive({
  name: [
    {required: true, message: t('EnterName'), trigger: 'blur'},
    {max: 20, message: t('NameLengthLimit'), trigger: 'blur'},
  ],
})

async function onSubmit() {
  await dictFormRef.validate(async (valid) => {
    if (valid) {
      let data: Dict = getDefaultDict(dictForm)
      data.type = props.isBook ? DictType.article : DictType.word
      let source = [store.article, store.word][props.isBook ? 0 : 1]
      //todo 可以检查的更准确些，比如json对比
      if (props.isAdd) {
        data.id = 'custom-dict-' + Date.now()
        if (source.bookList.find(v => v.name === data.name)) {
          Toast.warning(t('DuplicateName'))
          return
        } else {
          if (CAN_REQUEST) {
            loading = true
            let res = await addDict(null, data)
            loading = false
            if (res.success) {
              data = getDefaultDict(res.data)
            } else {
              return Toast.error(res.msg)
            }
          }
          source.bookList.push(cloneDeep(data))
          runtimeStore.editDict = data
          emit('submit')
          Toast.success(t('AddSuccess'))
        }
      } else {
        let rIndex = source.bookList.findIndex(v => v.id === data.id)
        //任意修改，都将其变为自定义词典
        if (!data.custom && ![DictId.wordKnown, DictId.wordWrong, DictId.wordCollect, DictId.articleCollect].includes(data.en_name || data.id)) {
          data.custom = true
          data.id += '_custom'
        }
        runtimeStore.editDict = data
        if (rIndex > -1) {
          source.bookList[rIndex] = cloneDeep(data)
          emit('submit')
          Toast.success(t('ModifySuccess'))
        } else {
          source.bookList.push(cloneDeep(data))
          Toast.success(t('ModifySuccessAddedToMyDict'))
        }
      }
      console.log('submit!', data)
    } else {
      Toast.warning(t('PleaseComplete'))
    }
  })
}

onMounted(() => {
  if (!props.isAdd) {
    dictForm = cloneDeep(runtimeStore.editDict)
  }
})

</script>

<template>
  <div class="w-120 mt-4">
    <Form
        ref="dictFormRef"
        :rules="dictRules"
        :model="dictForm"
        label-width="8rem">
      <FormItem :label="t('Name')" prop="name">
        <BaseInput v-model="dictForm.name"/>
      </FormItem>
      <FormItem :label="t('Description')">
        <BaseInput v-model="dictForm.description" textarea/>
      </FormItem>
      <FormItem :label="t('OriginalLanguage')" v-if="false">
        <Select v-model="dictForm.language" :placeholder="t('PleaseSelect')">
          <Option :label="t('English')" value="en"/>
          <Option :label="t('German')" value="de"/>
          <Option :label="t('Japanese')" value="ja"/>
          <Option :label="t('Code')" value="code"/>
        </Select>
      </FormItem>
      <FormItem :label="t('TranslationLanguage')" v-if="false">
        <Select v-model="dictForm.translateLanguage" :placeholder="t('PleaseSelect')">
          <Option :label="t('Chinese')" value="zh-CN"/>
          <Option :label="t('English')" value="en"/>
          <Option :label="t('German')" value="de"/>
          <Option :label="t('Japanese')" value="ja"/>
        </Select>
      </FormItem>
      <div class="center">
        <base-button type="info" @click="emit('close')">{{ t('Close') }}</base-button>
        <base-button type="primary" :loading="loading" @click="onSubmit">{{ t('Confirm') }}</base-button>
      </div>
    </Form>
  </div>
</template>

<style scoped lang="scss">


</style>
