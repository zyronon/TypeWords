<script setup lang="ts">
import BaseIcon from '../BaseIcon.vue'

const props = withDefaults(
  defineProps<{
    time?: number
    simple?: boolean
    title?: string
    cb?: Function
  }>(),
  {
    time: 300,
    simple: false,
  }
)
const emit = defineEmits(['click'])

let step = $ref(2)
let count = $ref(0)

function runAnimation(reset = false, time = props.time) {
  if (reset) {
    step = 2
    count = 0
  }
  count++
  setTimeout(() => {
    if (step === 2) {
      if (count === 1) {
        step = 0
        runAnimation(false, time + 100)
      } else {
        count = 0
      }
    } else {
      step++
      runAnimation(false, time + 100)
    }
  }, time)
}

function play(handle: boolean = false) {
  props?.cb?.(handle)
  runAnimation(true)
}

// todo 废弃
function animateOnly(reset = false) {
  runAnimation(reset)
}
function animate(reset = false) {
  runAnimation(reset)
}

function click(event: MouseEvent) {
  emit('click', event)
  play(true)
}

defineExpose({ play, animateOnly, animate })
</script>

<template>
  <BaseIcon :title="title" @click.stop="click" :no-bg="props.simple">
    <IconBxVolume v-if="step === 0" />
    <IconBxVolumeLow v-if="step === 1" />
    <IconBxVolumeFull v-if="step === 2" />
  </BaseIcon>
</template>

<style scoped lang="scss"></style>
