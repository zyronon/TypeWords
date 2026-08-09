<template>
  <form @submit.prevent>
    <slot />
  </form>
</template>

<script setup lang="ts">
import { provide, ref, toRef } from 'vue'
import type { Field, FormModel, FormRules } from './types'

const props = defineProps({
  model: Object as () => FormModel,
  rules: Object as () => FormRules,
})

const fields = ref<Field[]>([])

const registerField = (field: Field) => {
  fields.value.push(field)
}

// 校验整个表单
function validate(cb) {
  let valid = true
  fields.value.forEach(f => {
    const fieldRules = props.rules?.[f.prop] || []
    const res = f.validate(fieldRules)
    if (!res) valid = false
  })
  cb(valid)
}

// 校验指定字段
function validateField(fieldName: string, cb?: (valid: boolean) => void): boolean {
  const field = fields.value.find(f => f.prop === fieldName)
  if (field) {
    const fieldRules = props.rules?.[fieldName] || []
    const valid = field.validate(fieldRules)
    if (cb) cb(valid)
    return valid
  }
  if (cb) cb(true)
  return true
}

provide('registerField', registerField)
provide('formModel', toRef(props, 'model'))
provide('formValidate', validate)
provide('formRules', props.rules)

defineExpose({ validate, validateField })
</script>
