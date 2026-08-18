<script setup lang="ts">
import Tooltip from '../Tooltip.vue'

defineEmits(['click'])
withDefaults(
  defineProps<{
    circle?: boolean
    tooltip?: string
  }>(),
  {
    circle: true,
    tooltip: 'close',
  }
)
</script>

<template>
  <div class="close" @click="$emit('click',$event)">
    <Tooltip :title="$t(tooltip)">
      <IconFluentDismiss20Regular v-if="!circle" />
      <IconFluentDismissCircle16Regular v-else />
    </Tooltip>
  </div>
</template>

<style scoped lang="scss">
.close {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}
</style>
