<script setup lang="ts">
import { BaseButton, Textarea, Toast } from '@/base'
import { useI18n } from 'vue-i18n'
import { watchEffect } from 'vue'

interface IProps {
  value: string
  disabled: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  value: '',
  disabled: false,
})

const emit = defineEmits(['save'])

let editVal = $ref('')
let edit = $ref(false)

watchEffect(() => {
  editVal = props.value
})

function save() {
  emit('save', editVal)
  edit = false
}

const { t: $t } = useI18n()

function toggle() {
  if (props.disabled) return Toast.info($t('wait_translation'))
  edit = !edit
  editVal = props.value
}
</script>

<template>
  <div v-if="edit" class="edit-text">
    <Textarea
      v-model="editVal"
      ref="inputRef"
      textarea
      autosize
      autofocus
      type="textarea"
      :input-style="`color: var(--color-font-1);font-size: 1rem;`"
    />
    <div class="flex justify-end mt-2">
      <BaseButton @click="toggle">{{ $t('cancel') }}</BaseButton>
      <BaseButton @click="save">{{ $t('apply') }}</BaseButton>
    </div>
  </div>
  <div v-else class="text" @click="toggle">
    {{ value }}
  </div>
</template>

<style scoped lang="scss">
.edit-text {
  margin-top: 0.6rem;
  color: var(--color-font-1);
}

.text {
  color: var(--color-font-1);
  font-size: 1.2rem;
  min-height: 1.1rem;
}
</style>
