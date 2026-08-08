<script setup lang="ts"></script>

<template>
  <div class="flex box-border cp">
    <div class="option-wrap">
      <slot></slot>
    </div>
    <div class="relative group">
      <div class="more w-10 rounded-r-lg h-full center box-border transition-all duration-300">
        <IconFluentChevronDown20Regular  color="gray"/>
      </div>
      <div
        class="space-y-2 btn-no-margin pt-2 absolute z-2 right-0 border rounded opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto"
      >
        <slot name="options"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.option-wrap {
  width: 100%;
  display: flex;
  :deep(.base-button) {
    width: 100%;
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
  }
}

.primary-btn {
  .more {
    background: var(--btn-primary);
    border: 1.5px solid transparent;
    border-left-color: #69788e;
    &:hover {
      background: var(--btn-primary-hover);
    }
  }
}

.orange-btn {
  .more {
    background: var(--btn-orange);
    color: black;
    border: 1px solid transparent;
    border-left-color: #cfb752;
    &:hover {
      background: var(--btn-orange-hover);
    }
  }
}
</style>
