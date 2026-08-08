<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import Tooltip from '../Tooltip.vue'
import BaseButton from '../BaseButton.vue'
import { useI18n } from 'vue-i18n'
import { modalStack } from './stack.ts'

export interface ModalProps {
  modelValue?: boolean
  showClose?: boolean
  title?: string
  content?: string
  fullScreen?: boolean
  padding?: boolean
  footer?: boolean
  header?: boolean
  confirmButtonText?: string
  cancelButtonText?: string
  keyboard?: boolean
  closeOnClickBg?: boolean
  onConfirm?: any
  beforeClose?: any
  t?: any
}

const props = withDefaults(defineProps<ModalProps>(), {
  modelValue: undefined,
  showClose: true,
  closeOnClickBg: true,
  fullScreen: false,
  footer: false,
  header: true,
  confirmButtonText: '',
  cancelButtonText: '',
  keyboard: true,
})

//在Message.confirm里面，因为是一个新的vue实例，所有没有i18n，只能靠外面传
const localeT = $computed(() => {
  if (props.t) return props.t
  const { t: i18nT } = useI18n()
  return i18nT
})

const emit = defineEmits(['update:modelValue', 'close', 'ok', 'cancel'])

let confirmButtonLoading = $ref(false)
let zIndex = $ref(999)
let visible = $ref(false)
let openTime = $ref(Date.now())
let maskRef = $ref<HTMLDivElement>(null)
let modalRef = $ref<HTMLDivElement>(null)
let id = Date.now()

async function close() {
  if (!visible) {
    return
  }
  if (props.beforeClose) {
    if (!(await props.beforeClose())) {
      return
    }
  }
  //记录停留时间，避免时间太短，弹框闪烁
  let stayTime = Date.now() - openTime
  let closeTime = 300
  if (stayTime < 500) {
    closeTime += 500 - stayTime
  }
  return new Promise(resolve => {
    setTimeout(() => {
      maskRef?.classList.toggle('bounce-out')
      modalRef?.classList.toggle('bounce-out')
    }, 500 - stayTime)

    setTimeout(() => {
      emit('update:modelValue', false)
      emit('close')
      visible = false
      resolve(true)
      let rIndex = modalStack.findIndex(item => item.id === id)
      if (rIndex > -1) {
        modalStack.splice(rIndex, 1)
      }
    }, closeTime)
  })
}

watch(
  () => props.modelValue,
  n => {
    if (n) {
      id = Date.now()
      modalStack.push({ id, close })
      zIndex = 999 + modalStack.length
      visible = true
    } else {
      close()
    }
  }
)

onMounted(() => {
  if (props.modelValue === undefined) {
    visible = true
    id = Date.now()
    modalStack.push({ id, close })
    zIndex = 999 + modalStack.length
  }
})

onUnmounted(() => {
  if (props.modelValue === undefined) {
    visible = false
    let rIndex = modalStack.findIndex(item => item.id === id)
    if (rIndex > -1) {
      modalStack.splice(rIndex, 1)
    }
  }
})

watch(
  () => visible,
  n => {
    if (n) window.addEventListener('keydown', onKeyDown)
    else window.removeEventListener('keydown', onKeyDown)
  }
)

async function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.keyboard) {
    let lastItem = modalStack[modalStack.length - 1]
    if (lastItem?.id === id) {
      await cancel()
    }
  }
}

async function ok() {
  if (props.onConfirm) {
    confirmButtonLoading = true
    let res = await props.onConfirm()
    confirmButtonLoading = false
    if (res === false) return
  }
  emit('ok')
  await close()
}

async function cancel() {
  emit('cancel')
  await close()
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-root" :style="{ 'z-index': zIndex }" v-if="visible">
      <div class="modal-mask" ref="maskRef" v-if="!fullScreen" @click.stop="closeOnClickBg && close()"></div>
      <div class="modal" ref="modalRef" :class="[fullScreen ? 'full' : 'window', content && ' w-84']">
        <Tooltip :title="localeT('close')">
          <IconFluentDismiss20Regular @click="close" v-if="showClose" class="close cursor-pointer" width="24" />
        </Tooltip>
        <div class="modal-header" v-if="header">
          <div class="title">{{ props.title }}</div>
        </div>
        <div class="modal-body" :class="{ padding }">
          <slot></slot>
          <div v-if="content" class="pt-4 max-h-60vh">{{ content }}</div>
        </div>
        <div class="modal-footer" v-if="footer">
          <div class="left flex items-end">
            <slot name="footer-left"></slot>
          </div>
          <div class="right">
            <BaseButton type="info" @click="cancel">{{ cancelButtonText || localeT('cancel') }}</BaseButton>
            <BaseButton id="dialog-ok" :loading="confirmButtonLoading" @click="ok"
              >{{ confirmButtonText || localeT('confirm') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
$time: 0.3s;

@keyframes bounce-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes bounce-in-full {
  0% {
    transform: scale(1.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.modal-root {
  @apply fixed top-0 left-0 z-999 flex items-center justify-center w-full h-full overflow-hidden;

  .modal-mask {
    @apply fixed top-0 left-0 w-full h-full transition-all duration-300;
    background: rgba(#000, 0.6);
    animation: fade-in $time;

    &.bounce-out {
      @apply bg-transparent;
    }
  }

  .window {
    animation: bounce-in $time ease-out;
    @apply shadow-lg rounded-lg;

    &.bounce-out {
      opacity: 0;
    }
  }

  .full {
    @apply w-full h-full;
    animation: bounce-in-full $time ease-out;

    &.bounce-out {
      transform: scale(1.5);
      opacity: 0;
    }
  }

  .modal {
    @apply relative overflow-hidden flex flex-col transition-all duration-300;
    background: var(--color-card-bg);

    .close {
      @apply absolute right-1.2rem top-1.2rem z-999;
    }

    .modal-header {
      @apply flex justify-between items-center p-5 pb-0 rounded-t-lg;

      .title {
        @apply font-bold text-xl;
      }
    }

    .modal-body {
      @apply box-border text-main-text font-normal text-base leading-6 w-full flex-1 overflow-hidden flex;

      &.padding {
        @apply p-1 px-5;
      }
    }

    .modal-footer {
      @apply flex justify-between p-5;
    }
  }
}
</style>
