<script setup lang="ts">

</script>

<template>
  <div class="flex justify-center">
    <div class="page 3xl:w-[50vw] 2xl:w-[60vw] xl:w-[70vw] lg:w-[75vw]">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page {
  min-height: calc(100vh - 1.2rem);
  margin-top: 1.2rem;
}


@media (max-width: 768px) {
  .page {
    width: 100vw !important;
    margin-top: 0.5rem;
    min-height: calc(100vh - 0.5rem);
    padding: 0 0.5rem;
    box-sizing: border-box;
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .page {
    margin-top: 0.3rem;
    min-height: calc(100vh - 0.3rem);
    padding: 0 0.3rem;
  }
}
</style>
