<script setup lang="ts">
import { nextTick, watch } from 'vue'

interface IProps {
  modelValue?: boolean
  width?: string
}

let props = withDefaults(defineProps<IProps>(), {
  modelValue: true,
  width: '180rem',
})
let modalRef = $ref(null)
let style = $ref({ top: '2.4rem', bottom: 'unset' })

watch(
  () => props.modelValue,
  n => {
    if (n)
      nextTick(() => {
        if (modalRef) {
          const modal = modalRef as HTMLElement
          if (modal.getBoundingClientRect().bottom > window.innerHeight) {
            style = { top: 'unset', bottom: '2.5rem' }
          }
        }
      })
  }
)
</script>

<template>
  <Transition name="fade">
    <div v-if="modelValue" ref="modalRef" class="mini-modal" :style="{ width, ...style }">
      <slot></slot>
    </div>
  </Transition>
</template>

<style lang="scss">
.mini-row-title {
  @apply text-center text-base font-bold mb-2;
  color: var(--color-font-1);
}

.mini-row {
  @apply min-h-10 flex justify-between items-center gap-space text-base text-font-1 word-break-keep-all;
  color: var(--color-font-1);
}

.mini-modal {
  background: var(--color-card-bg);
  padding: var(--space) 1rem;
  @apply z-9 absolute left-1/2 transform -translate-x-1/2 shadow-lg rounded-xl w-50;
}
</style>
